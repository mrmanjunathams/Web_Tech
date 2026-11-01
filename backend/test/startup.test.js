// Server start-up (index.js, dev-memory.js, local-db.js) and the welcome email.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { quietly, stubbed } = require('./helpers');

/** Calls to process.exit made while `fn` runs (process.exit is stubbed). */
let exitCodes = [];
async function exits(fn) {
  const codes = (exitCodes = []);
  await stubbed(process, 'exit', (code) => codes.push(code), fn);
  return codes;
}

const freePort = () =>
  new Promise((resolve) => {
    const s = net.createServer().listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

/** Lets queued promise callbacks (shutdown handlers) run. */
const settle = (ms = 500) => new Promise((r) => setTimeout(r, ms));

afterEach(() => {
  process.removeAllListeners('SIGINT');
  process.removeAllListeners('SIGTERM');
});

test('start() connects, seeds, migrates, listens, and shuts down on SIGTERM', async () => {
  const { start } = require('../src/index');
  const mongod = await MongoMemoryServer.create();
  try {
    await quietly(async () => {
      const server = await start(mongod.getUri('bb-start'), 0);
      assert.ok(server.listening);
      const res = await fetch(`http://localhost:${server.address().port}/BAdd`);
      const blogs = await res.json();
      assert.ok(blogs.length > 0 && blogs.every((b) => b.status === 'published'));
      await settle(); // let the session store finish its start-up work

      // Restart against the same data: nothing left to seed or migrate.
      const codes = await exits(async () => {
        process.emit('SIGTERM');
        await settle();
      });
      assert.deepEqual(codes, [0]);
      assert.equal(server.listening, false);
      // A blog left by the 2018 app gets upgraded on the next start.
      await mongoose.connect(mongod.getUri('bb-start'));
      await mongoose.connection.collection('blogs').insertOne({ auth: 'old', title: 'Legacy', createdAt: new Date() });
      await mongoose.disconnect();
      const again = await start(mongod.getUri('bb-start'), 0);
      const legacy = await mongoose.connection.collection('blogs').findOne({ title: 'Legacy' });
      assert.equal(legacy.status, 'published');
      await settle();
      await exits(async () => {
        process.emit('SIGINT');
        await settle();
      });
      assert.equal(again.listening, false);
    });
  } finally {
    await mongoose.disconnect();
    await mongod.stop();
  }
});

test('start() rejects when the port is already in use, and main() says so', async () => {
  const { start, main } = require('../src/index');
  const mongod = await MongoMemoryServer.create();
  const blocker = net.createServer();
  await new Promise((r) => blocker.listen(0, r));
  try {
    await quietly(async () => {
      await assert.rejects(start(mongod.getUri('bb-busy'), blocker.address().port), { code: 'EADDRINUSE' });
    });
    const errors = [];
    const busy = Object.assign(new Error('listen EADDRINUSE'), { code: 'EADDRINUSE' });
    const codes = await exits(() =>
      stubbed(console, 'error', (...a) => errors.push(a.join(' ')), () =>
        stubbed(mongoose, 'connect', async () => { throw busy; }, main)
      )
    );
    assert.deepEqual(codes, [1]);
    assert.match(errors.join('\n'), /already in use/);
  } finally {
    blocker.close();
    await settle(); // let the session store finish its start-up work
    await mongoose.disconnect();
    await mongod.stop();
  }
});

test('main() reports a database it cannot reach and exits with 1', async () => {
  const { main } = require('../src/index');
  const codes = await quietly(() =>
    exits(() => stubbed(mongoose, 'connect', async () => { throw new Error('ECONNREFUSED'); }, main))
  );
  assert.deepEqual(codes, [1]);
});

test('dev-memory main() starts an in-memory database plus the server, and stops both', async () => {
  const { main } = require('../src/dev-memory');
  let running;
  try {
    await quietly(async () => {
      running = await main(0); // any free port, never the 3000 a developer may be using
      assert.ok(running.server.listening);
      await settle();
      const codes = await exits(async () => {
        process.emit('SIGINT');
        await settle();
      });
      assert.deepEqual(codes, [0]);
      assert.notEqual(running.mongod.state, 'running'); // stopped after the server disconnected
    });
  } finally {
    await mongoose.disconnect();
  }
});

test('dev-memory main() exits with 1 when the database cannot start', async () => {
  const { main } = require('../src/dev-memory');
  const codes = await quietly(() =>
    exits(() => stubbed(MongoMemoryServer, 'create', async () => { throw new Error('no binary'); }, main))
  );
  assert.deepEqual(codes, [1]);
});

test('local-db keeps data on disk, stops cleanly, and explains failures', async () => {
  const { startLocalDb, main } = require('../src/local-db');
  const dbPath = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-localdb-'));
  try {
    await quietly(async () => {
      const port = await freePort();
      const { mongod, stop } = await startLocalDb({ port, dbPath });
      assert.match(mongod.getUri(), new RegExp(`:${port}/`));

      // Port already taken: explains and exits with 1. (Simulated: on Windows mongod can bind a busy port.)
      const errors = [];
      const busy = await exits(() =>
        stubbed(console, 'error', (...a) => errors.push(a.join(' ')), () =>
          stubbed(MongoMemoryServer, 'create', async () => { throw new Error('listen EADDRINUSE: address already in use'); }, () =>
            main({ port, dbPath })
          )
        )
      );
      assert.deepEqual(busy, [1]);
      assert.match(errors.join('\n'), /That port is busy/);
      await stop();
      assert.ok(fs.readdirSync(dbPath).length > 0); // data kept

      // A path that can't be a directory: other failures exit with 1 too.
      const file = path.join(dbPath, 'a-file');
      fs.writeFileSync(file, '');
      const port2 = await freePort();
      assert.deepEqual(await exits(() => main({ port: port2, dbPath: file })), [1]);

      // Normal run, stopped with SIGTERM.
      const port3 = await freePort();
      const codes = await exits(async () => {
        await main({ port: port3, dbPath: path.join(dbPath, 'third') });
        process.emit('SIGTERM');
        // Wait until shutdown has finished (it calls process.exit).
        for (let i = 0; i < 100 && !exitCodes.length; i++) await settle(100);
      });
      assert.deepEqual(codes, [0]);
    });
  } finally {
    fs.rmSync(dbPath, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }); // Windows releases mongod's locks lazily
  }
});

test('welcome email: skipped without SMTP settings, sent with them, never throws', async () => {
  const { sendWelcomeEmail } = require('../src/mailer');
  const user = { username: 'amy', name: 'Amy <W>', email: 'amy@example.com' };
  assert.equal(await sendWelcomeEmail(user), false);

  process.env.SMTP_USER = 'bot@example.com';
  process.env.SMTP_PASS = 'pw';
  const sent = [];
  const transport = { sendMail: async (m) => (sent.push(m), { response: '250 OK' }) };
  try {
    await quietly(() =>
      stubbed(nodemailer, 'createTransport', () => transport, async () => {
        assert.equal(await sendWelcomeEmail(user), true);
        assert.equal(await sendWelcomeEmail({ username: 'bo', email: 'bo@example.com' }), true); // transport reused
        transport.sendMail = async () => { throw new Error('SMTP down'); };
        assert.equal(await sendWelcomeEmail(user), false);
      })
    );
    assert.equal(sent[0].to, 'amy@example.com');
    assert.equal(sent[0].from, 'bot@example.com');
    assert.match(sent[0].text, /Hi Amy <W>/);
    assert.match(sent[0].html, /Amy &lt;W&gt;/);
    assert.match(sent[1].html, /Welcome to Bloggerbytes, bo\./);
  } finally {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  }
});
