import Content from '../models/Content.js';
import { renderContentList } from '../utils/listing.js';
import { clearSession } from '../utils/session.js';

export async function startDeleteMenu(bot, chatId) {
  await bot.sendMessage(chatId, '🗑 Delete Content\n\nChoose content type:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎌 Anime', callback_data: 'delete:type:anime' }],
        [{ text: '🎬 Movie', callback_data: 'delete:type:movie' }],
        [{ text: '📺 Series', callback_data: 'delete:type:series' }],
        [{ text: '❌ Cancel', callback_data: 'delete:cancel' }],
      ],
    },
  });
}

export async function handleDeleteCallback(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const userId = query.from.id;
  const data = query.data;
  const parts = data.split(':');

  if (data === 'delete:cancel') {
    clearSession(userId);
    await bot.editMessageText('❌ Delete cancelled.', { chat_id: chatId, message_id: messageId });
    return;
  }

  // delete:type:<type>
  if (parts[0] === 'delete' && parts[1] === 'type') {
    const type = parts[2];
    await renderContentList({
      bot,
      chatId,
      messageId,
      type,
      page: 1,
      prefix: `delete:${type}`,
      selPrefix: `sel:delete:${type}`,
    });
    return;
  }

  // page:delete:<type>:<page>
  if (parts[0] === 'page' && parts[1] === 'delete') {
    const type = parts[2];
    const page = Number(parts[3]) || 1;
    await renderContentList({
      bot,
      chatId,
      messageId,
      type,
      page,
      prefix: `delete:${type}`,
      selPrefix: `sel:delete:${type}`,
    });
    return;
  }

  // sel:delete:<type>:<id>  -> confirmation screen
  if (parts[0] === 'sel' && parts[1] === 'delete') {
    const type = parts[2];
    const id = parts[3];
    const doc = await Content.findById(id).lean();
    if (!doc) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ Not found. It may already be deleted.', show_alert: true });
      return;
    }
    await bot.editMessageText(`⚠️ Are you sure?\n\nTitle: ${doc.title}`, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🗑 YES, DELETE', callback_data: `delete:confirm:${type}:${id}` }],
          [{ text: '❌ Cancel', callback_data: 'delete:cancel' }],
        ],
      },
    });
    return;
  }

  // delete:confirm:<type>:<id>
  if (parts[0] === 'delete' && parts[1] === 'confirm') {
    const type = parts[2];
    const id = parts[3];
    try {
      const doc = await Content.findOneAndDelete({ _id: id, type });
      if (!doc) {
        await bot.editMessageText('⚠️ That item no longer exists.', {
          chat_id: chatId,
          message_id: messageId,
        });
        return;
      }
      await bot.editMessageText(`✅ Deleted "${doc.title}".`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'menu:home' }]],
        },
      });
    } catch (err) {
      console.error('Delete error:', err.message);
      await bot.editMessageText(`❌ Failed to delete: ${err.message}`, {
        chat_id: chatId,
        message_id: messageId,
      });
    }
    return;
  }
}
