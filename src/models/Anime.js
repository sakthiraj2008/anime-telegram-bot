import mongoose from 'mongoose';

const animeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true },
  description: { type: String, default: '' },
  year: { type: Number, default: null },
  genres: { type: [String], default: [] },
  poster: {
    type: { type: String, enum: ['url', 'telegram'], default: 'url' },
    value: { type: String, default: '' }
  },
  banner: {
    type: { type: String, enum: ['url', 'telegram'], default: 'url' },
    value: { type: String, default: '' }
  },
  status: { type: String, default: 'Ongoing' }
}, { timestamps: true });

export default mongoose.model('Anime', animeSchema);
