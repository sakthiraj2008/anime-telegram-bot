import dotenv from 'dotenv';

dotenv.config();

function parseAdminIds(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
}

export const BOT_TOKEN = process.env.BOT_TOKEN;
export const MONGODB_URI = process.env.MONGODB_URI;
export const ADMIN_IDS = parseAdminIds(process.env.ADMIN_IDS);
export const PORT = Number(process.env.PORT) || 3000;
export const WEB_API_KEY = process.env.WEB_API_KEY;

// How long an admin's in-progress wizard (create/upload/edit/delete) stays alive
// without any activity before it is silently discarded.
export const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

export function assertConfig() {
  const missing = [];
  if (!BOT_TOKEN) missing.push('BOT_TOKEN');
  if (!MONGODB_URI) missing.push('MONGODB_URI');
  if (ADMIN_IDS.length === 0) missing.push('ADMIN_IDS');
  if (!WEB_API_KEY) missing.push('WEB_API_KEY');

  if (missing.length > 0) {
    console.error(
      `❌ Missing required environment variable(s): ${missing.join(', ')}\n` +
        'Copy .env.example to .env and fill in the values before starting the bot.'
    );
    process.exit(1);
  }
}
