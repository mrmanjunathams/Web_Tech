// Runs the app against a throwaway in-memory MongoDB, so no local MongoDB install is needed.
// Data is lost when the process exits. Use "npm start" with MONGODB_URI for real data.
const { MongoMemoryServer } = require('mongodb-memory-server');
const { start } = require('./index');

/** @param {number} [port] defaults to PORT (3000) */
async function main(port) {
  try {
    const mongod = await MongoMemoryServer.create();
    console.log('Started in-memory MongoDB (data is not persisted)');
    // Stops the database only after the server has disconnected from it.
    const server = await start(mongod.getUri('bloggerbytes'), port, () => mongod.stop());
    return { mongod, server };
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

/* node:coverage ignore next */
if (require.main === module) main();

module.exports = { main };
