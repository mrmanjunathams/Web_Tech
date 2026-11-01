const mongoose = require('mongoose');
const { MongoStore } = require('connect-mongo');
const { createApp, seedBlogs, migrateBlogs } = require('./app');

const PORT = Number(process.env.PORT) || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bloggerbytes';

/**
 * Connects to MongoDB, prepares the data and starts listening.
 * Resolves to the HTTP server once it is listening. SIGINT/SIGTERM stop the server, disconnect from MongoDB,
 * then run `onClose` (e.g. stopping an in-memory database) and exit.
 */
async function start(mongoUri = MONGODB_URI, port = PORT, onClose) {
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log(`Connected to MongoDB (${mongoose.connection.name})`);
  await mongoose.syncIndexes();

  const seeded = await seedBlogs();
  if (seeded) console.log(`Seeded ${seeded} sample blogs`);
  const migrated = await migrateBlogs();
  if (migrated) console.log(`Updated ${migrated} older blogs for drafts and scheduling`);

  const sessionStore = MongoStore.create({ client: mongoose.connection.getClient(), collectionName: 'sessions' });
  const app = createApp({ sessionStore });
  const server = await new Promise((resolve) => {
    const s = app.listen(port, () => resolve(s));
  });
  console.log(`Bloggerbytes running at http://localhost:${server.address().port}`);

  const shutdown = async () => {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeIdleConnections(); // don't wait for keep-alive sockets to time out
    });
    await mongoose.disconnect();
    if (onClose) await onClose();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return server;
}

function main() {
  return start().catch((err) => {
    console.error('Failed to start server:', err.message);
    console.error('Is MongoDB running? Set MONGODB_URI in .env, or run "npm run dev:memory".');
    process.exit(1);
  });
}

/* node:coverage ignore next */
if (require.main === module) main();

module.exports = { start, main };
