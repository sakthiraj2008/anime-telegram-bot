import Anime from '../models/Anime.js';
import Episode from '../models/Episode.js';
import { getSession, setSession, clearSession, updateSession } from '../utils/session.js';
import { animePageKeyboard, episodeManageKeyboard, skipKeyboard, doneKeyboard, deleteConfirmKeyboard } from '../utils/keyboards.js';

const PAGE_SIZE = 10;

export async function startUploadEpisode(bot, msg) {
  setSession(msg.from.id, { type: 'upload_episode', step: 'select_anime', data: {} });
  await showAnimePage(bot, msg.chat.id, 1);
}

export async function showAnimePage(bot, chatId, page, editMessageId = null) {
  const total = await Anime.countDocuments();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  page = Math.min(Math.max(1, page), totalPages);
  const animes = await Anime.find().sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean();
  const text = `🎬 Select Anime\n\nChoose an anime to manage its episodes:`;
  const options = { reply_markup: animePageKeyboard(animes, page, totalPages) };
  if (editMessageId) {
    try { await bot.editMessageText(text, { chat_id: chatId, message_id: editMessageId, ...options }); return; } catch {}
  }
  await bot.sendMessage(chatId, text, options);
}

export async function showEpisodes(bot, chatId, animeId, editMessageId = null) {
  const anime = await Anime.findById(animeId).lean();
  if (!anime) return bot.sendMessage(chatId, '❌ Anime not found.');
  const episodes = await Episode.find({ animeId }).sort({ season: 1, episodeNumber: 1 }).lean();
  const lines = episodes.length ? episodes.map(e => `• S${e.season} E${e.episodeNumber} — ${e.title || 'Untitled'}`).join('\n') : 'No episodes uploaded yet.';
  const text = `📺 ${anime.name}\n\n${lines}\n\nTap an episode to delete it, or add a new episode.`;
  const options = { reply_markup: episodeManageKeyboard(episodes) };
  if (editMessageId) {
    try { await bot.editMessageText(text, { chat_id: chatId, message_id: editMessageId, ...options }); return; } catch {}
  }
  await bot.sendMessage(chatId, text, options);
}

export async function beginAddEpisode(bot, chatId, userId, animeId) {
  setSession(userId, { type: 'upload_episode', step: 'season', data: { animeId } });
  await bot.sendMessage(chatId, '📀 Enter season number (example: 1):');
}

export async function handleEpisodeText(bot, msg, session) {
  const text = (msg.text || '').trim();
  if (!text) return;
  const chatId = msg.chat.id;

  if (session.step === 'season') {
    const n = Number(text);
    if (!Number.isInteger(n) || n < 1) return bot.sendMessage(chatId, '❌ Enter a valid season number.');
    session.data.season = n;
    session.step = 'episode_number';
    setSession(msg.from.id, session);
    return bot.sendMessage(chatId, '🔢 Enter episode number:');
  }
  if (session.step === 'episode_number') {
    const n = Number(text);
    if (!Number.isInteger(n) || n < 1) return bot.sendMessage(chatId, '❌ Enter a valid episode number.');
    session.data.episodeNumber = n;
    session.step = 'title';
    setSession(msg.from.id, session);
    return bot.sendMessage(chatId, '📝 Enter episode title:');
  }
  if (session.step === 'title') {
    session.data.title = text;
    session.step = 'video';
    setSession(msg.from.id, session);
    return bot.sendMessage(chatId, '🎬 Send the video URL:');
  }
  if (session.step === 'video') {
    if (!/^https?:\/\//i.test(text)) return bot.sendMessage(chatId, '❌ Please send a valid http/https video URL.');
    session.data.videoUrl = text;
    session.step = 'audio';
    setSession(msg.from.id, session);
    return bot.sendMessage(chatId, '🎧 Send the Japanese audio URL, or press Skip.', { reply_markup: skipKeyboard('skip_audio') });
  }
  if (session.step === 'audio') {
    if (!/^https?:\/\//i.test(text)) return bot.sendMessage(chatId, '❌ Please send a valid audio URL or press Skip.');
    session.data.audioTracks = [{ label: 'Japanese', url: text }];
    session.step = 'audio2';
    setSession(msg.from.id, session);
    return bot.sendMessage(chatId, '🎧 Send the Tamil audio URL, or press Skip.', { reply_markup: skipKeyboard('skip_audio2') });
  }
  if (session.step === 'audio2') {
    if (!/^https?:\/\//i.test(text)) return bot.sendMessage(chatId, '❌ Please send a valid audio URL or press Skip.');
    session.data.audioTracks = [...(session.data.audioTracks || []), { label: 'Tamil', url: text }];
    session.step = 'subtitle';
    setSession(msg.from.id, session);
    return bot.sendMessage(chatId, '💬 Send subtitle URL (VTT/SRT), or press Skip.', { reply_markup: skipKeyboard('skip_subtitle') });
  }
  if (session.step === 'subtitle') {
    if (!/^https?:\/\//i.test(text)) return bot.sendMessage(chatId, '❌ Please send a valid subtitle URL or press Skip.');
    session.data.subtitles = [{ label: 'English', url: text }];
    return saveEpisode(bot, msg, session);
  }
}

async function saveEpisode(bot, msg, session) {
  try {
    const data = session.data;
    const exists = await Episode.findOne({ animeId: data.animeId, season: data.season || 1, episodeNumber: data.episodeNumber });
    if (exists) return bot.sendMessage(msg.chat.id, '❌ That episode already exists.');
    const episode = await Episode.create({
      animeId: data.animeId,
      season: data.season || 1,
      episodeNumber: data.episodeNumber,
      title: data.title,
      videoUrl: data.videoUrl,
      audioTracks: data.audioTracks || [],
      subtitles: data.subtitles || []
    });
    clearSession(msg.from.id);
    await bot.sendMessage(msg.chat.id, `✅ Episode added!\n\nEpisode ${episode.episodeNumber} — ${episode.title || 'Untitled'}\n🎧 Audio tracks: ${episode.audioTracks.length}\n💬 Subtitles: ${episode.subtitles.length}`, { reply_markup: doneKeyboard() });
  } catch (err) {
    console.error(err);
    await bot.sendMessage(msg.chat.id, '❌ Could not save the episode.');
  }
}

export async function handleEpisodeCallback(bot, query) {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;
  if (data === 'noop') return bot.answerCallbackQuery(query.id);

  if (data.startsWith('animepage:')) {
    const page = Number(data.split(':')[1]);
    await bot.answerCallbackQuery(query.id);
    return showAnimePage(bot, chatId, page, query.message.message_id);
  }
  if (data.startsWith('selanime:')) {
    const animeId = data.split(':')[1];
    updateSession(userId, { type: 'upload_episode', step: 'manage', data: { animeId } });
    await bot.answerCallbackQuery(query.id);
    return showEpisodes(bot, chatId, animeId, query.message.message_id);
  }
  if (data === 'addepisode') {
    const session = getSession(userId);
    if (!session?.data?.animeId) return bot.answerCallbackQuery(query.id, { text: 'Select an anime first.' });
    await bot.answerCallbackQuery(query.id);
    return beginAddEpisode(bot, chatId, userId, session.data.animeId);
  }
  if (data === 'refresh_episodes') {
    const session = getSession(userId);
    if (!session?.data?.animeId) return bot.answerCallbackQuery(query.id);
    await bot.answerCallbackQuery(query.id);
    return showEpisodes(bot, chatId, session.data.animeId, query.message.message_id);
  }
  if (data.startsWith('delep:')) {
    const id = data.split(':')[1];
    await bot.answerCallbackQuery(query.id);
    return bot.sendMessage(chatId, 'Delete this episode?', { reply_markup: deleteConfirmKeyboard(id) });
  }
  if (data.startsWith('confirmdel:')) {
    const [, id, choice] = data.split(':');
    if (choice === 'yes') {
      await Episode.findByIdAndDelete(id);
      await bot.answerCallbackQuery(query.id, { text: 'Deleted' });
    } else {
      await bot.answerCallbackQuery(query.id, { text: 'Cancelled' });
    }
    const session = getSession(userId);
    if (session?.data?.animeId) return showEpisodes(bot, chatId, session.data.animeId);
  }
  if (data === 'skip_audio') {
    const session = getSession(userId);
    if (!session) return bot.answerCallbackQuery(query.id);
    session.step = 'audio2';
    session.data.audioTracks = [];
    setSession(userId, session);
    await bot.answerCallbackQuery(query.id);
    return bot.sendMessage(chatId, '🎧 Send the Tamil audio URL, or press Skip.', { reply_markup: skipKeyboard('skip_audio2') });
  }
  if (data === 'skip_audio2') {
    const session = getSession(userId);
    if (!session) return bot.answerCallbackQuery(query.id);
    session.step = 'subtitle';
    setSession(userId, session);
    await bot.answerCallbackQuery(query.id);
    return bot.sendMessage(chatId, '💬 Send subtitle URL (VTT/SRT), or press Skip.', { reply_markup: skipKeyboard('skip_subtitle') });
  }
  if (data === 'skip_subtitle') {
    const session = getSession(userId);
    if (!session) return bot.answerCallbackQuery(query.id);
    session.data.subtitles = [];
    await bot.answerCallbackQuery(query.id);
    return saveEpisode(bot, query.message, session);
  }
  if (data === 'home') {
    clearSession(userId);
    await bot.answerCallbackQuery(query.id);
    return bot.sendMessage(chatId, '🏠 Main menu\n\n/create_anime\n/upload_episode');
  }
  await bot.answerCallbackQuery(query.id);
}
