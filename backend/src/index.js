const mongoose = require('mongoose');
const { MongoStore } = require('connect-mongo');
const { createApp, seedBlogs } = require('./app');

const PORT = Number(process.env.PORT) || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bloggerbytes';

async function start(mongoUri = MONGODB_URI) {
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log(`Connected to MongoDB (${mongoose.connection.name})`);
  await mongoose.syncIndexes();

  const seeded = await seedBlogs();
  if (seeded) console.log(`Seeded ${seeded} sample blogs`);

  const sessionStore = MongoStore.create({ client: mongoose.connection.getClient(), collectionName: 'sessions' });
  const app = createApp({ sessionStore });
  const server = app.listen(PORT, () => console.log(`Bloggerbytes running at http://localhost:${PORT}`));

  const shutdown = async () => {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  return server;
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start server:', err.message);
    console.error('Is MongoDB running? Set MONGODB_URI in .env, or run "npm run dev:memory".');
    process.exit(1);
  });
}

module.exports = { start };
