import 'dotenv/config';

const required = ['BOT_TOKEN', 'MONGODB_URI', 'ADMIN_IDS'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing environment variable: ${key}`);
}

export const config = {
  botToken: process.env.BOT_TOKEN,
  mongoUri: process.env.MONGODB_URI,
  adminIds: process.env.ADMIN_IDS.split(',').map(v => Number(v.trim())).filter(Number.isFinite),
  port: Number(process.env.PORT || 3000),
  apiKey: process.env.WEB_API_KEY || '',
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '')
};
