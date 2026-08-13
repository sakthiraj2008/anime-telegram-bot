"""
Main entry point. Run with:  python bot.py

Runs two things side by side:
  1. The Telegram bot (polling) — /create_anime, /upload_episode, etc.
  2. A tiny read-only JSON API (api_server.py) that your static site can
     call with fetch() to display the anime/episode data. This also
     doubles as the health check endpoint Koyeb's free Web Service needs.
"""
import logging
import threading

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

from config import BOT_TOKEN
from handlers.create_anime import build_create_anime_handler
from handlers.upload_episode import build_upload_episode_handler
from api_server import start_api_server

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "👋 Anime DB manager bot.\n\n"
        "/create_anime — add a new anime to MongoDB\n"
        "/upload_episode — manage seasons/episodes for an existing anime\n"
        "/cancel — cancel whatever you're doing"
    )


def main():
    # API + health-check server runs in a background thread so Koyeb sees
    # the service as up, and your static site has something to fetch() from.
    threading.Thread(target=start_api_server, daemon=True).start()

    app = Application.builder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(build_create_anime_handler())
    app.add_handler(build_upload_episode_handler())

    logger.info("Bot starting...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
