async function showStartMenu(bot, chatId) {
  const message = `
👋 <b>Welcome to Anime Manager!</b>

🎌 Manage your anime collection directly from Telegram.

Choose what you want to do:
`;

  await bot.sendMessage(chatId, message, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "➕ Create Anime",
            callback_data: "create_anime"
          },
          {
            text: "📺 Upload Episode",
            callback_data: "upload_episode"
          }
        ],
        [
          {
            text: "📚 Anime List",
            callback_data: "anime_list"
          }
        ]
      ]
    }
  });
}

module.exports = {
  showStartMenu
};
