// Runs a real, persistent MongoDB for local development without installing MongoDB:
// it reuses the mongod binary that mongodb-memory-server downloads, with data kept in backend/.data/db.
// Usage: npm run db   (then "npm run dev" in another terminal, with MONGODB_URI from .env)
const fs = require('node:fs');
const path = require('node:path');
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = Number(process.env.MONGO_PORT) || 27017;
const DB_PATH = path.resolve(process.env.MONGO_DB_PATH || path.join(__dirname, '..', '.data', 'db'));

async function startLocalDb({ port = PORT, dbPath = DB_PATH } = {}) {
  fs.mkdirSync(dbPath, { recursive: true });
  const mongod = await MongoMemoryServer.create({
    instance: { port, ip: '127.0.0.1', dbPath, storageEngine: 'wiredTiger' },
  });
  console.log(`Local MongoDB running at mongodb://127.0.0.1:${port} (data: ${dbPath})`);
  // Keep the data directory on shutdown.
  const stop = () => mongod.stop({ doCleanup: false, force: false });
  return { mongod, stop };
}

function main(options) {
  return startLocalDb(options)
    .then(({ stop }) => {
      const shutdown = () => stop().finally(() => process.exit(0));
      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
    })
    .catch((err) => {
      console.error('Failed to start local MongoDB:', err.message);
      if (/EADDRINUSE|already in use/i.test(err.message)) console.error('That port is busy. Is MongoDB already running? Set MONGO_PORT to use another port.');
      process.exit(1);
    });
}

/* node:coverage ignore next */
if (require.main === module) main();

module.exports = { startLocalDb, main };
