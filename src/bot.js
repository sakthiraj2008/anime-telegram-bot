import TelegramBot from 'node-telegram-bot-api';
import { connectDB } from './db.js';
import { config } from './config.js';
import { isAdmin } from './utils/admin.js';
import { getSession, isSessionExpired } from './utils/session.js';
import { startCreateAnime, handleCreateAnimeText, handleCreateAnimePhoto } from './handlers/createAnime.js';
import { startUploadEpisode, handleEpisodeText, handleEpisodeCallback } from './handlers/uploadEpisode.js';
import { createApi } from './api.js';

await connectDB();

const bot = new TelegramBot(config.botToken, { polling: true });
createApi(bot);

const menu = `🏠 Anime Manager\n\n/create_anime — create a new anime\n/upload_episode — manage episodes`;

bot.onText(/^\/start(?:@\w+)?$/, async msg => {
  if (!isAdmin(msg.from.id)) return bot.sendMessage(msg.chat.id, '⛔ Not authorized.');
  await bot.sendMessage(msg.chat.id, menu);
});

bot.onText(/^\/create_anime(?:@\w+)?$/, async msg => {
  if (!isAdmin(msg.from.id)) return bot.sendMessage(msg.chat.id, '⛔ Not authorized.');
  await startCreateAnime(bot, msg);
});

bot.onText(/^\/upload_episode(?:@\w+)?$/, async msg => {
  if (!isAdmin(msg.from.id)) return bot.sendMessage(msg.chat.id, '⛔ Not authorized.');
  await startUploadEpisode(bot, msg);
});

bot.on('callback_query', async query => {
  try {
    if (!isAdmin(query.from.id)) return bot.answerCallbackQuery(query.id, { text: 'Not authorized.' });
    await handleEpisodeCallback(bot, query);
  } catch (e) {
    console.error('Callback error:', e);
    try { await bot.answerCallbackQuery(query.id, { text: 'Something went wrong.' }); } catch {}
  }
});

bot.on('photo', async msg => {
  if (!isAdmin(msg.from.id)) return;
  const session = getSession(msg.from.id);
  if (!session || isSessionExpired(session)) return;
  if (session.type === 'create_anime') await handleCreateAnimePhoto(bot, msg, session);
});

bot.on('message', async msg => {
  if (!msg.text || msg.text.startsWith('/')) return;
  if (!isAdmin(msg.from.id)) return;
  const session = getSession(msg.from.id);
  if (!session || isSessionExpired(session)) return;
  try {
    if (session.type === 'create_anime') await handleCreateAnimeText(bot, msg, session);
    else if (session.type === 'upload_episode') await handleEpisodeText(bot, msg, session);
  } catch (e) {
    console.error('Message handler error:', e);
    await bot.sendMessage(msg.chat.id, '❌ Something went wrong. Please start the operation again.');
  }
});

bot.on('polling_error', err => console.error('Telegram polling error:', err.message));
console.log('Telegram bot started');
