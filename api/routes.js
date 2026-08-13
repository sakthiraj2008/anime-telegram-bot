const express = require('express');
const router = express.Router();
const Anime = require('../models/Anime');

// Endpoint replacing content.json exactly as structured in image 2
router.get('/content.json', async (req, res) => {
    try {
        const animes = await Anime.find();
        const formatted = animes.map(a => ({
            id: a.animeId,
            title: a.title,
            type: a.type,
            imdb: a.imdb,
            year: a.year,
            quality: a.quality,
            language: a.language,
            genre: a.genre,
            synopsis: a.synopsis,
            poster: a.poster,
            banner: a.banner,
            hasEpisodes: a.hasEpisodes,
            totalEpisodes: a.totalEpisodes,
            latestEpisode: a.latestEpisode,
            isNewEpisode: a.isNewEpisode,
            addedDate: a.addedDate
        }));
        res.json(formatted);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// GET all anime (Standard REST)
router.get('/anime', async (req, res) => {
    try {
        const animes = await Anime.find({}, '-_id -__v -seasons');
        res.json(animes);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// GET single anime metadata
router.get('/anime/:animeId', async (req, res) => {
    try {
        const anime = await Anime.findOne({ animeId: req.params.animeId }, '-_id -__v -seasons');
        if (!anime) return res.status(404).json({ error: 'Anime not found' });
        res.json(anime);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// GET episodes formatted EXACTLY like the legacy JSON file in Image 1
router.get('/anime/:animeId/episodes', async (req, res) => {
    try {
        const anime = await Anime.findOne({ animeId: req.params.animeId });
        if (!anime) return res.status(404).json({ error: 'Anime not found' });

        const seasonsObj = {};
        anime.seasons.forEach(s => {
            const epObj = {};
            s.episodes.forEach(e => {
                epObj[e.episodeNumber.toString()] = {
                    episodeTitle: e.episodeTitle || "",
                    servers: {
                        server1: e.servers?.server1 || "",
                        server2: e.servers?.server2 || ""
                    }
                };
            });
            seasonsObj[s.seasonNumber.toString()] = { episodes: epObj };
        });

        res.json({ seasons: seasonsObj });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// GET single episode direct server links for Android / Players
router.get('/anime/:animeId/episodes/:season/:episode', async (req, res) => {
    try {
        const { animeId, season, episode } = req.params;
        const anime = await Anime.findOne({ animeId });
        if (!anime) return res.status(404).json({ error: 'Anime not found' });

        const s = anime.seasons.find(sec => sec.seasonNumber === parseInt(season));
        if (!s) return res.status(404).json({ error: 'Season not found' });

        const ep = s.episodes.find(e => e.episodeNumber === parseInt(episode));
        if (!ep) return res.status(404).json({ error: 'Episode not found' });

        res.json({
            animeId: anime.animeId,
            season: parseInt(season),
            episode: parseInt(episode),
            episodeTitle: ep.episodeTitle,
            servers: ep.servers,
            url: ep.servers.server1 || ep.servers.server2 // direct video fallback
        });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
