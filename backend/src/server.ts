import mongoose from 'mongoose';
import { createApp } from './app';
import { env } from './config/env';

const start = async () => {
  try {
    await mongoose.connect(env.mongoUri);
    console.log('[DB] Connected to MongoDB');

    const app = createApp();

    app.listen(env.port, () => {
      console.log(`[Server] Listening on port ${env.port}`);
    });
  } catch (err) {
    console.error('[Server] Failed to start', err);
    process.exit(1);
  }
};

start();
