import Anime from '../models/Anime.js';
import { slugify } from '../utils/slug.js';
import { clearSession, getSession, setSession } from '../utils/session.js';
import { doneKeyboard } from '../utils/keyboards.js';

export async function startCreateAnime(bot, msg) {
  setSession(msg.from.id, { type: 'create_anime', step: 'name', data: {} });
  await bot.sendMessage(msg.chat.id, '🎬 Create Anime\n\nGive me the anime name to display:');
}

export async function handleCreateAnimeText(bot, msg, session) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  if (!text) return;

  if (session.step === 'name') {
    session.data.name = text;
    session.data.slug = slugify(text);
    session.step = 'description';
    setSession(msg.from.id, session);
    return bot.sendMessage(chatId, '📖 Give me the description:');
  }
  if (session.step === 'description') {
    session.data.description = text;
    session.step = 'year';
    setSession(msg.from.id, session);
    return bot.sendMessage(chatId, '📅 Enter release year (example: 2026):');
  }
  if (session.step === 'year') {
    const year = Number(text);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) return bot.sendMessage(chatId, '❌ Enter a valid year.');
    session.data.year = year;
    session.step = 'genres';
    setSession(msg.from.id, session);
    return bot.sendMessage(chatId, '🏷 Enter genres separated by commas:');
  }
  if (session.step === 'genres') {
    session.data.genres = text.split(',').map(x => x.trim()).filter(Boolean);
    session.step = 'poster';
    setSession(msg.from.id, session);
    return bot.sendMessage(chatId, '🖼 Send the poster as a Telegram photo or send a direct image URL.');
  }
  if (session.step === 'poster' && /^https?:\/\//i.test(text)) {
    session.data.poster = { type: 'url', value: text };
    session.step = 'banner';
    setSession(msg.from.id, session);
    return bot.sendMessage(chatId, '🎨 Send the banner as a Telegram photo or send a direct image URL.');
  }
  if (session.step === 'banner' && /^https?:\/\//i.test(text)) {
    session.data.banner = { type: 'url', value: text };
    return finishCreate(bot, msg, session);
  }
  await bot.sendMessage(chatId, 'Please follow the current step.');
}

export async function handleCreateAnimePhoto(bot, msg, session) {
  if (!msg.photo?.length) return false;
  const fileId = msg.photo[msg.photo.length - 1].file_id;
  if (session.step === 'poster') {
    session.data.poster = { type: 'telegram', value: fileId };
    session.step = 'banner';
    setSession(msg.from.id, session);
    await bot.sendMessage(msg.chat.id, '🎨 Now send the banner as a Telegram photo or send a direct image URL.');
    return true;
  }
  if (session.step === 'banner') {
    session.data.banner = { type: 'telegram', value: fileId };
    await finishCreate(bot, msg, session);
    return true;
  }
  return false;
}

async function finishCreate(bot, msg, session) {
  const data = session.data;
  const exists = await Anime.findOne({ slug: data.slug });
  if (exists) {
    await bot.sendMessage(msg.chat.id, '❌ An anime with that name already exists. Use a different name.');
    clearSession(msg.from.id);
    return;
  }
  const anime = await Anime.create(data);
  clearSession(msg.from.id);
  await bot.sendMessage(msg.chat.id,
    `✅ Anime created!\n\n🎬 ${anime.name}\n🆔 ${anime._id}\n🔗 ${anime.slug}`,
    { reply_markup: doneKeyboard() }
  );
}
