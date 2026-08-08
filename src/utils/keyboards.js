import { Markup } from './markup.js';

export function skipKeyboard(action) {
  return { inline_keyboard: [[{ text: '⏭ Skip', callback_data: action }]] };
}

export function confirmKeyboard(prefix) {
  return { inline_keyboard: [[
    { text: '✅ Confirm', callback_data: `${prefix}:yes` },
    { text: '❌ Cancel', callback_data: `${prefix}:no` }
  ]] };
}

export function animePageKeyboard(animes, page, totalPages) {
  const rows = animes.map(a => [{ text: a.name.slice(0, 55), callback_data: `selanime:${a._id}` }]);
  const nav = [];
  if (page > 1) nav.push({ text: '◀️', callback_data: `animepage:${page - 1}` });
  nav.push({ text: `${page} / ${totalPages}`, callback_data: 'noop' });
  if (page < totalPages) nav.push({ text: '▶️', callback_data: `animepage:${page + 1}` });
  rows.push(nav);
  return { inline_keyboard: rows };
}

export function episodeManageKeyboard(episodes) {
  const rows = episodes.map(e => [{
    text: `Episode ${e.episodeNumber} - ${(e.title || 'Untitled').slice(0, 35)}`,
    callback_data: `delep:${e._id}`
  }]);
  rows.push([{ text: '➕ Add Episode', callback_data: 'addepisode' }]);
  rows.push([{ text: '🔄 Refresh', callback_data: 'refresh_episodes' }]);
  return { inline_keyboard: rows };
}

export function deleteConfirmKeyboard(id) {
  return { inline_keyboard: [[
    { text: '🗑 Delete', callback_data: `confirmdel:${id}:yes` },
    { text: '↩️ Cancel', callback_data: `confirmdel:${id}:no` }
  ]] };
}

export function doneKeyboard() {
  return { inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'home' }]] };
}
