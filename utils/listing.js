import Content from '../models/Content.js';
import { paginate, buildPaginationRow } from './pagination.js';

const TYPE_TITLE = {
  anime: '🎌 Select Anime',
  movie: '🎬 Select Movie',
  series: '📺 Select Series',
};

// prefix examples: "upload:anime", "edit:movie", "delete:series"
// selPrefix examples: "sel:upload:anime", "sel:edit:movie", "sel:delete:series"
export async function renderContentList({
  bot,
  chatId,
  messageId,
  type,
  page,
  prefix,
  selPrefix,
}) {
  const docs = await Content.find({ type }, { title: 1 }).sort({ title: 1 }).lean();

  if (docs.length === 0) {
    const text = `No ${type} entries found yet.`;
    const keyboard = { inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'menu:home' }]] };
    if (messageId) {
      await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, reply_markup: keyboard });
    } else {
      await bot.sendMessage(chatId, text, { reply_markup: keyboard });
    }
    return;
  }

  const { items, totalPages, currentPage } = paginate(docs, page);

  const keyboard = [
    ...items.map((doc) => [
      { text: doc.title, callback_data: `${selPrefix}:${doc._id}` },
    ]),
    buildPaginationRow(prefix, currentPage, totalPages),
    [{ text: '⬅️ Back', callback_data: 'menu:home' }],
  ];

  const text = `${TYPE_TITLE[type]}\n\nPage ${currentPage} of ${totalPages}`;

  if (messageId) {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: keyboard },
    });
  } else {
    await bot.sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
  }
}
