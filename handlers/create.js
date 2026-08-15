import Content from '../models/Content.js';
import {
  createSession,
  getSession,
  updateSession,
  clearSession,
} from '../utils/session.js';
import {
  isValidUrl,
  isValidYear,
  isValidImdb,
  isNonEmpty,
  parseGenres,
  VALID_STATUSES,
} from '../utils/validation.js';

// Ordered field list per content type. Shared by edit.js too.
export const FIELDS_BY_TYPE = {
  anime: ['title', 'imdb', 'year', 'poster', 'banner', 'description', 'genre', 'status'],
  movie: [
    'title',
    'imdb',
    'year',
    'poster',
    'banner',
    'description',
    'genre',
    'status',
    'videoUrl',
  ],
  series: ['title', 'imdb', 'year', 'poster', 'banner', 'description', 'genre', 'status'],
};

// Field metadata: how to prompt, validate and parse each field.
// type:'choice' fields are answered via inline buttons instead of free text.
export const FIELD_META = {
  title: {
    label: 'Title',
    prompt: 'Enter the title:',
    validate: isNonEmpty,
    error: 'Title cannot be empty. Try again:',
    parse: (v) => v.trim(),
  },
  imdb: {
    label: 'IMDb',
    prompt: 'Enter the IMDb rating (0-10):',
    validate: isValidImdb,
    error: 'Enter a valid number between 0 and 10. Try again:',
    parse: (v) => v.trim(),
  },
  year: {
    label: 'Year',
    prompt: 'Enter the release year (e.g. 2024):',
    validate: isValidYear,
    error: 'Enter a valid 4-digit year. Try again:',
    parse: (v) => v.trim(),
  },
  poster: {
    label: 'Poster',
    prompt: 'Enter the poster image URL:',
    validate: isValidUrl,
    error: 'Enter a valid http(s) URL. Try again:',
    parse: (v) => v.trim(),
  },
  banner: {
    label: 'Banner',
    prompt: 'Enter the banner image URL:',
    validate: isValidUrl,
    error: 'Enter a valid http(s) URL. Try again:',
    parse: (v) => v.trim(),
  },
  description: {
    label: 'Description',
    prompt: 'Enter the description:',
    validate: isNonEmpty,
    error: 'Description cannot be empty. Try again:',
    parse: (v) => v.trim(),
  },
  genre: {
    label: 'Genres',
    prompt: 'Enter genres, comma-separated (e.g. Action, Fantasy, Adventure):',
    validate: (v) => parseGenres(v).length > 0,
    error: 'Enter at least one genre. Try again:',
    parse: (v) => parseGenres(v),
    format: (v) => (Array.isArray(v) ? v.join(', ') : v),
  },
  status: {
    label: 'Status',
    type: 'choice',
    prompt: 'Select the status:',
    choices: VALID_STATUSES,
  },
  videoUrl: {
    label: 'Video URL',
    prompt: 'Enter the video URL:',
    validate: isValidUrl,
    error: 'Enter a valid http(s) URL. Try again:',
    parse: (v) => v.trim(),
  },
};

const TYPE_LABEL = { anime: '🎌 Anime', movie: '🎬 Movie', series: '📺 Series' };
const TYPE_EMOJI = { anime: '🎌', movie: '🎬', series: '📺' };

export async function startCreateMenu(bot, chatId) {
  await bot.sendMessage(chatId, '➕ Create Content\n\nChoose content type:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎌 Anime', callback_data: 'create:type:anime' }],
        [{ text: '🎬 Movie', callback_data: 'create:type:movie' }],
        [{ text: '📺 Series', callback_data: 'create:type:series' }],
        [{ text: '❌ Cancel', callback_data: 'create:cancel' }],
      ],
    },
  });
}

function currentField(session) {
  const fields = FIELDS_BY_TYPE[session.contentType];
  if (session.step >= fields.length) return null;
  return fields[session.step];
}

async function promptCurrentStep(bot, chatId, session) {
  const fieldKey = currentField(session);
  if (!fieldKey) {
    return showPreview(bot, chatId, session);
  }
  const meta = FIELD_META[fieldKey];

  if (meta.type === 'choice') {
    await bot.sendMessage(chatId, meta.prompt, {
      reply_markup: {
        inline_keyboard: [
          ...meta.choices.map((c) => [
            { text: c, callback_data: `create:status:${c}` },
          ]),
          [{ text: '❌ Cancel', callback_data: 'create:cancel' }],
        ],
      },
    });
  } else {
    await bot.sendMessage(chatId, meta.prompt);
  }
}

function buildPreviewText(session) {
  const t = session.temporaryData;
  const typeLabel = TYPE_LABEL[session.contentType];
  const genreText = Array.isArray(t.genre) ? t.genre.join(', ') : '';
  let text =
    `${typeLabel === TYPE_LABEL.anime ? '🎌' : typeLabel === TYPE_LABEL.movie ? '🎬' : '📺'} Create ${
      session.contentType[0].toUpperCase() + session.contentType.slice(1)
    }\n\n` +
    `Title: ${t.title || ''}\n` +
    `IMDb: ${t.imdb || ''}\n` +
    `Year: ${t.year || ''}\n` +
    `Genres: ${genreText}\n` +
    `Status: ${t.status || ''}\n`;
  if (session.contentType === 'movie') {
    text += `Video URL: ${t.videoUrl || ''}\n`;
  }
  text += `\nDescription:\n${t.description || ''}`;
  return text;
}

async function showPreview(bot, chatId, session) {
  const text = buildPreviewText(session);
  const confirmLabel =
    session.contentType === 'movie' ? '✅ Create Movie' : '✅ Create';
  await bot.sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: confirmLabel, callback_data: 'create:confirm' }],
        [{ text: '✏️ Restart', callback_data: 'create:restart' }],
        [{ text: '❌ Cancel', callback_data: 'create:cancel' }],
      ],
    },
  });
}

export async function handleCreateCallback(bot, query) {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data; // create:type:anime | create:status:Ongoing | create:confirm | create:restart | create:cancel

  const parts = data.split(':'); // ['create', 'type'|'status'|'confirm'|'restart'|'cancel', ...]
  const action = parts[1];

  if (action === 'cancel') {
    clearSession(userId);
    await bot.editMessageText('❌ Create cancelled.', {
      chat_id: chatId,
      message_id: query.message.message_id,
    });
    return;
  }

  if (action === 'type') {
    const contentType = parts[2];
    const session = createSession(userId, 'create', {
      contentType,
      step: 0,
      temporaryData: {},
    });
    await bot.editMessageText(`${TYPE_EMOJI[contentType]} Creating ${contentType}...`, {
      chat_id: chatId,
      message_id: query.message.message_id,
    });
    await promptCurrentStep(bot, chatId, session);
    return;
  }

  const session = getSession(userId);
  if (!session || session.type !== 'create') {
    await bot.answerCallbackQuery(query.id, {
      text: 'This session has expired. Send /create to start again.',
      show_alert: true,
    });
    return;
  }

  if (action === 'status') {
    const status = parts.slice(2).join(':');
    session.temporaryData.status = status;
    session.step += 1;
    updateSession(userId, session);
    await promptCurrentStep(bot, chatId, session);
    return;
  }

  if (action === 'restart') {
    updateSession(userId, { step: 0, temporaryData: {} });
    await promptCurrentStep(bot, chatId, getSession(userId));
    return;
  }

  if (action === 'confirm') {
    try {
      const doc = new Content({
        type: session.contentType,
        title: session.temporaryData.title,
        imdb: session.temporaryData.imdb,
        year: session.temporaryData.year,
        poster: session.temporaryData.poster,
        banner: session.temporaryData.banner,
        description: session.temporaryData.description,
        genre: session.temporaryData.genre,
        status: session.temporaryData.status,
        videoUrl: session.temporaryData.videoUrl || '',
      });
      await doc.save();
      clearSession(userId);

      const label =
        session.contentType.charAt(0).toUpperCase() + session.contentType.slice(1);
      let successText = `✅ ${label} created successfully!\n\nTitle: ${doc.title}\nID: ${doc._id}`;

      if (session.contentType === 'series') {
        await bot.sendMessage(chatId, `✅ Series created.\n\nTitle: ${doc.title}\nID: ${doc._id}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '➕ Add Episode', callback_data: `season:add:${doc._id}` }],
              [{ text: '✏️ Edit', callback_data: `sel:edit:series:${doc._id}` }],
              [{ text: '🏠 Main Menu', callback_data: 'menu:home' }],
            ],
          },
        });
      } else {
        await bot.sendMessage(chatId, successText, {
          reply_markup: {
            inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'menu:home' }]],
          },
        });
      }
    } catch (err) {
      console.error('Create save error:', err.message);
      await bot.sendMessage(
        chatId,
        `❌ Failed to save to the database: ${err.message}\n\nYour session was kept — use ✏️ Restart or /cancel.`
      );
    }
    return;
  }
}

// Handles free-text answers during an active create wizard.
// Returns true if the message was consumed by this handler.
export async function handleCreateText(bot, msg, session) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text ?? '';

  const fieldKey = currentField(session);
  if (!fieldKey) return true; // nothing left to collect; ignore stray text

  const meta = FIELD_META[fieldKey];
  if (meta.type === 'choice') {
    await bot.sendMessage(chatId, 'Please use the buttons above to choose a value.');
    return true;
  }

  if (!meta.validate(text)) {
    await bot.sendMessage(chatId, `❌ ${meta.error}`);
    return true;
  }

  session.temporaryData[fieldKey] = meta.parse(text);
  session.step += 1;
  updateSession(userId, session);
  await promptCurrentStep(bot, chatId, session);
  return true;
}
