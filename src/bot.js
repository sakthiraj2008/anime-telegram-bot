import TelegramBot from 'node-telegram-bot-api';
import express from 'express';

import { connectDB } from './db.js';
import { config } from './config.js';
import { isAdmin } from './utils/admin.js';
import { getSession, isSessionExpired } from './utils/session.js';

import {
  startCreateAnime,
  handleCreateAnimeText,
  handleCreateAnimePhoto
} from './handlers/createAnime.js';

import {
  startUploadEpisode,
  handleEpisodeText,
  handleEpisodeCallback
} from './handlers/uploadEpisode.js';

import { createApi } from './api.js';


// ======================================================
// HTTP SERVER FOR KOYEB
// ======================================================

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).send('Anime Telegram Bot is running!');
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'anime-telegram-bot'
  });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 HTTP server running on port ${PORT}`);
});


// ======================================================
// DATABASE
// ======================================================

try {
  await connectDB();

  console.log('✅ MongoDB connected');
} catch (error) {
  console.error('❌ MongoDB connection failed');
  console.error(error);

  process.exit(1);
}


// ======================================================
// TELEGRAM BOT
// ======================================================

const bot = new TelegramBot(config.botToken, {
  polling: true
});

console.log('🤖 Telegram bot starting...');


// ======================================================
// API
// ======================================================

try {
  createApi(bot);

  console.log('✅ API initialized');
} catch (error) {
  console.error('❌ API initialization failed');
  console.error(error);
}


// ======================================================
// MAIN MENU
// ======================================================

const menu = `
🏠 Anime Manager

/create_anime — Create a new anime
/upload_episode — Manage episodes
`;


// ======================================================
// /START
// ======================================================

bot.onText(/^\/start(?:@\w+)?$/, async msg => {

  try {

    if (!isAdmin(msg.from.id)) {
      await bot.sendMessage(
        msg.chat.id,
        '⛔ Not authorized.'
      );

      return;
    }

    await bot.sendMessage(
      msg.chat.id,
      menu
    );

  } catch (error) {

    console.error('/start error:', error);

  }

});


// ======================================================
// /CREATE_ANIME
// ======================================================

bot.onText(/^\/create_anime(?:@\w+)?$/, async msg => {

  try {

    if (!isAdmin(msg.from.id)) {
      await bot.sendMessage(
        msg.chat.id,
        '⛔ Not authorized.'
      );

      return;
    }

    await startCreateAnime(
      bot,
      msg
    );

  } catch (error) {

    console.error('/create_anime error:', error);

    await bot.sendMessage(
      msg.chat.id,
      '❌ Failed to start anime creation.'
    );

  }

});


// ======================================================
// /UPLOAD_EPISODE
// ======================================================

bot.onText(/^\/upload_episode(?:@\w+)?$/, async msg => {

  try {

    if (!isAdmin(msg.from.id)) {
      await bot.sendMessage(
        msg.chat.id,
        '⛔ Not authorized.'
      );

      return;
    }

    await startUploadEpisode(
      bot,
      msg
    );

  } catch (error) {

    console.error('/upload_episode error:', error);

    await bot.sendMessage(
      msg.chat.id,
      '❌ Failed to start episode upload.'
    );

  }

});


// ======================================================
// CALLBACK BUTTONS
// ======================================================

bot.on('callback_query', async query => {

  try {

    if (!isAdmin(query.from.id)) {

      await bot.answerCallbackQuery(
        query.id,
        {
          text: 'Not authorized.'
        }
      );

      return;
    }

    await handleEpisodeCallback(
      bot,
      query
    );

  } catch (error) {

    console.error(
      '❌ Callback error:',
      error
    );

    try {

      await bot.answerCallbackQuery(
        query.id,
        {
          text: 'Something went wrong.'
        }
      );

    } catch {}

  }

});


// ======================================================
// PHOTO HANDLER
// ======================================================

bot.on('photo', async msg => {

  try {

    if (!msg.from) return;

    if (!isAdmin(msg.from.id)) return;

    const session = getSession(
      msg.from.id
    );

    if (!session) return;

    if (isSessionExpired(session)) return;

    if (
      session.type === 'create_anime'
    ) {

      await handleCreateAnimePhoto(
        bot,
        msg,
        session
      );

    }

  } catch (error) {

    console.error(
      '❌ Photo handler error:',
      error
    );

  }

});


// ======================================================
// TEXT MESSAGE HANDLER
// ======================================================

bot.on('message', async msg => {

  try {

    if (!msg.from) return;

    if (!msg.text) return;

    if (msg.text.startsWith('/')) {
      return;
    }

    if (!isAdmin(msg.from.id)) {
      return;
    }

    const session = getSession(
      msg.from.id
    );

    if (!session) {
      return;
    }

    if (isSessionExpired(session)) {
      return;
    }


    // CREATE ANIME
    if (
      session.type === 'create_anime'
    ) {

      await handleCreateAnimeText(
        bot,
        msg,
        session
      );

      return;
    }


    // UPLOAD EPISODE
    if (
      session.type === 'upload_episode'
    ) {

      await handleEpisodeText(
        bot,
        msg,
        session
      );

      return;
    }

  } catch (error) {

    console.error(
      '❌ Message handler error:',
      error
    );

    try {

      await bot.sendMessage(
        msg.chat.id,
        '❌ Something went wrong. Please start the operation again.'
      );

    } catch {}

  }

});


// ======================================================
// TELEGRAM POLLING ERROR
// ======================================================

bot.on('polling_error', error => {

  console.error(
    '❌ Telegram polling error:',
    error.message
  );

});


// ======================================================
// TELEGRAM WEBHOOK ERROR
// ======================================================

bot.on('error', error => {

  console.error(
    '❌ Telegram bot error:',
    error
  );

});


// ======================================================
// FINAL STARTUP MESSAGE
// ======================================================

console.log('======================================');
console.log('🤖 ANIME TELEGRAM BOT');
console.log('======================================');
console.log('✅ Bot process started');
console.log(`🌐 HTTP port: ${PORT}`);
console.log('📡 Telegram polling: enabled');
console.log('======================================');
