import Content from '../models/Content.js';
import { renderContentList } from '../utils/listing.js';
import {
  createSession,
  getSession,
  updateSession,
  clearSession,
} from '../utils/session.js';
import { isValidUrl, isPositiveInteger, isNonEmpty } from '../utils/validation.js';

export async function startUploadMenu(bot, chatId) {
  await bot.sendMessage(chatId, '📤 Upload Content\n\nChoose content type:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎌 Anime', callback_data: 'upload:type:anime' }],
        [{ text: '🎬 Movie', callback_data: 'upload:type:movie' }],
        [{ text: '📺 Series', callback_data: 'upload:type:series' }],
        [{ text: '❌ Cancel', callback_data: 'upload:cancel' }],
      ],
    },
  });
}

async function showAnimeItem(bot, chatId, messageId, doc) {
  const epList =
    doc.episodes.length === 0
      ? 'No episodes yet.'
      : doc.episodes
          .sort((a, b) => a.episodeNumber - b.episodeNumber)
          .map((e) => `Episode ${e.episodeNumber}: ${e.title}`)
          .join('\n');

  const text = `🎌 ${doc.title}\n\nEpisodes:\n\n${epList}`;
  const keyboard = {
    inline_keyboard: [
      [{ text: '➕ Add Episode', callback_data: `episode:add:${doc._id}` }],
      [{ text: '✏️ Edit Anime', callback_data: `sel:edit:anime:${doc._id}` }],
      [{ text: '🗑 Delete Anime', callback_data: `sel:delete:anime:${doc._id}` }],
      [{ text: '⬅️ Back', callback_data: 'upload:type:anime' }],
    ],
  };
  await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, reply_markup: keyboard });
}

async function showMovieItem(bot, chatId, messageId, doc) {
  const text = `🎬 ${doc.title}\n\nVideo: ${doc.videoUrl || 'Not set'}`;
  const keyboard = {
    inline_keyboard: [
      [{ text: '▶️ Add/Change Video', callback_data: `video:set:${doc._id}` }],
      [{ text: '✏️ Edit Movie', callback_data: `sel:edit:movie:${doc._id}` }],
      [{ text: '🗑 Delete Movie', callback_data: `sel:delete:movie:${doc._id}` }],
      [{ text: '⬅️ Back', callback_data: 'upload:type:movie' }],
    ],
  };
  await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, reply_markup: keyboard });
}

async function showSeriesItem(bot, chatId, messageId, doc) {
  const seasons = [...doc.seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
  const seasonLines = seasons.length === 0 ? 'No seasons yet.' : seasons.map((s) => `Season ${s.seasonNumber}`).join('\n');
  const text = `📺 ${doc.title}\n\n${seasonLines}`;
  const keyboard = {
    inline_keyboard: [
      [{ text: '➕ Add Season', callback_data: `season:add:${doc._id}` }],
      ...seasons.map((s) => [
        { text: `📂 Season ${s.seasonNumber}`, callback_data: `season:view:${doc._id}:${s.seasonNumber}` },
      ]),
      [{ text: '✏️ Edit Series', callback_data: `sel:edit:series:${doc._id}` }],
      [{ text: '🗑 Delete', callback_data: `sel:delete:series:${doc._id}` }],
      [{ text: '⬅️ Back', callback_data: 'upload:type:series' }],
    ],
  };
  await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, reply_markup: keyboard });
}

async function showSeasonEpisodes(bot, chatId, messageId, doc, seasonNumber) {
  const season = doc.seasons.find((s) => s.seasonNumber === seasonNumber);
  if (!season) {
    await bot.editMessageText('⚠️ That season no longer exists.', {
      chat_id: chatId,
      message_id: messageId,
    });
    return;
  }
  const epList =
    season.episodes.length === 0
      ? 'No episodes yet.'
      : [...season.episodes]
          .sort((a, b) => a.episodeNumber - b.episodeNumber)
          .map((e) => `Episode ${e.episodeNumber}: ${e.title}`)
          .join('\n');

  const text = `📺 ${doc.title} — Season ${seasonNumber}\n\nEpisodes:\n\n${epList}`;
  const keyboard = {
    inline_keyboard: [
      [{ text: '➕ Add Episode', callback_data: `season:episode:add:${doc._id}:${seasonNumber}` }],
      [{ text: '⬅️ Back', callback_data: `sel:upload:series:${doc._id}` }],
    ],
  };
  await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, reply_markup: keyboard });
}

export async function handleUploadCallback(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const userId = query.from.id;
  const data = query.data;
  const parts = data.split(':');

  // upload:cancel
  if (data === 'upload:cancel') {
    clearSession(userId);
    await bot.editMessageText('❌ Upload cancelled.', { chat_id: chatId, message_id: messageId });
    return;
  }

  // upload:type:<type>
  if (parts[0] === 'upload' && parts[1] === 'type') {
    const type = parts[2];
    clearSession(userId);
    await renderContentList({
      bot,
      chatId,
      messageId,
      type,
      page: 1,
      prefix: `upload:${type}`,
      selPrefix: `sel:upload:${type}`,
    });
    return;
  }

  // page:upload:<type>:<page>
  if (parts[0] === 'page' && parts[1] === 'upload') {
    const type = parts[2];
    const page = Number(parts[3]) || 1;
    await renderContentList({
      bot,
      chatId,
      messageId,
      type,
      page,
      prefix: `upload:${type}`,
      selPrefix: `sel:upload:${type}`,
    });
    return;
  }

  // sel:upload:<type>:<id>
  if (parts[0] === 'sel' && parts[1] === 'upload') {
    const type = parts[2];
    const id = parts[3];
    const doc = await Content.findById(id).lean();
    if (!doc) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ Not found. It may have been deleted.', show_alert: true });
      return;
    }
    if (type === 'anime') await showAnimeItem(bot, chatId, messageId, doc);
    else if (type === 'movie') await showMovieItem(bot, chatId, messageId, doc);
    else if (type === 'series') await showSeriesItem(bot, chatId, messageId, doc);
    return;
  }

  // episode:add:<id>  (anime episode)
  if (parts[0] === 'episode' && parts[1] === 'add') {
    const id = parts[2];
    const doc = await Content.findById(id).lean();
    if (!doc) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ Not found.', show_alert: true });
      return;
    }
    createSession(userId, 'upload', {
      subtype: 'episode',
      contentType: 'anime',
      contentId: id,
      step: 0,
      temporaryData: {},
    });
    await bot.sendMessage(chatId, 'Enter episode number:');
    return;
  }

  // video:set:<id> (movie)
  if (parts[0] === 'video' && parts[1] === 'set') {
    const id = parts[2];
    const doc = await Content.findById(id).lean();
    if (!doc) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ Not found.', show_alert: true });
      return;
    }
    createSession(userId, 'upload', {
      subtype: 'video',
      contentType: 'movie',
      contentId: id,
      step: 0,
      temporaryData: {},
    });
    await bot.sendMessage(chatId, 'Enter the video URL:');
    return;
  }

  // season:add:<id>
  if (parts[0] === 'season' && parts[1] === 'add') {
    const id = parts[2];
    const doc = await Content.findById(id).lean();
    if (!doc) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ Not found.', show_alert: true });
      return;
    }
    createSession(userId, 'upload', {
      subtype: 'season',
      contentType: 'series',
      contentId: id,
      step: 0,
      temporaryData: {},
    });
    await bot.sendMessage(chatId, 'Enter season number:');
    return;
  }

  // season:view:<id>:<seasonNumber>
  if (parts[0] === 'season' && parts[1] === 'view') {
    const id = parts[2];
    const seasonNumber = Number(parts[3]);
    const doc = await Content.findById(id).lean();
    if (!doc) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ Not found.', show_alert: true });
      return;
    }
    await showSeasonEpisodes(bot, chatId, messageId, doc, seasonNumber);
    return;
  }

  // season:episode:add:<id>:<seasonNumber>
  if (parts[0] === 'season' && parts[1] === 'episode' && parts[2] === 'add') {
    const id = parts[3];
    const seasonNumber = Number(parts[4]);
    const doc = await Content.findById(id).lean();
    if (!doc) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ Not found.', show_alert: true });
      return;
    }
    createSession(userId, 'upload', {
      subtype: 'seriesEpisode',
      contentType: 'series',
      contentId: id,
      seasonNumber,
      step: 0,
      temporaryData: {},
    });
    await bot.sendMessage(chatId, 'Enter episode number:');
    return;
  }

  // wizard:confirm / wizard:cancel — used by episode-add preview
  if (data === 'wizard:cancel') {
    clearSession(userId);
    await bot.editMessageText('❌ Cancelled.', { chat_id: chatId, message_id: messageId });
    return;
  }

  if (data === 'wizard:confirm') {
    await confirmWizard(bot, chatId, userId);
    return;
  }
}

async function confirmWizard(bot, chatId, userId) {
  const session = getSession(userId);
  if (!session || session.type !== 'upload') return;

  try {
    if (session.subtype === 'episode') {
      const doc = await Content.findById(session.contentId);
      if (!doc) throw new Error('Anime no longer exists.');
      const { episodeNumber, title, videoUrl } = session.temporaryData;
      if (doc.episodes.some((e) => e.episodeNumber === episodeNumber)) {
        await bot.sendMessage(chatId, `❌ Episode ${episodeNumber} already exists. Choose a different number or /cancel.`);
        return;
      }
      doc.episodes.push({ episodeNumber, title, videoUrl });
      await doc.save();
      clearSession(userId);
      await bot.sendMessage(chatId, `✅ Episode ${episodeNumber} added to ${doc.title}.`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Add Another', callback_data: `episode:add:${doc._id}` }],
            [{ text: '🏠 Main Menu', callback_data: 'menu:home' }],
          ],
        },
      });
    } else if (session.subtype === 'seriesEpisode') {
      const doc = await Content.findById(session.contentId);
      if (!doc) throw new Error('Series no longer exists.');
      const season = doc.seasons.find((s) => s.seasonNumber === session.seasonNumber);
      if (!season) throw new Error('Season no longer exists.');
      const { episodeNumber, title, videoUrl } = session.temporaryData;
      if (season.episodes.some((e) => e.episodeNumber === episodeNumber)) {
        await bot.sendMessage(chatId, `❌ Episode ${episodeNumber} already exists in this season. Choose a different number or /cancel.`);
        return;
      }
      season.episodes.push({ episodeNumber, title, videoUrl });
      await doc.save();
      const seasonNumber = session.seasonNumber;
      clearSession(userId);
      await bot.sendMessage(chatId, `✅ Episode ${episodeNumber} added to ${doc.title} — Season ${seasonNumber}.`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Add Another', callback_data: `season:episode:add:${doc._id}:${seasonNumber}` }],
            [{ text: '🏠 Main Menu', callback_data: 'menu:home' }],
          ],
        },
      });
    }
  } catch (err) {
    console.error('confirmWizard error:', err.message);
    clearSession(userId);
    await bot.sendMessage(chatId, `❌ Failed to save: ${err.message}`);
  }
}

// Handles free-text input for the upload wizard (episode/season/video steps).
// Returns true if the message was consumed.
export async function handleUploadText(bot, msg, session) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = (msg.text ?? '').trim();

  if (session.subtype === 'video') {
    if (!isValidUrl(text)) {
      await bot.sendMessage(chatId, '❌ Enter a valid http(s) URL. Try again:');
      return true;
    }
    try {
      const doc = await Content.findByIdAndUpdate(
        session.contentId,
        { videoUrl: text },
        { new: true }
      );
      clearSession(userId);
      if (!doc) {
        await bot.sendMessage(chatId, '⚠️ That movie no longer exists.');
        return true;
      }
      await bot.sendMessage(chatId, `✅ Video updated for ${doc.title}.`, {
        reply_markup: { inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'menu:home' }]] },
      });
    } catch (err) {
      clearSession(userId);
      await bot.sendMessage(chatId, `❌ Failed to update: ${err.message}`);
    }
    return true;
  }

  if (session.subtype === 'season') {
    if (!isPositiveInteger(text)) {
      await bot.sendMessage(chatId, '❌ Enter a valid positive whole number. Try again:');
      return true;
    }
    const seasonNumber = Number(text);
    try {
      const doc = await Content.findById(session.contentId);
      if (!doc) {
        clearSession(userId);
        await bot.sendMessage(chatId, '⚠️ That series no longer exists.');
        return true;
      }
      if (doc.seasons.some((s) => s.seasonNumber === seasonNumber)) {
        await bot.sendMessage(chatId, `❌ Season ${seasonNumber} already exists. Enter a different number or /cancel.`);
        return true;
      }
      doc.seasons.push({ seasonNumber, episodes: [] });
      await doc.save();
      clearSession(userId);
      await bot.sendMessage(chatId, `✅ Season ${seasonNumber} added to ${doc.title}.`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Add Episode', callback_data: `season:episode:add:${doc._id}:${seasonNumber}` }],
            [{ text: '⬅️ Back to Series', callback_data: `sel:upload:series:${doc._id}` }],
          ],
        },
      });
    } catch (err) {
      clearSession(userId);
      await bot.sendMessage(chatId, `❌ Failed to save: ${err.message}`);
    }
    return true;
  }

  // episode / seriesEpisode: step 0 = number, step 1 = title, step 2 = videoUrl, then preview
  if (session.subtype === 'episode' || session.subtype === 'seriesEpisode') {
    if (session.step === 0) {
      if (!isPositiveInteger(text)) {
        await bot.sendMessage(chatId, '❌ Enter a valid positive whole number. Try again:');
        return true;
      }
      session.temporaryData.episodeNumber = Number(text);
      session.step = 1;
      updateSession(userId, session);
      await bot.sendMessage(chatId, 'Enter episode title:');
      return true;
    }
    if (session.step === 1) {
      if (!isNonEmpty(text)) {
        await bot.sendMessage(chatId, '❌ Title cannot be empty. Try again:');
        return true;
      }
      session.temporaryData.title = text;
      session.step = 2;
      updateSession(userId, session);
      await bot.sendMessage(chatId, 'Enter video URL:');
      return true;
    }
    if (session.step === 2) {
      if (!isValidUrl(text)) {
        await bot.sendMessage(chatId, '❌ Enter a valid http(s) URL. Try again:');
        return true;
      }
      session.temporaryData.videoUrl = text;
      session.step = 3;
      updateSession(userId, session);

      const t = session.temporaryData;
      await bot.sendMessage(
        chatId,
        `Episode ${t.episodeNumber}\n\nTitle: ${t.title}\nVideo: ${t.videoUrl}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Add Episode', callback_data: 'wizard:confirm' }],
              [{ text: '❌ Cancel', callback_data: 'wizard:cancel' }],
            ],
          },
        }
      );
      return true;
    }
  }

  return true;
}
