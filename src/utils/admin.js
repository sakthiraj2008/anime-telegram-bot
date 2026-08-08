import { config } from '../config.js';

export function isAdmin(userId) {
  return config.adminIds.includes(Number(userId));
}

export async function requireAdmin(bot, msg) {
  if (!isAdmin(msg.from?.id)) {
    await bot.sendMessage(msg.chat.id, '⛔ You are not authorized to use this bot.');
    return false;
  }
  return true;
}
