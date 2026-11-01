const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { before, after, beforeEach } = require('node:test');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../src/app');
const { User, Blog, Subscriber } = require('../src/models');

const newUser = { username: 'blogger1', name: 'Asha Rao', email: 'Blogger1@Example.com', password: 'secret123' };
const newBlog = { title: 'My trip', cate: 'Travel | Vacation', img: 'img5', blogp1: 'Para one', blogp2: '<p>Para <strong>two</strong></p>' };

/**
 * Registers hooks for an in-memory MongoDB and a test app (emptied before each test).
 * @returns {{ app: () => import('express').Express, distDir: () => string, agent: (user?: object) => Promise<import('supertest').Agent> }}
 */
function useTestApp() {
  let mongod;
  let app;
  let distDir;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri('bloggerbytes-test'));
    await mongoose.syncIndexes();
    // Stand-in for the Angular production build.
    distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-dist-'));
    fs.writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><app-root></app-root>');
    fs.writeFileSync(path.join(distDir, 'main.js'), 'console.log(1)');
    app = createApp({ sessionSecret: 'test-secret', rateLimit: false, frontendDist: distDir });
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
    fs.rmSync(distDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Blog.deleteMany({});
    await Subscriber.deleteMany({});
  });

  return {
    app: () => app,
    distDir: () => distDir,
    /** A signed-up, signed-in agent. */
    async agent(user = newUser) {
      const agent = request.agent(app);
      await agent.post('/adduser').send(user).expect(201);
      return agent;
    },
  };
}

/** Runs `fn` with console.error/log silenced, restoring them afterwards. */
async function quietly(fn) {
  const { error, log } = console;
  console.error = () => {};
  console.log = () => {};
  try {
    return await fn();
  } finally {
    Object.assign(console, { error, log });
  }
}

/** Replaces `obj[key]` for the duration of `fn`. */
async function stubbed(obj, key, value, fn) {
  const original = obj[key];
  obj[key] = value;
  try {
    return await fn();
  } finally {
    obj[key] = original;
  }
}

module.exports = { useTestApp, quietly, stubbed, newUser, newBlog };
