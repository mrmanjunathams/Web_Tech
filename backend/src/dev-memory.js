// Runs the app against a throwaway in-memory MongoDB, so no local MongoDB install is needed.
// Data is lost when the process exits. Use "npm start" with MONGODB_URI for real data.
const { MongoMemoryServer } = require('mongodb-memory-server');
const { start } = require('./index');

(async () => {
  const mongod = await MongoMemoryServer.create();
  console.log('Started in-memory MongoDB (data is not persisted)');
  await start(mongod.getUri('bloggerbytes'));
  const stop = () => mongod.stop().finally(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
})().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
