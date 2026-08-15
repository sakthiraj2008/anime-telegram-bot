import TelegramBot from 'node-telegram-bot-api';

import { assertConfig, BOT_TOKEN, PORT } from './config.js';
import { connectDB } from './db.js';
import { createApiApp } from './api.js';

import { isAdmin, NOT_ADMIN_MESSAGE } from './utils/admin.js';
import { getSession, clearSession } from './utils/session.js';

import {
  startCreateMenu,
  handleCreateCallback,
  handleCreateText,
} from './handlers/create.js';
import {
  startUploadMenu,
  handleUploadCallback,
  handleUploadText,
} from './handlers/upload.js';
import { startEditMenu, handleEditCallback, handleEditText } from './handlers/edit.js';
import { startDeleteMenu, handleDeleteCallback } from './handlers/delete.js';

assertConfig();
await connectDB();

// polling: true — a single instance. Do not call this more than once per
// process, and do not run two processes with the same BOT_TOKEN, or Telegram
// will report "409 Conflict: terminated by other getUpdates request".
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.on('polling_error', (err) => {
  console.error('Telegram polling error:', err.message);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

async function sendMainMenu(chatId) {
  await bot.sendMessage(
    chatId,
    '🏠 Anime Manager\n\n' +
      'Choose an action:\n\n' +
      'Commands:\n' +
      '/create – add new anime, movie or series\n' +
      '/upload – upload episodes, seasons or movie video\n' +
      '/edit – edit existing content\n' +
      '/delete – remove content\n' +
      '/cancel – cancel the current operation',
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '➕ Create', callback_data: 'menu:create' },
            { text: '📤 Upload', callback_data: 'menu:upload' },
          ],
          [
            { text: '✏️ Edit', callback_data: 'menu:edit' },
            { text: '🗑 Delete', callback_data: 'menu:delete' },
          ],
        ],
      },
    }
  );
}

function requireAdmin(userId) {
  return isAdmin(userId);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

bot.onText(/^\/start$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!requireAdmin(userId)) {
    await bot.sendMessage(chatId, NOT_ADMIN_MESSAGE);
    return;
  }
  clearSession(userId);
  await sendMainMenu(chatId);
});

bot.onText(/^\/create$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!requireAdmin(userId)) return bot.sendMessage(chatId, NOT_ADMIN_MESSAGE);
  clearSession(userId);
  await startCreateMenu(bot, chatId);
});

bot.onText(/^\/upload$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!requireAdmin(userId)) return bot.sendMessage(chatId, NOT_ADMIN_MESSAGE);
  clearSession(userId);
  await startUploadMenu(bot, chatId);
});

bot.onText(/^\/edit$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!requireAdmin(userId)) return bot.sendMessage(chatId, NOT_ADMIN_MESSAGE);
  clearSession(userId);
  await startEditMenu(bot, chatId);
});

bot.onText(/^\/delete$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!requireAdmin(userId)) return bot.sendMessage(chatId, NOT_ADMIN_MESSAGE);
  clearSession(userId);
  await startDeleteMenu(bot, chatId);
});

bot.onText(/^\/cancel$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!requireAdmin(userId)) return bot.sendMessage(chatId, NOT_ADMIN_MESSAGE);
  const hadSession = getSession(userId) !== null;
  clearSession(userId);
  await bot.sendMessage(chatId, hadSession ? '✅ Operation cancelled.' : 'Nothing to cancel.');
});

// ---------------------------------------------------------------------------
// Callback queries
// ---------------------------------------------------------------------------

bot.on('callback_query', async (query) => {
  try {
    const userId = query.from.id;

    if (!requireAdmin(userId)) {
      await bot.answerCallbackQuery(query.id, { text: NOT_ADMIN_MESSAGE, show_alert: true });
      return;
    }

    const data = query.data || '';

    if (data === 'noop') {
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === 'menu:home') {
      clearSession(userId);
      await bot.answerCallbackQuery(query.id);
      await sendMainMenu(query.message.chat.id);
      return;
    }

    if (data === 'menu:create') {
      await bot.answerCallbackQuery(query.id);
      await startCreateMenu(bot, query.message.chat.id);
      return;
    }
    if (data === 'menu:upload') {
      await bot.answerCallbackQuery(query.id);
      await startUploadMenu(bot, query.message.chat.id);
      return;
    }
    if (data === 'menu:edit') {
      await bot.answerCallbackQuery(query.id);
      await startEditMenu(bot, query.message.chat.id);
      return;
    }
    if (data === 'menu:delete') {
      await bot.answerCallbackQuery(query.id);
      await startDeleteMenu(bot, query.message.chat.id);
      return;
    }

    const prefix = data.split(':')[0];
    // "page" and "sel" callbacks are routed by their second segment.
    const routeKey = prefix === 'page' || prefix === 'sel' ? `${prefix}:${data.split(':')[1]}` : prefix;

    if (
      prefix === 'create'
    ) {
      await bot.answerCallbackQuery(query.id);
      await handleCreateCallback(bot, query);
      return;
    }

    if (
      prefix === 'upload' ||
      prefix === 'episode' ||
      prefix === 'video' ||
      prefix === 'season' ||
      prefix === 'wizard' ||
      routeKey === 'sel:upload' ||
      routeKey === 'page:upload'
    ) {
      await bot.answerCallbackQuery(query.id);
      await handleUploadCallback(bot, query);
      return;
    }

    if (prefix === 'edit' || prefix === 'field' || prefix === 'fieldval' || routeKey === 'sel:edit' || routeKey === 'page:edit') {
      await bot.answerCallbackQuery(query.id);
      await handleEditCallback(bot, query);
      return;
    }

    if (prefix === 'delete' || routeKey === 'sel:delete' || routeKey === 'page:delete') {
      await bot.answerCallbackQuery(query.id);
      await handleDeleteCallback(bot, query);
      return;
    }

    // Unknown/malformed callback data — acknowledge quietly so Telegram
    // doesn't show a spinner forever, but don't crash.
    await bot.answerCallbackQuery(query.id);
  } catch (err) {
    console.error('callback_query handler error:', err);
    try {
      await bot.answerCallbackQuery(query.id, { text: '❌ Something went wrong.', show_alert: true });
    } catch {
      /* ignore secondary failure */
    }
  }
});

// ---------------------------------------------------------------------------
// Free-text messages (wizard steps)
// ---------------------------------------------------------------------------

bot.on('message', async (msg) => {
  try {
    if (!msg.text || msg.text.startsWith('/')) return; // commands handled by onText
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!requireAdmin(userId)) return; // stay silent for plain text from non-admins

    const session = getSession(userId);
    if (!session) return; // no active wizard, nothing to do with free text

    if (session.type === 'create') {
      await handleCreateText(bot, msg, session);
    } else if (session.type === 'upload') {
      await handleUploadText(bot, msg, session);
    } else if (session.type === 'edit') {
      await handleEditText(bot, msg, session);
    }
  } catch (err) {
    console.error('message handler error:', err);
    try {
      await bot.sendMessage(msg.chat.id, '❌ Something went wrong processing that. Try /cancel and start again.');
    } catch {
      /* ignore secondary failure */
    }
  }
});

// ---------------------------------------------------------------------------
// API + bot share one process, per deployment requirement.
// ---------------------------------------------------------------------------

const app = createApiApp();
app.listen(PORT, () => {
  console.log(`🚀 API listening on port ${PORT}`);
  console.log('🤖 Telegram bot polling started');
});
