const TelegramBot = require('node-telegram-bot-api');
const slugify = require('slugify');
const Anime = require('../models/Anime');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

bot.on('polling_error', (error) => console.log('Polling error:', error.message));

const ADMIN_IDS = process.env.TELEGRAM_ADMIN_IDS ? process.env.TELEGRAM_ADMIN_IDS.split(',') : [];
const sessions = new Map();

const STATES = {
    CREATE_TITLE: 'CREATE_TITLE',
    CREATE_IMDB: 'CREATE_IMDB',
    CREATE_YEAR: 'CREATE_YEAR',
    CREATE_QUALITY: 'CREATE_QUALITY',
    CREATE_LANG: 'CREATE_LANG',
    CREATE_GENRE: 'CREATE_GENRE',
    CREATE_POSTER: 'CREATE_POSTER',
    CREATE_BANNER: 'CREATE_BANNER',
    CREATE_SYNOPSIS: 'CREATE_SYNOPSIS',
    ADD_SEASON_NUM: 'ADD_SEASON_NUM',
    ADD_EP_NUM: 'ADD_EP_NUM',
    ADD_EP_TITLE: 'ADD_EP_TITLE',
    ADD_EP_SERVER1: 'ADD_EP_SERVER1',
    ADD_EP_SERVER2: 'ADD_EP_SERVER2'
};

const isAdmin = (id) => ADMIN_IDS.includes(id.toString());

const checkAuth = (msg) => {
    if (!isAdmin(msg.from.id)) {
        bot.sendMessage(msg.chat.id, "⛔ Unauthorized\n\nYou do not have permission to use MOBASTREAM CMS.");
        return false;
    }
    return true;
};

const sendAnimePage = async (chatId, page, mode = 'list') => {
    const limit = 7;
    const skip = (page - 1) * limit;
    
    const total = await Anime.countDocuments();
    const animes = await Anime.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
    
    if (animes.length === 0) {
        return bot.sendMessage(chatId, "No anime found in database.");
    }

    const totalPages = Math.ceil(total / limit);
    let text = mode === 'list' ? `📺 MOBASTREAM ANIME\n\nTotal Anime: ${total}\nPage ${page} of ${totalPages}` : `📺 SELECT ANIME\n\nPage ${page} of ${totalPages}`;
    
    const inline_keyboard = [];
    
    animes.forEach((anime, index) => {
        text += `\n${index + 1}. ${anime.title}`;
        const prefix = mode === 'delete' ? 'da_' : (mode === 'upload' ? 'sa_' : 'view_');
        inline_keyboard.push([{ text: anime.title, callback_data: `${prefix}${anime._id}` }]);
    });

    const navButtons = [];
    if (page > 1) navButtons.push({ text: '⬅️ Previous', callback_data: `page_${mode}_${page - 1}` });
    if (page < totalPages) navButtons.push({ text: '➡️ Next', callback_data: `page_${mode}_${page + 1}` });
    
    if (navButtons.length > 0) inline_keyboard.push(navButtons);

    bot.sendMessage(chatId, text, { reply_markup: { inline_keyboard } });
};

// COMMANDS
bot.onText(/\/start/, (msg) => {
    if (!checkAuth(msg)) return;
    bot.sendMessage(msg.chat.id, "🤖 MOBASTREAM Telegram CMS started.\n\nAvailable commands:\n/create_anime - Add a new anime\n/upload_episode - Add episodes\n/anime_list - View library\n/delete_anime - Remove anime\n/cancel - Cancel current operation");
});

bot.onText(/\/cancel/, (msg) => {
    if (!checkAuth(msg)) return;
    sessions.delete(msg.chat.id);
    bot.sendMessage(msg.chat.id, "❌ Operation cancelled.");
});

bot.onText(/\/anime_list/, async (msg) => {
    if (!checkAuth(msg)) return;
    await sendAnimePage(msg.chat.id, 1, 'list');
});

bot.onText(/\/upload_episode/, async (msg) => {
    if (!checkAuth(msg)) return;
    await sendAnimePage(msg.chat.id, 1, 'upload');
});

bot.onText(/\/delete_anime/, async (msg) => {
    if (!checkAuth(msg)) return;
    await sendAnimePage(msg.chat.id, 1, 'delete');
});

bot.onText(/\/create_anime/, (msg) => {
    if (!checkAuth(msg)) return;
    sessions.set(msg.chat.id, { step: STATES.CREATE_TITLE, data: {} });
    bot.sendMessage(msg.chat.id, "➕ Create New Anime\n\nEnter anime title:");
});

// MESSAGE HANDLER
bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    if (!isAdmin(msg.from.id)) return;

    const session = sessions.get(msg.chat.id);
    if (!session) return;

    const { step, data } = session;

    if (step === STATES.CREATE_TITLE) {
        data.title = msg.text;
        data.animeId = slugify(msg.text, { lower: true, strict: true });
        
        const existing = await Anime.findOne({ animeId: data.animeId });
        if (existing) {
            sessions.delete(msg.chat.id);
            return bot.sendMessage(msg.chat.id, `⚠️ Anime already exists.\n\nID: ${data.animeId}\n\nOperation cancelled.`);
        }

        session.step = STATES.CREATE_IMDB;
        bot.sendMessage(msg.chat.id, "⭐ Enter IMDb rating (e.g. 7.5):");
    } 
    else if (step === STATES.CREATE_IMDB) {
        data.imdb = msg.text;
        session.step = STATES.CREATE_YEAR;
        bot.sendMessage(msg.chat.id, "📅 Enter release year (e.g. 2024):");
    }
    else if (step === STATES.CREATE_YEAR) {
        data.year = msg.text;
        session.step = STATES.CREATE_QUALITY;
        bot.sendMessage(msg.chat.id, "📺 Enter quality (e.g. HD / FHD):");
    }
    else if (step === STATES.CREATE_QUALITY) {
        data.quality = msg.text;
        session.step = STATES.CREATE_LANG;
        bot.sendMessage(msg.chat.id, "🗣 Enter languages (comma separated, e.g. Tamil, English):");
    }
    else if (step === STATES.CREATE_LANG) {
        data.language = msg.text.split(',').map(s => s.trim());
        session.step = STATES.CREATE_GENRE;
        bot.sendMessage(msg.chat.id, "🎭 Enter genres (comma separated, e.g. Action, Fantasy):");
    }
    else if (step === STATES.CREATE_GENRE) {
        data.genre = msg.text.split(',').map(s => s.trim());
        session.step = STATES.CREATE_POSTER;
        bot.sendMessage(msg.chat.id, "🖼 Enter poster image URL/path (e.g. image/poster/wistoria.jpg):");
    }
    else if (step === STATES.CREATE_POSTER) {
        data.poster = msg.text;
        session.step = STATES.CREATE_BANNER;
        bot.sendMessage(msg.chat.id, "🖼 Enter banner image URL/path (e.g. image/banner/wistoria.jpg):");
    }
    else if (step === STATES.CREATE_BANNER) {
        data.banner = msg.text;
        session.step = STATES.CREATE_SYNOPSIS;
        bot.sendMessage(msg.chat.id, "📝 Enter synopsis / description:");
    }
    else if (step === STATES.CREATE_SYNOPSIS) {
        data.synopsis = msg.text;
        
        const preview = `━━━━━━━━━━━━━━━━━━\n📺 ANIME PREVIEW\n━━━━━━━━━━━━━━━━━━\n\nTitle:\n${data.title}\n\nID:\n${data.animeId}\n\nIMDb:\n${data.imdb}\n\nYear:\n${data.year}\n\nQuality:\n${data.quality}\n\nLanguage:\n${data.language.join(', ')}\n\nGenre:\n${data.genre.join(', ')}\n\nPoster:\n${data.poster}\n\nBanner:\n${data.banner}\n\nSynopsis:\n${data.synopsis}\n━━━━━━━━━━━━━━━━━━`;
        
        bot.sendMessage(msg.chat.id, preview, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✅ Confirm', callback_data: 'create_anime_confirm' }],
                    [{ text: '❌ Cancel', callback_data: 'cancel_op' }]
                ]
            }
        });
    }
    else if (step === STATES.ADD_SEASON_NUM) {
        const sNum = parseInt(msg.text);
        if (isNaN(sNum)) return bot.sendMessage(msg.chat.id, "Please enter a valid number.");
        data.seasonNum = sNum;
        
        bot.sendMessage(msg.chat.id, `Create Season ${sNum}?`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: `✅ Create Season ${sNum}`, callback_data: `cfm_add_s_${data.animeMongoId}` }],
                    [{ text: '❌ Cancel', callback_data: 'cancel_op' }]
                ]
            }
        });
    }
    else if (step === STATES.ADD_EP_NUM) {
        const eNum = parseInt(msg.text);
        if (isNaN(eNum)) return bot.sendMessage(msg.chat.id, "Please enter a valid number.");
        data.epNum = eNum;
        session.step = STATES.ADD_EP_TITLE;
        bot.sendMessage(msg.chat.id, "📝 Enter episode title (or send - to leave blank):");
    }
    else if (step === STATES.ADD_EP_TITLE) {
        data.epTitle = msg.text === '-' ? '' : msg.text;
        session.step = STATES.ADD_EP_SERVER1;
        bot.sendMessage(msg.chat.id, "🔗 Enter Server 1 URL:");
    }
    else if (step === STATES.ADD_EP_SERVER1) {
        data.server1 = msg.text;
        session.step = STATES.ADD_EP_SERVER2;
        bot.sendMessage(msg.chat.id, "🔗 Enter Server 2 URL (or send - to leave blank):");
    }
    else if (step === STATES.ADD_EP_SERVER2) {
        data.server2 = msg.text === '-' ? '' : msg.text;

        const preview = `━━━━━━━━━━━━━━━━━━\n🎬 EPISODE PREVIEW\n━━━━━━━━━━━━━━━━━━\n\nAnime:\n${data.animeTitle}\n\nSeason:\n${data.seasonNum}\n\nEpisode:\n${data.epNum}\n\nTitle:\n${data.epTitle || '(None)'}\n\nServer 1:\n${data.server1}\n\nServer 2:\n${data.server2 || '(None)'}\n━━━━━━━━━━━━━━━━━━`;
        
        bot.sendMessage(msg.chat.id, preview, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✅ Confirm', callback_data: `cfm_add_e_${data.animeMongoId}` }],
                    [{ text: '❌ Cancel', callback_data: 'cancel_op' }]
                ]
            }
        });
    }
});

// CALLBACK HANDLER
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const msgId = query.message.message_id;
    const data = query.data;

    if (!isAdmin(query.from.id)) return bot.answerCallbackQuery(query.id, { text: "Unauthorized", show_alert: true });

    try {
        if (data === 'cancel_op') {
            sessions.delete(chatId);
            bot.editMessageText("❌ Operation cancelled.", { chat_id: chatId, message_id: msgId });
        }
        else if (data.startsWith('page_')) {
            const parts = data.split('_');
            const mode = parts[1];
            const page = parseInt(parts[2]);
            await bot.deleteMessage(chatId, msgId);
            await sendAnimePage(chatId, page, mode);
        }
        else if (data === 'create_anime_confirm') {
            const session = sessions.get(chatId);
            if (!session || !session.data.title) return bot.sendMessage(chatId, "Session expired.");
            
            await bot.editMessageText("⏳ Saving anime to MongoDB...", { chat_id: chatId, message_id: msgId });
            
            try {
                const newAnime = new Anime({ ...session.data, seasons: [] });
                await newAnime.save();
                
                const successMsg = `🟢 MongoDB received the request successfully.\n\n✅ Anime created successfully!\n\nTitle:\n${newAnime.title}\n\nAnime ID:\n${newAnime.animeId}\n\nMongoDB:\nINSERT ✓`;
                bot.editMessageText(successMsg, { chat_id: chatId, message_id: msgId });
                sessions.delete(chatId);
            } catch (err) {
                bot.editMessageText(`🔴 MongoDB did not receive the request.\n\n❌ Anime creation failed.\nError: ${err.message}`, { chat_id: chatId, message_id: msgId });
            }
        }
        else if (data.startsWith('da_')) {
            const id = data.split('_')[1];
            const anime = await Anime.findById(id);
            if (!anime) return bot.sendMessage(chatId, "Anime not found.");

            const text = `⚠️ DELETE ANIME?\n\nTitle:\n${anime.title}\n\nWARNING:\nThis will delete the anime and all associated seasons/episodes.`;
            bot.editMessageText(text, { chat_id: chatId, message_id: msgId, reply_markup: {
                inline_keyboard: [
                    [{ text: '🗑 Delete Everything', callback_data: `cda_${id}` }],
                    [{ text: '❌ Cancel', callback_data: 'cancel_op' }]
                ]
            }});
        }
        else if (data.startsWith('cda_')) {
            const id = data.split('_')[1];
            await bot.editMessageText("⏳ Deleting from MongoDB...", { chat_id: chatId, message_id: msgId });
            try {
                await Anime.findByIdAndDelete(id);
                bot.editMessageText(`🟢 MongoDB received the request successfully.\n\n✅ Anime deleted successfully.\n\nMongoDB:\nDELETE ✓`, { chat_id: chatId, message_id: msgId });
            } catch (err) {
                bot.editMessageText(`🔴 MongoDB did not receive the request.\n\n❌ Deletion failed.`, { chat_id: chatId, message_id: msgId });
            }
        }
        else if (data.startsWith('sa_')) {
            const id = data.split('_')[1];
            const anime = await Anime.findById(id);
            
            let text = `━━━━━━━━━━━━━━━━━━\n📺 ${anime.title.toUpperCase()}\n━━━━━━━━━━━━━━━━━━\n\n`;
            const keyboard = [];

            if (anime.seasons.length === 0) {
                text += "No seasons found.\n";
            } else {
                anime.seasons.forEach(s => {
                    text += `\nSEASON ${s.seasonNumber}\n`;
                    s.episodes.forEach(e => {
                        text += `Episode ${e.episodeNumber} — ${e.episodeTitle || 'Untitled'}\n`;
                    });
                });
            }

            keyboard.push([{ text: '➕ Add Episode', callback_data: `sls_${id}` }]);
            keyboard.push([{ text: '➕ Add Season', callback_data: `as_${id}` }]);
            keyboard.push([{ text: '🗑 Delete an Episode', callback_data: `dls_${id}` }]);
            keyboard.push([{ text: '🔙 Back', callback_data: `page_upload_1` }]);

            bot.editMessageText(text, { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: keyboard } });
        }
        else if (data.startsWith('as_')) {
            const id = data.split('_')[1];
            sessions.set(chatId, { step: STATES.ADD_SEASON_NUM, data: { animeMongoId: id } });
            bot.sendMessage(chatId, "📁 Enter new season number:");
        }
        else if (data.startsWith('cfm_add_s_')) {
            const id = data.split('_')[3];
            const session = sessions.get(chatId);
            
            await bot.editMessageText(`⏳ Creating Season ${session.data.seasonNum}...`, { chat_id: chatId, message_id: msgId });
            try {
                await Anime.findByIdAndUpdate(id, { $push: { seasons: { seasonNumber: session.data.seasonNum, episodes: [] } } });
                bot.editMessageText(`🟢 MongoDB received the request successfully.\n\n✅ Season ${session.data.seasonNum} created successfully.\n\nMongoDB:\nUPDATE ✓`, { chat_id: chatId, message_id: msgId });
                sessions.delete(chatId);
            } catch (err) {
                bot.editMessageText(`🔴 MongoDB did not receive the request.\n\n❌ Season creation failed.`, { chat_id: chatId, message_id: msgId });
            }
        }
        else if (data.startsWith('sls_')) {
            const id = data.split('_')[1];
            const anime = await Anime.findById(id);
            const keyboard = [];
            
            anime.seasons.forEach(s => {
                keyboard.push([{ text: `Season ${s.seasonNumber}`, callback_data: `ae_${id}_${s.seasonNumber}` }]);
            });
            keyboard.push([{ text: '🔙 Back', callback_data: `sa_${id}` }]);

            bot.editMessageText("📁 SELECT SEASON", { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: keyboard } });
        }
        else if (data.startsWith('ae_')) {
            const parts = data.split('_');
            const id = parts[1];
            const sNum = parseInt(parts[2]);
            const anime = await Anime.findById(id);
            
            sessions.set(chatId, { 
                step: STATES.ADD_EP_NUM, 
                data: { animeMongoId: id, animeTitle: anime.title, seasonNum: sNum } 
            });
            bot.sendMessage(chatId, "🎬 Enter episode number:");
        }
        else if (data.startsWith('cfm_add_e_')) {
            const session = sessions.get(chatId);
            const id = session.data.animeMongoId;
            
            await bot.editMessageText("⏳ Saving episode to MongoDB...", { chat_id: chatId, message_id: msgId });
            
            try {
                const anime = await Anime.findById(id);
                const seasonIndex = anime.seasons.findIndex(s => s.seasonNumber === session.data.seasonNum);
                
                const exists = anime.seasons[seasonIndex].episodes.find(e => e.episodeNumber === session.data.epNum);
                if (exists) {
                    return bot.editMessageText(`⚠️ Episode already exists.\n\nEpisode: ${session.data.epNum}\nTitle: ${exists.episodeTitle}\n\nOperation Cancelled.`, { chat_id: chatId, message_id: msgId });
                }

                anime.seasons[seasonIndex].episodes.push({
                    episodeNumber: session.data.epNum,
                    episodeTitle: session.data.epTitle,
                    servers: {
                        server1: session.data.server1,
                        server2: session.data.server2
                    }
                });
                
                anime.seasons[seasonIndex].episodes.sort((a,b) => a.episodeNumber - b.episodeNumber);
                
                // Recalculate catalog totals
                let totalEpCount = 0;
                anime.seasons.forEach(s => totalEpCount += s.episodes.length);
                anime.totalEpisodes = totalEpCount;
                anime.latestEpisode = session.data.epNum;
                anime.isNewEpisode = true;

                await anime.save();
                
                const successMsg = `🟢 MongoDB received the request successfully.\n\n✅ Episode added successfully!\n\n📺 ${session.data.animeTitle}\n📁 Season ${session.data.seasonNum}\n🎬 Episode ${session.data.epNum}\n📝 ${session.data.epTitle || '(None)'}\n\nMongoDB:\nINSERT ✓`;
                bot.editMessageText(successMsg, { chat_id: chatId, message_id: msgId });
                sessions.delete(chatId);

            } catch (err) {
                bot.editMessageText(`🔴 MongoDB did not receive the request.\n\n❌ Episode could not be added.\nError: ${err.message}`, { chat_id: chatId, message_id: msgId });
            }
        }
        else if (data.startsWith('dls_')) {
            const id = data.split('_')[1];
            const anime = await Anime.findById(id);
            const keyboard = [];
            anime.seasons.forEach(s => {
                keyboard.push([{ text: `Season ${s.seasonNumber}`, callback_data: `dle_${id}_${s.seasonNumber}` }]);
            });
            keyboard.push([{ text: '🔙 Back', callback_data: `sa_${id}` }]);
            bot.editMessageText("📁 SELECT SEASON TO DELETE EPISODE FROM:", { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: keyboard }});
        }
        else if (data.startsWith('dle_')) {
            const parts = data.split('_');
            const id = parts[1];
            const sNum = parseInt(parts[2]);
            const anime = await Anime.findById(id);
            const s = anime.seasons.find(sec => sec.seasonNumber === sNum);
            
            const keyboard = [];
            s.episodes.forEach(e => {
                keyboard.push([{ text: `🗑 Ep ${e.episodeNumber} - ${e.episodeTitle || 'Untitled'}`, callback_data: `de_${id}_${sNum}_${e.episodeNumber}` }]);
            });
            keyboard.push([{ text: '🔙 Back', callback_data: `sa_${id}` }]);
            bot.editMessageText(`Select episode to delete from Season ${sNum}:`, { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: keyboard }});
        }
        else if (data.startsWith('de_')) {
            const parts = data.split('_');
            const id = parts[1];
            const sNum = parts[2];
            const eNum = parts[3];
            
            const anime = await Anime.findById(id);
            const ep = anime.seasons.find(s => s.seasonNumber == sNum).episodes.find(e => e.episodeNumber == eNum);

            const text = `⚠️ DELETE EPISODE?\n\nAnime:\n${anime.title}\n\nSeason:\n${sNum}\n\nEpisode:\n${eNum}\n\nTitle:\n${ep.episodeTitle || '(None)'}\n\nThis action cannot be undone.`;
            
            bot.editMessageText(text, { chat_id: chatId, message_id: msgId, reply_markup: {
                inline_keyboard: [
                    [{ text: '🗑 Yes, Delete', callback_data: `cde_${id}_${sNum}_${eNum}` }],
                    [{ text: '❌ Cancel', callback_data: 'cancel_op' }]
                ]
            }});
        }
        else if (data.startsWith('cde_')) {
            const parts = data.split('_');
            const id = parts[1];
            const sNum = parseInt(parts[2]);
            const eNum = parseInt(parts[3]);

            await bot.editMessageText("⏳ Deleting from MongoDB...", { chat_id: chatId, message_id: msgId });
            
            try {
                const anime = await Anime.findById(id);
                const sIndex = anime.seasons.findIndex(s => s.seasonNumber === sNum);
                
                anime.seasons[sIndex].episodes = anime.seasons[sIndex].episodes.filter(e => e.episodeNumber !== eNum);

                let totalEpCount = 0;
                anime.seasons.forEach(s => totalEpCount += s.episodes.length);
                anime.totalEpisodes = totalEpCount;

                await anime.save();

                bot.editMessageText(`🟢 MongoDB received the request successfully.\n\n✅ Episode deleted successfully.\n\nMongoDB:\nDELETE ✓`, { chat_id: chatId, message_id: msgId });
            } catch (err) {
                bot.editMessageText(`🔴 MongoDB did not receive the request.\n\n❌ Episode deletion failed.`, { chat_id: chatId, message_id: msgId });
            }
        }
        
    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, "⚠️ An unexpected error occurred. Type /cancel and try again.");
    }

    bot.answerCallbackQuery(query.id);
});

module.exports = bot;
