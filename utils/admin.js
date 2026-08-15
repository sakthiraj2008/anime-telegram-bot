import { ADMIN_IDS } from '../config.js';

export function isAdmin(userId) {
  return ADMIN_IDS.includes(Number(userId));
}

export const NOT_ADMIN_MESSAGE = '⛔ You are not authorized to use this bot.';
