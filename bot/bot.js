const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const Anime = require('../models/Anime');

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminIds = (process.env.TELEGRAM_ADMIN_IDS || '').split(',').map(id => id.trim());

const bot = new TelegramBot(token, { polling: true });

// Helper function to check if user is admin
const isAdmin = (userId) => adminIds.includes(String(userId));

// Command: /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    `👋 *Welcome to MOBASTREAM Admin Bot!*\n\nAvailable Commands:\n• /stats - View database & episode statistics\n• /create\\_anime - Add a new anime`,
    { parse_mode: 'Markdown' }
  );
});

// Command: /stats (Shows DB connection status, anime count, total episode count)
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;

  if (!isAdmin(msg.from.id)) {
    return bot.sendMessage(chatId, '⛔ *Unauthorized:* You are not allowed to view statistics.', { parse_mode: 'Markdown' });
  }

  try {
    // 1. Check MongoDB Connection State
    // 1 = connected, 2 = connecting, 0 = disconnected
    const stateMap = { 0: '🔴 Disconnected', 1: '🟢 Connected', 2: '🟡 Connecting', 3: '🔴 Disconnecting' };
    const dbStatus = stateMap[mongoose.connection.readyState] || '🔴 Unknown';

    // 2. Count Total Anime Documents
    const totalAnime = await Anime.countDocuments();

    // 3. Count Total Episodes across all Anime documents
    const aggregateResult = await Anime.aggregate([
      {
        $project: {
          episodeCount: { $size: { $ifNull: ['$episodes', []] } }
        }
      },
      {
        $group: {
          _id: null,
          totalEpisodes: { $sum: '$episodeCount' }
        }
      }
    ]);

    const totalEpisodes = aggregateResult.length > 0 ? aggregateResult[0].totalEpisodes : 0;

    // Send formatted message
    const statsMessage = 
`📊 *MOBASTREAM System Statistics*
━━━━━━━━━━━━━━━━━━━━━━
🌐 *MongoDB:* ${dbStatus}
📺 *Total Anime:* \`${totalAnime}\`
🎬 *Total Episodes Uploaded:* \`${totalEpisodes}\`
━━━━━━━━━━━━━━━━━━━━━━`;

    bot.sendMessage(chatId, statsMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error fetching /stats:', error);
    bot.sendMessage(chatId, '❌ *Error:* Failed to retrieve database statistics.', { parse_mode: 'Markdown' });
  }
});

console.log('🤖 Telegram Bot server started with /stats support...');

module.exports = bot;
