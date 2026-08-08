import express from 'express';
import Anime from './models/Anime.js';
import Episode from './models/Episode.js';
import { config } from './config.js';

export function createApi(bot) {
  const app = express();
  app.use(express.json());

  const mediaValue = (item) => {
    if (!item?.value) return '';
    if (item.type === 'telegram') return `${config.publicBaseUrl}/api/media/${encodeURIComponent(item.value)}`;
    return item.value;
  };

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.get('/api/animes', async (req, res) => {
    try {
      const animes = await Anime.find().sort({ createdAt: -1 }).lean();
      res.json(animes.map(a => ({ ...a, poster: mediaValue(a.poster), banner: mediaValue(a.banner) })));
    } catch (e) { res.status(500).json({ error: 'Failed to load animes' }); }
  });

  app.get('/api/animes/:slug', async (req, res) => {
    try {
      const anime = await Anime.findOne({ slug: req.params.slug }).lean();
      if (!anime) return res.status(404).json({ error: 'Anime not found' });
      const episodes = await Episode.find({ animeId: anime._id }).sort({ season: 1, episodeNumber: 1 }).lean();
      res.json({ ...anime, poster: mediaValue(anime.poster), banner: mediaValue(anime.banner), episodes });
    } catch (e) { res.status(500).json({ error: 'Failed to load anime' }); }
  });

  app.get('/api/animes/:slug/episodes', async (req, res) => {
    try {
      const anime = await Anime.findOne({ slug: req.params.slug }).lean();
      if (!anime) return res.status(404).json({ error: 'Anime not found' });
      const episodes = await Episode.find({ animeId: anime._id }).sort({ season: 1, episodeNumber: 1 }).lean();
      res.json(episodes);
    } catch (e) { res.status(500).json({ error: 'Failed to load episodes' }); }
  });

  app.get('/api/media/:fileId', async (req, res) => {
    try {
      const file = await bot.getFile(req.params.fileId);
      if (!file?.file_path) return res.status(404).end();
      const url = `https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`;
      const response = await fetch(url);
      if (!response.ok) return res.status(response.status).end();
      res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const buffer = Buffer.from(await response.arrayBuffer());
      res.send(buffer);
    } catch (e) {
      console.error(e);
      res.status(404).end();
    }
  });

  app.listen(config.port, () => console.log(`API listening on port ${config.port}`));
  return app;
}
