import mongoose from 'mongoose';
import { MONGODB_URI } from './config.js';

let connecting = null;

mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected');
});

export async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connecting) return connecting;

  connecting = mongoose
    .connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    })
    .catch((err) => {
      console.error('❌ Failed to connect to MongoDB:', err.message);
      throw err;
    });

  await connecting;
  return mongoose.connection;
}

export function isDBConnected() {
  return mongoose.connection.readyState === 1;
}
