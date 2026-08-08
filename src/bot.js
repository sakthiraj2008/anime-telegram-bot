import TelegramBot from 'node-telegram-bot-api';

import { connectDB } from './db.js';
import { config } from './config.js';
import { isAdmin } from './utils/admin.js';
import {
  getSession,
  isSessionExpired
} from './utils/session.js';

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


// ============================================================
// DATABASE
// ============================================================

await connectDB();


// ============================================================
// TELEGRAM BOT
// ============================================================

const bot = new TelegramBot(config.botToken, {
  polling: true
});


// ============================================================
// API / HEALTH SERVER
// ============================================================

createApi(bot);


// ============================================================
// MENU
// ============================================================

const menu = `
🏠 Anime Manager

/create_anime — Create a new anime
/upload_episode — Manage episodes
`;


// ============================================================
// /START
// ============================================================

bot.onText(/^\/start(?:@\w+)?$/, async (msg) => {
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


// ============================================================
// /CREATE_ANIME
// ============================================================

bot.onText(/^\/create_anime(?:@\w+)?$/, async (msg) => {
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


// ============================================================
// /UPLOAD_EPISODE
// ============================================================

bot.onText(/^\/upload_episode(?:@\w+)?$/, async (msg) => {
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
      '❌ Failed to start episode manager.'
    );
  }
});


// ============================================================
// CALLBACK BUTTONS
// ============================================================

bot.on('callback_query', async (query) => {
  try {

    if (!isAdmin(query.from.id)) {

      await bot.answerCallbackQuery(
        query.id,
        {
          text: '⛔ Not authorized.'
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
      'Callback error:',
      error
    );

    try {
      await bot.answerCallbackQuery(
        query.id,
        {
          text: '❌ Something went wrong.'
        }
      );
    } catch {}
  }
});


// ============================================================
// PHOTO HANDLER
// Used while creating an anime
// ============================================================

bot.on('photo', async (msg) => {

  try {

    if (!msg.from) return;

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

    if (session.type !== 'create_anime') {
      return;
    }

    await handleCreateAnimePhoto(
      bot,
      msg,
      session
    );

  } catch (error) {

    console.error(
      'Photo handler error:',
      error
    );

    try {
      await bot.sendMessage(
        msg.chat.id,
        '❌ Failed to process the image.'
      );
    } catch {}
  }
});


// ============================================================
// TEXT MESSAGE HANDLER
// ============================================================

bot.on('message', async (msg) => {

  try {

    // Ignore messages without text
    if (!msg.text) {
      return;
    }

    // Ignore commands
    if (msg.text.startsWith('/')) {
      return;
    }

    // Admin only
    if (!msg.from) {
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


    // --------------------------------------------------------
    // CREATE ANIME
    // --------------------------------------------------------

    if (session.type === 'create_anime') {

      await handleCreateAnimeText(
        bot,
        msg,
        session
      );

      return;
    }


    // --------------------------------------------------------
    // UPLOAD EPISODE
    // --------------------------------------------------------

    if (session.type === 'upload_episode') {

      await handleEpisodeText(
        bot,
        msg,
        session
      );

      return;
    }

  } catch (error) {

    console.error(
      'Message handler error:',
      error
    );

    try {

      await bot.sendMessage(
        msg.chat.id,
        '❌ Something went wrong.\n\nPlease start the operation again.'
      );

    } catch {}
  }
});


// ============================================================
// TELEGRAM POLLING ERROR
// ============================================================

bot.on(
  'polling_error',
  (error) => {

    console.error(
      'Telegram polling error:',
      error.message
    );

  }
);


// ============================================================
// BOT STARTED
// ============================================================

console.log(
  '🤖 Telegram bot started successfully'
);
