const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp, seedBlogs } = require('../src/app');
const { User, Blog, Subscriber } = require('../src/models');

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

const newUser = { username: 'blogger1', email: 'Blogger1@Example.com', password: 'secret123' };
const newBlog = { title: 'My trip', cate: 'Travel | Vacation', date: 'Nov 01, 2026', img: 'img5', blogp1: 'Para one', blogp2: 'Para two' };

async function signedInAgent() {
  const agent = request.agent(app);
  await agent.post('/adduser').send(newUser).expect(201);
  return agent;
}

test('serves the built frontend', async () => {
  const res = await request(app).get('/').expect(200).expect('Content-Type', /html/);
  assert.match(res.text, /app-root/);
  await request(app).get('/main.js').expect(200);
});

test('works as an API-only server when the frontend is not built', async () => {
  const apiOnly = createApp({ sessionSecret: 'x', rateLimit: false, frontendDist: path.join(distDir, 'missing') });
  const res = await request(apiOnly).get('/').expect(200);
  assert.match(res.text, /API is running/);
  await request(apiOnly).get('/health').expect(200);
});

test('does not expose server source, env or dependencies', async () => {
  for (const p of ['/src/app.js', '/package.json', '/.env', '/node_modules/express/package.json', '/Sam1', '/../package.json']) {
    await request(app).get(p).expect(404);
  }
});

test('GET /health, /blogs and /cate return JSON', async () => {
  assert.deepEqual((await request(app).get('/health').expect(200)).body, { status: 'ok' });
  const blogs = await request(app).get('/blogs').expect(200).expect('Content-Type', /json/);
  assert.ok(Array.isArray(blogs.body) && blogs.body.length > 0);
  const cate = await request(app).get('/cate').expect(200);
  assert.ok(Array.isArray(cate.body) && cate.body.length > 0);
});

test('seedBlogs fills an empty collection once', async () => {
  const n = await seedBlogs();
  assert.ok(n > 0);
  assert.equal(await seedBlogs(), 0);
  const res = await request(app).get('/BAdd').expect(200);
  assert.equal(res.body.length, n);
});

test('sign up hashes the password, starts a session and hides the hash', async () => {
  const agent = request.agent(app);
  const res = await agent.post('/adduser').send(newUser).expect(201);
  assert.equal(res.body.username, 'blogger1');
  assert.equal(res.body.email, 'blogger1@example.com');
  assert.equal(res.body.passwordHash, undefined);

  const stored = await User.findOne({ username: 'blogger1' }).lean();
  assert.notEqual(stored.passwordHash, newUser.password);
  assert.equal(stored.password, undefined);

  const me = await agent.get('/myacc').expect(200);
  assert.equal(me.body.username, 'blogger1');
  assert.equal(me.body.passwordHash, undefined);
});

test('sign up validates input and rejects duplicates', async () => {
  await request(app).post('/adduser').send({ ...newUser, username: 'a' }).expect(400);
  await request(app).post('/adduser').send({ ...newUser, email: 'not-an-email' }).expect(400);
  await request(app).post('/adduser').send({ ...newUser, password: '123' }).expect(400);
  await request(app).post('/adduser').send({ username: { $gt: '' }, email: 'x@y.z', password: 'secret123' }).expect(400);
  await request(app).post('/adduser').send(newUser).expect(201);
  await request(app).post('/adduser').send(newUser).expect(409);
  await request(app).post('/adduser').send({ ...newUser, username: 'other' }).expect(409);
});

test('invalid JSON body returns 400', async () => {
  await request(app).post('/adduser').set('Content-Type', 'application/json').send('{bad').expect(400);
});

test('login succeeds with the right password only', async () => {
  await request(app).post('/adduser').send(newUser).expect(201);
  await request(app).post('/loginuser').send({ username: 'blogger1', password: 'wrong' }).expect(401);
  await request(app).post('/loginuser').send({ username: 'nobody', password: 'secret123' }).expect(401);
  await request(app).post('/loginuser').send({ username: { $ne: null }, password: 'x' }).expect(400);
  await request(app).post('/loginuser').send({}).expect(400);

  const agent = request.agent(app);
  const res = await agent.post('/loginuser').send({ username: 'blogger1', password: 'secret123' }).expect(200);
  assert.deepEqual(res.body, { message: 'successful login', username: 'blogger1' });
  await agent.get('/myacc').expect(200);
});

test('/myacc requires login and logout ends the session', async () => {
  await request(app).get('/myacc').expect(401);
  const agent = await signedInAgent();
  await agent.get('/myacc').expect(200);
  await agent.post('/logout').expect(200);
  await agent.get('/myacc').expect(401);
});

test('posting a blog requires login, validates, and uses the session username', async () => {
  await request(app).post('/addblog').send(newBlog).expect(401);

  const agent = await signedInAgent();
  await agent.post('/addblog').send({ ...newBlog, title: '' }).expect(400);
  await agent.post('/addblog').send({ ...newBlog, img: 'doesnotexist' }).expect(400);

  const res = await agent.post('/addblog').send({ ...newBlog, auth: 'someone-else' }).expect(201);
  assert.equal(res.body.auth, 'blogger1');

  const all = await request(app).get('/BAdd').expect(200);
  assert.equal(all.body.length, 1);
  assert.equal(all.body[0].title, 'My trip');

  const me = await agent.get('/myacc').expect(200);
  assert.equal(me.body.blogs.length, 1);
});

test('unknown routes return JSON 404', async () => {
  const res = await request(app).get('/nope').expect(404);
  assert.deepEqual(res.body, { error: 'Not found' });
});

test('newsletter subscribe validates and ignores duplicates', async () => {
  await request(app).post('/subscribe').send({ email: 'nope' }).expect(400);
  await request(app).post('/subscribe').send({}).expect(400);
  await request(app).post('/subscribe').send({ email: 'Reader@Example.com' }).expect(201);
  await request(app).post('/subscribe').send({ email: 'reader@example.com' }).expect(201);
  assert.equal(await Subscriber.countDocuments(), 1);
});

test('CORS is off by default and allows only configured origins', async () => {
  const res = await request(app).get('/health').set('Origin', 'https://evil.example');
  assert.equal(res.headers['access-control-allow-origin'], undefined);

  process.env.CORS_ORIGIN = 'https://bloggerbytes.example';
  try {
    const corsApp = createApp({ sessionSecret: 'x', rateLimit: false, frontendDist: false });
    const ok = await request(corsApp).get('/health').set('Origin', 'https://bloggerbytes.example');
    assert.equal(ok.headers['access-control-allow-origin'], 'https://bloggerbytes.example');
    assert.equal(ok.headers['access-control-allow-credentials'], 'true');
    await request(corsApp).options('/loginuser').set('Origin', 'https://bloggerbytes.example').expect(204);
    const bad = await request(corsApp).get('/health').set('Origin', 'https://evil.example');
    assert.equal(bad.headers['access-control-allow-origin'], undefined);
  } finally {
    delete process.env.CORS_ORIGIN;
  }
});
