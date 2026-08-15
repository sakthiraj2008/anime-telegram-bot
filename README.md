# Anime Telegram Admin CMS Bot

A Telegram bot for managing an anime/movie/series streaming website's content.
MongoDB Atlas is the single source of truth. The website reads content through
a REST API that runs in the same Node.js process as the bot.

```
Telegram Admin Bot → Node.js → MongoDB Atlas → REST API → Website
```

## Project structure

```
anime-telegram-bot/
├── bot.js              Telegram bot + starts the API server
├── api.js               Express REST API for the website
├── db.js                MongoDB connection
├── config.js             Env var loading/validation
├── package.json
├── .env.example
├── .gitignore
├── models/
│   └── Content.js       Single Mongoose model for anime/movie/series
├── handlers/
│   ├── create.js        /create wizard
│   ├── upload.js        /upload wizard (episodes, seasons, movie video)
│   ├── edit.js           /edit wizard (per-field editing)
│   └── delete.js         /delete wizard (with confirmation)
└── utils/
    ├── admin.js          Admin allow-list check
    ├── session.js        In-memory per-admin session store (15 min timeout)
    ├── pagination.js      10-items-per-page inline keyboards
    └── listing.js         Shared paginated content-list renderer
    └── validation.js      Field validators
```

## 1. Install dependencies

```bash
cd anime-telegram-bot
npm install
```

## 2. Create a MongoDB Atlas database

1. Go to https://www.mongodb.com/cloud/atlas and create a free account.
2. Create a new **Project**, then build a free **M0 cluster**.
3. Under **Database Access**, create a database user with a username/password.
4. Under **Network Access**, add `0.0.0.0/0` (allow from anywhere) so your
   host (Koyeb/Render) can connect — or add that host's specific IP ranges.
5. Click **Connect → Drivers**, copy the connection string. It looks like:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/animeDB?retryWrites=true&w=majority
   ```
6. Put that full string in `MONGODB_URI`.

## 3. Create the Telegram bot with BotFather

1. Open Telegram, search for **@BotFather**.
2. Send `/newbot`, choose a name and a username ending in `bot`.
3. BotFather replies with a token like `123456789:AAExampleTokenHere`.
4. Put it in `BOT_TOKEN`.

## 4. Find your Telegram admin ID

1. Open Telegram, search for **@userinfobot** (or **@RawDataBot**).
2. Start a chat with it — it replies with your numeric user ID.
3. Put it in `ADMIN_IDS`. For multiple admins, separate with commas:
   ```
   ADMIN_IDS=111111111,222222222
   ```

## 5. Environment variables

Copy the example file and fill it in:

```bash
cp .env.example .env
```

| Variable      | Description                                              |
|---------------|------------------------------------------------------------|
| `BOT_TOKEN`   | Token from BotFather                                       |
| `MONGODB_URI` | MongoDB Atlas connection string                            |
| `ADMIN_IDS`   | Comma-separated Telegram numeric user IDs allowed to use the bot |
| `PORT`        | Port for the REST API / health check (default `3000`)      |
| `WEB_API_KEY` | Secret your website sends as the `X-API-Key` header        |

## 6. Local testing

```bash
npm start
```

You should see:

```
✅ MongoDB connected
🚀 API listening on port 3000
🤖 Telegram bot polling started
```

Then in Telegram, message your bot with `/start`. If your ID is in
`ADMIN_IDS` you'll see the main menu; otherwise you'll get
"⛔ You are not authorized to use this bot."

Check the API locally:

```bash
curl http://localhost:3000/health
curl -H "X-API-Key: YOUR_KEY" http://localhost:3000/api/anime
```

## 7. Upload to GitHub

```bash
git init
git add .
git commit -m "Initial commit: anime telegram admin CMS bot"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

`.env` is already in `.gitignore`, so your secrets will not be pushed.

## 8. Deploy to Koyeb

1. Sign in at https://www.koyeb.com and click **Create App**.
2. Choose **GitHub** as the source, select your repo and the `main` branch.
3. Runtime: **Node.js** (buildpack auto-detects `package.json`).
4. Build command: `npm install` (default). Run command: `npm start`.
5. Under **Environment variables**, add `BOT_TOKEN`, `MONGODB_URI`,
   `ADMIN_IDS`, `PORT`, `WEB_API_KEY` with your real values.
6. Deploy. Koyeb gives you a public HTTPS URL for the API — the bot itself
   uses long polling, so no public URL or webhook is required for Telegram.
7. **Only run one instance/replica.** Two processes polling the same
   `BOT_TOKEN` at once causes Telegram to return
   `409 Conflict: terminated by other getUpdates request` and one instance
   will stop working. Keep the service at a single replica.

(Render or any other Node.js host works the same way — set the same env
vars, build with `npm install`, run with `npm start`.)

## 9. Connect your website to the API

From your website's backend (never from frontend JS, to avoid exposing the
key), call the API with the shared secret:

```js
const res = await fetch('https://your-koyeb-app.koyeb.app/api/anime', {
  headers: { 'X-API-Key': process.env.WEB_API_KEY },
});
const anime = await res.json();
```

Available endpoints:

| Method | Path                      | Description                          |
|--------|---------------------------|----------------------------------------|
| GET    | `/health`                 | `{ status, database }` — no key needed |
| GET    | `/api/content`             | All content                           |
| GET    | `/api/content/:id`         | One item by ID                        |
| GET    | `/api/content/type/:type`  | Filter by `anime`/`movie`/`series`    |
| GET    | `/api/anime`                | All anime                             |
| GET    | `/api/movies`               | All movies                            |
| GET    | `/api/series`                | All series                            |
| GET    | `/api/genres`                | Distinct list of genres               |
| GET    | `/api/search?q=`             | Case-insensitive title search         |

All `/api/*` routes require the header `X-API-Key: <WEB_API_KEY>`.
Never put `MONGODB_URI` or `WEB_API_KEY` in frontend JavaScript — only call
the API from your website's server/backend.

## 10. Telegram commands

| Command   | What it does                                     |
|-----------|---------------------------------------------------|
| `/start`  | Shows the main menu (admins only)                 |
| `/create` | Create a new anime, movie or series                |
| `/upload` | Add episodes, seasons, or a movie's video URL      |
| `/edit`   | Edit a single field on existing content            |
| `/delete` | Delete content, with a confirmation step           |
| `/cancel` | Cancel whatever wizard is currently in progress    |

## 11. Example MongoDB documents

**Anime**
```json
{
  "_id": "665f1c2e8a1b2c3d4e5f6789",
  "type": "anime",
  "title": "Solo Leveling",
  "imdb": "8.7",
  "year": "2024",
  "poster": "https://example.com/poster.jpg",
  "banner": "https://example.com/banner.jpg",
  "description": "A weak hunter gains the power to level up infinitely.",
  "genre": ["Action", "Fantasy", "Adventure"],
  "status": "Ongoing",
  "episodes": [
    { "episodeNumber": 1, "title": "I'm Used to It", "videoUrl": "https://example.com/ep1.mp4" }
  ],
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

**Movie**
```json
{
  "type": "movie",
  "title": "Your Name",
  "imdb": "8.4",
  "year": "2016",
  "videoUrl": "https://example.com/your-name.mp4",
  "genre": ["Romance", "Drama"],
  "status": "Completed"
}
```

**Series**
```json
{
  "type": "series",
  "title": "Arcane",
  "seasons": [
    {
      "seasonNumber": 1,
      "episodes": [
        { "episodeNumber": 1, "title": "Welcome to the Playground", "videoUrl": "https://example.com/s1e1.mp4" }
      ]
    }
  ]
}
```

## 12. Troubleshooting

- **`❌ Missing required environment variable(s): ...`** — one of
  `BOT_TOKEN`, `MONGODB_URI`, `ADMIN_IDS`, `WEB_API_KEY` isn't set. Check
  your `.env` file or your host's environment variable settings.
- **`409 Conflict: terminated by other getUpdates request`** — another
  process (locally or on a second deploy) is polling with the same
  `BOT_TOKEN`. Stop the other instance, or set the host to run exactly one
  replica.
- **`⛔ You are not authorized to use this bot.`** — your Telegram user ID
  isn't in `ADMIN_IDS`. Re-check the ID from @userinfobot and the env var.
- **MongoDB connection errors on startup** — verify the connection string,
  that the database user's password has no unescaped special characters,
  and that Network Access in Atlas allows your host's IP (or `0.0.0.0/0`).
- **`401 Unauthorized` from the API** — the website isn't sending
  `X-API-Key`, or it doesn't match `WEB_API_KEY`.
- **A session seems "stuck"** — sessions auto-expire after 15 minutes of
  inactivity; send `/cancel` at any time to clear it immediately.
- **Buttons show "Not found"** — the item was likely deleted in a separate
  session between when the list was shown and the button was tapped.
