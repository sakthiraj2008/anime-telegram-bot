import Content from '../models/Content.js';
import { renderContentList } from '../utils/listing.js';
import { createSession, getSession, updateSession, clearSession } from '../utils/session.js';
import { FIELD_META } from './create.js';

export async function startEditMenu(bot, chatId) {
  await bot.sendMessage(chatId, '✏️ Edit Content\n\nChoose content type:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎌 Anime', callback_data: 'edit:type:anime' }],
        [{ text: '🎬 Movie', callback_data: 'edit:type:movie' }],
        [{ text: '📺 Series', callback_data: 'edit:type:series' }],
        [{ text: '❌ Cancel', callback_data: 'edit:cancel' }],
      ],
    },
  });
}

const FIELD_BUTTONS = [
  ['title', 'Title'],
  ['imdb', 'IMDb'],
  ['year', 'Year'],
  ['poster', 'Poster'],
  ['banner', 'Banner'],
  ['description', 'Description'],
  ['genre', 'Genres'],
  ['status', 'Status'],
];

async function showEditMenu(bot, chatId, messageId, doc) {
  const emoji = doc.type === 'anime' ? '🎌' : doc.type === 'movie' ? '🎬' : '📺';
  const rows = FIELD_BUTTONS.map(([key, label]) => [
    { text: label, callback_data: `field:${doc.type}:${doc._id}:${key}` },
  ]);

  if (doc.type === 'anime') {
    rows.push([{ text: 'Manage Episodes', callback_data: `sel:upload:anime:${doc._id}` }]);
  } else if (doc.type === 'movie') {
    rows.push([{ text: 'Video URL', callback_data: `field:movie:${doc._id}:videoUrl` }]);
  } else if (doc.type === 'series') {
    rows.push([{ text: 'Manage Seasons', callback_data: `sel:upload:series:${doc._id}` }]);
  }

  rows.push([{ text: '⬅️ Back', callback_data: `edit:type:${doc.type}` }]);

  const text = `${emoji} Edit Content\n\n${doc.title}`;
  await bot.editMessageText(text, {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: rows },
  });
}

export async function handleEditCallback(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const userId = query.from.id;
  const data = query.data;
  const parts = data.split(':');

  if (data === 'edit:cancel') {
    clearSession(userId);
    await bot.editMessageText('❌ Edit cancelled.', { chat_id: chatId, message_id: messageId });
    return;
  }

  // edit:type:<type>
  if (parts[0] === 'edit' && parts[1] === 'type') {
    const type = parts[2];
    clearSession(userId);
    await renderContentList({
      bot,
      chatId,
      messageId,
      type,
      page: 1,
      prefix: `edit:${type}`,
      selPrefix: `sel:edit:${type}`,
    });
    return;
  }

  // page:edit:<type>:<page>
  if (parts[0] === 'page' && parts[1] === 'edit') {
    const type = parts[2];
    const page = Number(parts[3]) || 1;
    await renderContentList({
      bot,
      chatId,
      messageId,
      type,
      page,
      prefix: `edit:${type}`,
      selPrefix: `sel:edit:${type}`,
    });
    return;
  }

  // sel:edit:<type>:<id>
  if (parts[0] === 'sel' && parts[1] === 'edit') {
    const id = parts[3];
    const doc = await Content.findById(id).lean();
    if (!doc) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ Not found. It may have been deleted.', show_alert: true });
      return;
    }
    await showEditMenu(bot, chatId, messageId, doc);
    return;
  }

  // field:<type>:<id>:<fieldKey>
  if (parts[0] === 'field') {
    const type = parts[1];
    const id = parts[2];
    const fieldKey = parts[3];
    const doc = await Content.findById(id).lean();
    if (!doc) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ Not found.', show_alert: true });
      return;
    }
    createSession(userId, 'edit', {
      contentType: type,
      contentId: id,
      fieldKey,
      step: 0,
      temporaryData: {},
    });

    const meta = FIELD_META[fieldKey];
    if (meta.type === 'choice') {
      await bot.sendMessage(chatId, `Current: ${doc[fieldKey]}\n\n${meta.prompt}`, {
        reply_markup: {
          inline_keyboard: [
            ...meta.choices.map((c) => [{ text: c, callback_data: `fieldval:status:${c}` }]),
            [{ text: '❌ Cancel', callback_data: 'edit:cancel' }],
          ],
        },
      });
    } else {
      const currentVal = meta.format ? meta.format(doc[fieldKey]) : doc[fieldKey];
      await bot.sendMessage(chatId, `Current: ${currentVal || '(empty)'}\n\n${meta.prompt}`);
    }
    return;
  }

  // fieldval:status:<value>  (choice-field answer)
  if (parts[0] === 'fieldval' && parts[1] === 'status') {
    const value = parts.slice(2).join(':');
    const session = getSession(userId);
    if (!session || session.type !== 'edit') {
      await bot.answerCallbackQuery(query.id, { text: 'Session expired. Send /edit to try again.', show_alert: true });
      return;
    }
    await applyFieldUpdate(bot, chatId, userId, session, value);
    return;
  }
}

async function applyFieldUpdate(bot, chatId, userId, session, rawValue) {
  const meta = FIELD_META[session.fieldKey];
  const value = meta.parse ? meta.parse(rawValue) : rawValue;
  try {
    const doc = await Content.findByIdAndUpdate(
      session.contentId,
      { [session.fieldKey]: value },
      { new: true, runValidators: true }
    );
    clearSession(userId);
    if (!doc) {
      await bot.sendMessage(chatId, '⚠️ That item no longer exists.');
      return;
    }
    await bot.sendMessage(chatId, `✅ ${meta.label} updated for ${doc.title}.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✏️ Edit Another Field', callback_data: `sel:edit:${doc.type}:${doc._id}` }],
          [{ text: '🏠 Main Menu', callback_data: 'menu:home' }],
        ],
      },
    });
  } catch (err) {
    console.error('Field update error:', err.message);
    clearSession(userId);
    await bot.sendMessage(chatId, `❌ Failed to update: ${err.message}`);
  }
}

// Handles free-text input while an edit session is waiting for a new field value.
export async function handleEditText(bot, msg, session) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text ?? '';
  const meta = FIELD_META[session.fieldKey];

  if (meta.type === 'choice') {
    await bot.sendMessage(chatId, 'Please use the buttons above to choose a value.');
    return true;
  }

  if (!meta.validate(text)) {
    await bot.sendMessage(chatId, `❌ ${meta.error}`);
    return true;
  }

  await applyFieldUpdate(bot, chatId, userId, session, text);
  return true;
}
