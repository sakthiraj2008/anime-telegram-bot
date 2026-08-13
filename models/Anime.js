const mongoose = require('mongoose');

const episodeSchema = new mongoose.Schema({
    episodeNumber: { type: Number, required: true },
    episodeTitle: { type: String, default: "" },
    servers: {
        server1: { type: String, default: "" },
        server2: { type: String, default: "" }
    }
}, { _id: false });

const seasonSchema = new mongoose.Schema({
    seasonNumber: { type: Number, required: true },
    episodes: [episodeSchema]
}, { _id: false });

const animeSchema = new mongoose.Schema({
    animeId: { type: String, required: true, unique: true, index: true }, // "id" in content.json
    title: { type: String, required: true },
    type: { type: String, default: "anime" },
    imdb: { type: String, default: "0.0" },
    year: { type: String, default: "2024" },
    quality: { type: String, default: "HD" },
    language: { type: [String], default: ["Tamil"] },
    genre: { type: [String], default: ["Action"] },
    synopsis: { type: String, default: "" },
    poster: { type: String, default: "" },
    banner: { type: String, default: "" },
    hasEpisodes: { type: Boolean, default: true },
    totalEpisodes: { type: Number, default: 0 },
    latestEpisode: { type: Number, default: 0 },
    isNewEpisode: { type: Boolean, default: true },
    addedDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
    seasons: [seasonSchema]
}, { timestamps: true });

module.exports = mongoose.model('Anime', animeSchema);
