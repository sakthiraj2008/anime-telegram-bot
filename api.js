import express from 'express';
import mongoose from 'mongoose';
import Content from './models/Content.js';
import { WEB_API_KEY } from './config.js';
import { isDBConnected } from './db.js';

function requireApiKey(req, res, next) {
  const key = req.header('X-API-Key');
  if (!key || key !== WEB_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: missing or invalid X-API-Key header.' });
  }
  next();
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

export function createApiApp() {
  const app = express();
  app.use(express.json());

  // Health check does not require an API key, so uptime monitors can hit it freely.
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      database: isDBConnected() ? 'connected' : 'disconnected',
    });
  });

  // Everything under /api requires the shared secret.
  app.use('/api', requireApiKey);

  app.get('/api/content', async (req, res) => {
    try {
      const docs = await Content.find().sort({ createdAt: -1 });
      res.json(docs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/content/type/:type', async (req, res) => {
    const { type } = req.params;
    if (!['anime', 'movie', 'series'].includes(type)) {
      return res.status(400).json({ error: 'Invalid content type.' });
    }
    try {
      const docs = await Content.find({ type }).sort({ createdAt: -1 });
      res.json(docs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/content/:id', async (req, res) => {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    try {
      const doc = await Content.findById(id);
      if (!doc) return res.status(404).json({ error: 'Not found.' });
      res.json(doc);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/anime', async (req, res) => {
    try {
      const docs = await Content.find({ type: 'anime' }).sort({ createdAt: -1 });
      res.json(docs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/movies', async (req, res) => {
    try {
      const docs = await Content.find({ type: 'movie' }).sort({ createdAt: -1 });
      res.json(docs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/series', async (req, res) => {
    try {
      const docs = await Content.find({ type: 'series' }).sort({ createdAt: -1 });
      res.json(docs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/genres', async (req, res) => {
    try {
      const genres = await Content.distinct('genre');
      res.json(genres.filter(Boolean).sort());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/search', async (req, res) => {
    const q = (req.query.q || '').toString().trim();
    if (!q) return res.status(400).json({ error: 'Query parameter "q" is required.' });
    try {
      const docs = await Content.find({ title: { $regex: q, $options: 'i' } }).sort({
        createdAt: -1,
      });
      res.json(docs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Fallback error handler so a bad request never crashes the process.
  app.use((err, req, res, next) => {
    console.error('API error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}
