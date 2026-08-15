import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const episodeSchema = new Schema(
  {
    episodeNumber: { type: Number, required: true },
    title: { type: String, required: true },
    videoUrl: { type: String, required: true },
  },
  { _id: true, timestamps: false }
);

const seasonSchema = new Schema(
  {
    seasonNumber: { type: Number, required: true },
    episodes: { type: [episodeSchema], default: [] },
  },
  { _id: true, timestamps: false }
);

const contentSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['anime', 'movie', 'series'],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    imdb: { type: String, default: '' },
    year: { type: String, default: '' },
    poster: { type: String, default: '' },
    banner: { type: String, default: '' },
    description: { type: String, default: '' },
    genre: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['Ongoing', 'Completed', 'Upcoming'],
      default: 'Ongoing',
    },
    // Movies only
    videoUrl: { type: String, default: '' },
    // Anime only
    episodes: { type: [episodeSchema], default: [] },
    // Series only
    seasons: { type: [seasonSchema], default: [] },
  },
  { timestamps: true }
);

// Indexes required by the spec: type, title, status.
contentSchema.index({ type: 1 });
contentSchema.index({ title: 1 });
contentSchema.index({ status: 1 });
// Extra text index to power /api/search.
contentSchema.index({ title: 'text', description: 'text' });

const Content = model('Content', contentSchema);

export default Content;
