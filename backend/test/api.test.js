const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const session = require('express-session');
const { createApp, seedBlogs, GALLERY_IMAGES } = require('../src/app');
const { User, Blog, Subscriber } = require('../src/models');
const { useTestApp, quietly, stubbed, newUser, newBlog } = require('./helpers');

const t = useTestApp();

test('serves the built frontend', async () => {
  const res = await request(t.app()).get('/').expect(200).expect('Content-Type', /html/);
  assert.match(res.text, /app-root/);
  await request(t.app()).get('/main.js').expect(200);
});

test('works as an API-only server when the frontend is not built', async () => {
  const apiOnly = createApp({ sessionSecret: 'x', rateLimit: false, frontendDist: path.join(t.distDir(), 'missing') });
  const res = await request(apiOnly).get('/').expect(200);
  assert.match(res.text, /API is running/);
  await request(apiOnly).get('/health').expect(200);
  // frontendDist: false serves no frontend at all
  const bare = createApp({ sessionSecret: 'x', rateLimit: false, frontendDist: false });
  await request(bare).get('/').expect(404);
  // default location: whatever "npm run build" produced, or the API-only message
  await request(createApp({ sessionSecret: 'x', rateLimit: false })).get('/').expect(200);
});

test('does not expose server source, env or dependencies', async () => {
  for (const p of ['/src/app.js', '/package.json', '/.env', '/node_modules/express/package.json', '/Sam1', '/../package.json']) {
    await request(t.app()).get(p).expect(404);
  }
});

test('GET /health, /blogs and /cate return JSON', async () => {
  assert.deepEqual((await request(t.app()).get('/health').expect(200)).body, { status: 'ok' });
  const blogs = await request(t.app()).get('/blogs').expect(200).expect('Content-Type', /json/);
  assert.ok(Array.isArray(blogs.body) && blogs.body.length > 0);
  assert.equal(blogs.body[0].authName, blogs.body[0].auth);
  assert.match(blogs.body[0].blogp2, /^<p>/); // bodies are always HTML
  const cate = await request(t.app()).get('/cate').expect(200);
  assert.ok(Array.isArray(cate.body) && cate.body.length > 0);
});

test('seedBlogs fills an empty collection once, as live published stories', async () => {
  const n = await seedBlogs();
  assert.ok(n > 0);
  assert.equal(await seedBlogs(), 0);
  const res = await request(t.app()).get('/BAdd').expect(200);
  assert.equal(res.body.length, n);
  assert.ok(res.body.every((b) => b.status === 'published' && b.publishAt));
});

test('sign up stores the display name, hashes the password, starts a session and hides the hash', async () => {
  const agent = request.agent(t.app());
  const res = await agent.post('/adduser').send(newUser).expect(201);
  assert.equal(res.body.username, 'blogger1');
  assert.equal(res.body.name, 'Asha Rao');
  assert.equal(res.body.email, 'blogger1@example.com');
  assert.equal(res.body.passwordHash, undefined);

  const stored = await User.findOne({ username: 'blogger1' }).lean();
  assert.notEqual(stored.passwordHash, newUser.password);
  assert.equal(stored.name, 'Asha Rao');

  const me = await agent.get('/myacc').expect(200);
  assert.equal(me.body.name, 'Asha Rao');
  assert.equal(me.body.passwordHash, undefined);
});

test('sign up validates input and rejects duplicates', async () => {
  const app = t.app();
  await request(app).post('/adduser').send({ ...newUser, username: 'a' }).expect(400);
  for (const name of [undefined, '', '   ', 'x'.repeat(61), 'bad\u0007name']) {
    const res = await request(app).post('/adduser').send({ ...newUser, name }).expect(400);
    assert.match(res.body.error, /your name/);
  }
  await request(app).post('/adduser').send({ ...newUser, email: 'not-an-email' }).expect(400);
  await request(app).post('/adduser').send({ ...newUser, password: '123' }).expect(400);
  await request(app).post('/adduser').send({ ...newUser, password: 123456 }).expect(400);
  await request(app).post('/adduser').send({ username: { $gt: '' }, name: 'N', email: 'x@y.z', password: 'secret123' }).expect(400);
  await request(app).post('/adduser').send(['not', 'an', 'object']).expect(400);
  await request(app).post('/adduser').send(newUser).expect(201);
  assert.match((await request(app).post('/adduser').send(newUser).expect(409)).body.error, /username/);
  assert.match((await request(app).post('/adduser').send({ ...newUser, username: 'other' }).expect(409)).body.error, /email/);
});

test('sign up reports a duplicate that slips past the first check (race)', async () => {
  await request(t.app()).post('/adduser').send(newUser).expect(201);
  await stubbed(User, 'findOne', () => ({ lean: async () => null }), async () => {
    const res = await request(t.app()).post('/adduser').send(newUser).expect(409);
    assert.match(res.body.error, /already registered/);
  });
});

test('unexpected errors become a JSON 500 without details', async () => {
  await quietly(async () => {
    await stubbed(User.prototype, 'save', async () => { throw new Error('disk full'); }, async () => {
      const res = await request(t.app()).post('/adduser').send(newUser).expect(500);
      assert.deepEqual(res.body, { error: 'Something went wrong. Please try again.' });
    });
    await stubbed(Blog, 'find', () => { throw new Error('db down'); }, () => request(t.app()).get('/BAdd').expect(500));
  });
});

test('invalid, oversized and unsupported request bodies get clear errors', async () => {
  const app = t.app();
  await request(app).post('/adduser').set('Content-Type', 'application/json').send('{bad').expect(400);
  const huge = (await request(app).post('/subscribe').send({ email: 'x'.repeat(600 * 1024) }).expect(413)).body;
  assert.match(huge.error, /too long/);
  await quietly(() => request(app).post('/subscribe').set('Content-Type', 'application/json; charset=klingon').send('{}').expect(415));
});

test('login succeeds with the right password only, and returns the name', async () => {
  const app = t.app();
  await request(app).post('/adduser').send(newUser).expect(201);
  await request(app).post('/loginuser').send({ username: 'blogger1', password: 'wrong' }).expect(401);
  await request(app).post('/loginuser').send({ username: 'nobody', password: 'secret123' }).expect(401);
  await request(app).post('/loginuser').send({ username: { $ne: null }, password: 'x' }).expect(400);
  await request(app).post('/loginuser').send({}).expect(400);
  await request(app).post('/loginuser').send({ username: 'blogger1', password: ['x'] }).expect(400);

  const agent = request.agent(app);
  const res = await agent.post('/loginuser').send({ username: 'blogger1', password: 'secret123' }).expect(200);
  assert.deepEqual(res.body, { message: 'successful login', username: 'blogger1', name: 'Asha Rao' });
  await agent.get('/myacc').expect(200);
});

test('accounts from before display names: login and profile fall back gracefully, and can add a name', async () => {
  const legacy = new User({ username: 'oldtimer', email: 'old@example.com' });
  await legacy.setPassword('secret123');
  await User.collection.insertOne({ username: 'oldtimer', email: 'old@example.com', passwordHash: legacy.passwordHash });
  const agent = request.agent(t.app());
  const login = await agent.post('/loginuser').send({ username: 'oldtimer', password: 'secret123' }).expect(200);
  assert.equal(login.body.name, '');
  assert.equal((await agent.get('/myacc').expect(200)).body.name, '');

  await agent.patch('/myacc').send({ name: '' }).expect(400);
  await agent.patch('/myacc').send({}).expect(400);
  const updated = (await agent.patch('/myacc').send({ name: '  Old Timer  ' }).expect(200)).body;
  assert.equal(updated.name, 'Old Timer');
  assert.ok(Array.isArray(updated.blogs));
  await request(t.app()).patch('/myacc').send({ name: 'X' }).expect(401);
});

test('passwords: a user without a stored hash never matches', async () => {
  assert.equal(await new User({ username: 'x' }).checkPassword('anything'), false);
  assert.equal(await new User({ username: 'x', passwordHash: 'nocolon' }).checkPassword('anything'), false);
});

test('/myacc requires login and logout ends the session', async () => {
  await request(t.app()).get('/myacc').expect(401);
  const agent = await t.agent();
  await agent.get('/myacc').expect(200);
  await agent.post('/logout').expect(200);
  await agent.get('/myacc').expect(401);
});

test('a session whose account was deleted is treated as signed out', async () => {
  const agent = await t.agent();
  await User.deleteMany({});
  await agent.get('/myacc').expect(401);
  const again = await t.agent();
  await User.deleteMany({});
  await again.patch('/myacc').send({ name: 'Valid Name' }).expect(401);
});

test('session store failures surface as 500s', async () => {
  class FlakyStore extends session.MemoryStore {
    broken = false;
    destroy(sid, cb) {
      if (this.broken) return cb(new Error('store down'));
      super.destroy(sid, cb);
    }
  }
  const store = new FlakyStore();
  const app = createApp({ sessionSecret: 'x', rateLimit: false, frontendDist: false, sessionStore: store });
  await quietly(async () => {
    store.broken = true;
    await request(app).post('/adduser').send(newUser).expect(500); // session regeneration fails
    store.broken = false;
    const agent = request.agent(app);
    await agent.post('/loginuser').send({ username: newUser.username, password: newUser.password }).expect(200);
    store.broken = true;
    await agent.post('/logout').expect(500); // session destroy fails
  });
});

test('unknown routes return JSON 404', async () => {
  const res = await request(t.app()).get('/nope').expect(404);
  assert.deepEqual(res.body, { error: 'Not found' });
});

test('newsletter subscribe validates and ignores duplicates', async () => {
  const app = t.app();
  await request(app).post('/subscribe').send({ email: 'nope' }).expect(400);
  await request(app).post('/subscribe').send({}).expect(400);
  await request(app).post('/subscribe').send({ email: `${'a'.repeat(250)}@b.co` }).expect(400);
  await request(app).post('/subscribe').send({ email: 'Reader@Example.com' }).expect(201);
  await request(app).post('/subscribe').send({ email: 'reader@example.com' }).expect(201);
  assert.equal(await Subscriber.countDocuments(), 1);
});

test('CORS is off by default and allows only configured origins', async () => {
  const res = await request(t.app()).get('/health').set('Origin', 'https://evil.example');
  assert.equal(res.headers['access-control-allow-origin'], undefined);

  process.env.CORS_ORIGIN = 'https://bloggerbytes.example, https://app.example';
  try {
    const corsApp = createApp({ sessionSecret: 'x', rateLimit: false, frontendDist: false });
    const ok = await request(corsApp).get('/health').set('Origin', 'https://bloggerbytes.example');
    assert.equal(ok.headers['access-control-allow-origin'], 'https://bloggerbytes.example');
    assert.equal(ok.headers['access-control-allow-credentials'], 'true');
    const pre = await request(corsApp).options('/posts/x').set('Origin', 'https://app.example').expect(204);
    assert.match(pre.headers['access-control-allow-methods'], /\bPATCH\b.*\bDELETE\b/); // editing and deleting stories
    const bad = await request(corsApp).get('/health').set('Origin', 'https://evil.example');
    assert.equal(bad.headers['access-control-allow-origin'], undefined);
    await request(corsApp).get('/health').expect(200); // same-origin / non-browser clients send no Origin
  } finally {
    delete process.env.CORS_ORIGIN;
  }
});

test('production mode requires a session secret and hardens cookies', async () => {
  process.env.NODE_ENV = 'production';
  try {
    assert.throws(() => createApp({ frontendDist: false }), /SESSION_SECRET/);
    process.env.CORS_ORIGIN = 'https://app.example';
    const app = createApp({ sessionSecret: 'x', rateLimit: false, frontendDist: false });
    const res = await request(app).post('/adduser').set('X-Forwarded-Proto', 'https').send(newUser).expect(201);
    const cookie = res.headers['set-cookie'][0];
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=None/);
  } finally {
    delete process.env.NODE_ENV;
    delete process.env.CORS_ORIGIN;
  }
});

test('sign-in endpoints are rate limited', async () => {
  const app = createApp({ sessionSecret: 'x', frontendDist: false });
  let last;
  for (let i = 0; i < 21; i++) last = await request(app).post('/loginuser').send({});
  assert.equal(last.status, 429);
  assert.match(last.body.error, /Too many attempts/);
});

test('featured blogs have ids and can be opened', async () => {
  const list = (await request(t.app()).get('/blogs').expect(200)).body;
  assert.match(list[0]._id, /^featured-\d+$/);
  const one = (await request(t.app()).get(`/posts/${list[0]._id}`).expect(200)).body;
  assert.equal(one.title, list[0].title);
  assert.equal(one.featured, true);
  await request(t.app()).get('/posts/featured-999').expect(404);
  await request(t.app()).get('/posts/not-an-id').expect(404);
  await request(t.app()).get('/posts/0123456789abcdef01234567').expect(404);
});

test('Image Pool manifest lists exactly the pictures the API accepts', () => {
  // frontend/public/picyourpic/manifest.json drives the gallery and editor; regenerate it when adding pictures.
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'public', 'picyourpic', 'manifest.json'), 'utf8'));
  assert.deepEqual([...manifest].sort(), [...GALLERY_IMAGES].sort());
});

test('posting a blog requires login, validates, and uses the session user', async () => {
  await request(t.app()).post('/addblog').send(newBlog).expect(401);

  const agent = await t.agent();
  assert.match((await agent.post('/addblog').send({ ...newBlog, title: '' }).expect(400)).body.error, /title/);
  assert.match((await agent.post('/addblog').send({ ...newBlog, blogp2: '<p>  </p>' }).expect(400)).body.error, /blogp2/);
  await agent.post('/addblog').send({ ...newBlog, img: 'doesnotexist' }).expect(400);
  await agent.post('/addblog').send({ ...newBlog, title: 'x'.repeat(201) }).expect(400); // schema limit

  const res = await agent.post('/addblog').send({ ...newBlog, auth: 'someone-else', date: 'Nov 01, 2026' }).expect(201);
  assert.equal(res.body.auth, 'blogger1');
  assert.equal(res.body.authName, 'Asha Rao');
  assert.equal(res.body.status, 'published');
  assert.equal(res.body.date, 'Nov 01, 2026'); // a client-supplied display date is kept

  const all = await request(t.app()).get('/BAdd').expect(200);
  assert.equal(all.body.length, 1);
  assert.equal(all.body[0].title, 'My trip');
  assert.equal(all.body[0].authName, 'Asha Rao');

  const me = await agent.get('/myacc').expect(200);
  assert.equal(me.body.blogs.length, 1);
});

test('opening a post counts a view; likes toggle per user and hide who liked', async () => {
  const author = await t.agent();
  const { _id } = (await author.post('/addblog').send(newBlog).expect(201)).body;

  const first = (await request(t.app()).get(`/posts/${_id}`).expect(200)).body;
  const second = (await request(t.app()).get(`/posts/${_id}`).expect(200)).body;
  assert.equal(second.views, first.views + 1);
  assert.equal(second.likedBy, undefined);

  await request(t.app()).post(`/posts/${_id}/like`).expect(401);
  assert.deepEqual((await author.post(`/posts/${_id}/like`).expect(200)).body, { likes: 1, liked: true });
  const reader = await t.agent({ username: 'reader1', name: 'Ravi', email: 'r@example.com', password: 'secret123' });
  assert.deepEqual((await reader.post(`/posts/${_id}/like`).expect(200)).body, { likes: 2, liked: true });
  assert.deepEqual((await author.post(`/posts/${_id}/like`).expect(200)).body, { likes: 1, liked: false });
  await reader.post('/posts/nope/like').expect(404);

  const asReader = (await reader.get(`/posts/${_id}`).expect(200)).body;
  assert.equal(asReader.liked, true);
  assert.equal(asReader.likes, 1);
  const listed = (await reader.get('/BAdd').expect(200)).body[0];
  assert.equal(listed.likes, 1);
  assert.equal(listed.liked, true);
  assert.equal(listed.likedBy, undefined);
});

test('blogs stored by the 2018 app (no likes, views, status or schedule) still work', async () => {
  const author = await t.agent();
  const { insertedId } = await Blog.collection.insertOne({
    auth: 'blogger1', title: 'Old', cate: 'Art', date: '01-JAN-2018', img: 'img1', blogp1: 'Hi', blogp2: 'Line one\nline two\n\nNext <para>',
    createdAt: new Date('2018-01-01'),
  });
  const id = insertedId.toString();
  const one = (await request(t.app()).get(`/posts/${id}`).expect(200)).body;
  assert.equal(one.views, 1);
  assert.equal(one.likes, 0);
  assert.equal(one.status, 'published');
  assert.equal(one.blogp2, '<p>Line one<br>line two</p><p>Next &lt;para&gt;</p>');
  assert.deepEqual((await author.post(`/posts/${id}/like`).expect(200)).body, { likes: 1, liked: true });
});

test('only the author can delete a blog', async () => {
  const author = await t.agent();
  const { _id } = (await author.post('/addblog').send(newBlog).expect(201)).body;
  const other = await t.agent({ username: 'other1', name: 'Other', email: 'o@example.com', password: 'secret123' });

  await request(t.app()).delete(`/posts/${_id}`).expect(401);
  await other.delete(`/posts/${_id}`).expect(403);
  await author.delete(`/posts/${_id}`).expect(200);
  await author.delete(`/posts/${_id}`).expect(404);
  await author.delete('/posts/featured-1').expect(404);
  assert.equal(await Blog.countDocuments(), 0);
});

test('stats and leaderboard count live stories and show display names', async () => {
  let stats = (await request(t.app()).get('/stats').expect(200)).body;
  assert.equal(stats.likes, 0); // nothing published yet

  const author = await t.agent();
  const { _id } = (await author.post('/addblog').send(newBlog).expect(201)).body;
  await author.post('/addblog').send({ ...newBlog, title: 'Second', cate: 'Art' }).expect(201);
  await author.post('/addblog').send({ ...newBlog, title: 'Draft', cate: 'Secret', status: 'draft' }).expect(201);
  await author.post(`/posts/${_id}/like`).expect(200);
  await User.collection.insertOne({ username: 'noname', email: 'n@example.com', passwordHash: 'x:y' });
  await Blog.create({ ...newBlog, auth: 'noname', status: 'published', publishAt: new Date() });

  stats = (await request(t.app()).get('/stats').expect(200)).body;
  assert.equal(stats.writers, 2);
  assert.ok(stats.blogs >= 3);
  assert.equal(stats.categories, 3); // travel, vacation, art (the draft's topic is not counted)
  assert.equal(stats.likes, 1);

  const board = (await request(t.app()).get('/leaderboard').expect(200)).body;
  assert.deepEqual(board[0], { username: 'blogger1', name: 'Asha Rao', posts: 2, likes: 1, views: 0 });
  assert.deepEqual(board[1], { username: 'noname', name: 'noname', posts: 1, likes: 0, views: 0 });
});
