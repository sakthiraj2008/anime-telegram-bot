# Anime Telegram + MongoDB Bot

A GitHub-ready Node.js Telegram admin bot for managing anime and episodes in MongoDB.

## Features
- `/create_anime` guided anime creation
- `/upload_episode` paginated anime selector
- Episode add/delete UI
- Video URL, optional audio URL, optional subtitle URL
- Optional Telegram photo upload for poster/banner; website gets images through a secure bot proxy
- MongoDB persistence
- Express JSON API for your anime website
- Admin-only commands and callbacks

## GitHub-only deployment
1. Upload this project to GitHub.
2. Create MongoDB Atlas database and copy its connection string.
3. Create a Telegram bot with BotFather and copy the token.
4. Deploy the repository to Render/Koyeb as a Node web service.
5. Add the variables from `.env.example` as environment variables.
6. Build command: `npm install`
7. Start command: `npm start`

## Telegram images
When asked for poster/banner, send a Telegram photo. The bot stores the Telegram `file_id` in MongoDB. The API returns a proxy URL instead of exposing the bot token.

## Website API
- `GET /api/health`
- `GET /api/animes`
- `GET /api/animes/:slug`
- `GET /api/animes/:slug/episodes`
- `GET /api/media/:fileId`

If your frontend and API are on different domains, use the API URL as the base for media/JSON requests.
