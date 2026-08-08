import mongoose from 'mongoose';

const trackSchema = new mongoose.Schema({
  label: { type: String, required: true },
  url: { type: String, required: true }
}, { _id: false });

const subtitleSchema = new mongoose.Schema({
  label: { type: String, required: true },
  url: { type: String, required: true }
}, { _id: false });

const episodeSchema = new mongoose.Schema({
  animeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Anime', required: true, index: true },
  season: { type: Number, default: 1, min: 1 },
  episodeNumber: { type: Number, required: true, min: 1 },
  title: { type: String, default: '' },
  videoUrl: { type: String, required: true },
  audioTracks: { type: [trackSchema], default: [] },
  subtitles: { type: [subtitleSchema], default: [] }
}, { timestamps: true });

episodeSchema.index({ animeId: 1, season: 1, episodeNumber: 1 }, { unique: true });

export default mongoose.model('Episode', episodeSchema);
