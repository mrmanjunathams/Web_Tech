// Drafts, scheduled publishing and editing stories.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { Blog } = require('../src/models');
const { displayDate } = require('../src/app');
const { useTestApp, newBlog } = require('./helpers');

const t = useTestApp();
const DAY = 24 * 60 * 60 * 1000;
const other = { username: 'other1', name: 'Other Writer', email: 'o@example.com', password: 'secret123' };

test('drafts can be incomplete, stay private and show up in the author\'s dashboard', async () => {
  const author = await t.agent();
  await author.post('/addblog').send({ status: 'draft' }).expect(400); // needs at least a title or text
  await author.post('/addblog').send({ status: 'draft', blogp2: '<p> </p>' }).expect(400);
  await author.post('/addblog').send({ status: 'draft', title: 'Idea', img: 'nope' }).expect(400);

  const draft = (await author.post('/addblog').send({ status: 'draft', title: 'Half an idea' }).expect(201)).body;
  assert.equal(draft.status, 'draft');
  assert.equal(draft.date, '');
  assert.equal(draft.publishAt, null);
  await author.post('/addblog').send({ status: 'draft', blogp1: 'Only an opening' }).expect(201);
  await author.post('/addblog').send({ status: 'draft', blogp2: '<p>Only a body</p>' }).expect(201);

  assert.equal((await request(t.app()).get('/BAdd').expect(200)).body.length, 0);
  await request(t.app()).get(`/posts/${draft._id}`).expect(404); // not for the public
  const reader = await t.agent(other);
  await reader.get(`/posts/${draft._id}`).expect(404);
  await reader.post(`/posts/${draft._id}/like`).expect(404);
  const mine = (await author.get(`/posts/${draft._id}`).expect(200)).body; // the author can open it
  assert.equal(mine.views, 0); // and it doesn't count as a view

  const account = (await author.get('/myacc').expect(200)).body;
  assert.equal(account.blogs.length, 3);
  assert.ok(account.blogs.every((b) => b.status === 'draft'));
});

test('a draft can be finished and published later', async () => {
  const author = await t.agent();
  const { _id } = (await author.post('/addblog').send({ status: 'draft', title: 'Trip' }).expect(201)).body;

  // Publishing validates every field.
  const missing = (await author.patch(`/posts/${_id}`).send({ status: 'published' }).expect(400)).body.error;
  assert.equal(missing, 'Missing fields: cate, img, blogp1, blogp2');

  // Edit in steps, still a draft.
  const step = (await author.patch(`/posts/${_id}`).send({ cate: 'Travel', img: 'img2', blogp1: 'Opening' }).expect(200)).body;
  assert.equal(step.status, 'draft');
  assert.equal(step.title, 'Trip');

  const live = (await author.patch(`/posts/${_id}`).send({ status: 'published', blogp2: '<h2>Day one</h2><p>Go</p>' }).expect(200)).body;
  assert.equal(live.status, 'published');
  assert.equal(live.date, displayDate(new Date(live.publishAt)));
  assert.equal((await request(t.app()).get('/BAdd').expect(200)).body.length, 1);
});

test('scheduled stories stay hidden until their time, then go live on their own', async () => {
  const author = await t.agent();
  const when = new Date(Date.now() + 2 * DAY);
  const scheduled = (await author.post('/addblog').send({ ...newBlog, publishAt: when.toISOString() }).expect(201)).body;
  assert.equal(scheduled.status, 'scheduled');
  assert.equal(scheduled.date, displayDate(when));

  assert.equal((await request(t.app()).get('/BAdd').expect(200)).body.length, 0);
  await request(t.app()).get(`/posts/${scheduled._id}`).expect(404);
  assert.equal((await author.get(`/posts/${scheduled._id}`).expect(200)).body.status, 'scheduled');
  assert.equal((await request(t.app()).get('/leaderboard').expect(200)).body.length, 0);

  // Time passes (simulated by moving the schedule into the past).
  await Blog.updateOne({ _id: scheduled._id }, { publishAt: new Date(Date.now() - 1000) });
  const list = (await request(t.app()).get('/BAdd').expect(200)).body;
  assert.equal(list.length, 1);
  assert.equal(list[0].status, 'published');
});

test('schedule validation: real dates, at most a year ahead; past times publish now', async () => {
  const author = await t.agent();
  for (const publishAt of ['not a date', true, new Date(Date.now() + 400 * DAY).toISOString()]) {
    await author.post('/addblog').send({ ...newBlog, publishAt }).expect(400);
  }
  const past = (await author.post('/addblog').send({ ...newBlog, publishAt: '2001-01-01T00:00:00Z' }).expect(201)).body;
  assert.equal(past.status, 'published');
  assert.ok(Date.now() - new Date(past.publishAt) < 60_000);
  const none = (await author.post('/addblog').send({ ...newBlog, publishAt: '' }).expect(201)).body;
  assert.equal(none.status, 'published');
  const drafted = (await author.post('/addblog').send({ status: 'draft', title: 'Later', publishAt: null }).expect(201)).body;
  assert.equal(drafted.publishAt, null);
  // A draft can remember a planned time without going live.
  const planned = new Date(Date.now() + DAY).toISOString();
  assert.equal((await author.post('/addblog').send({ status: 'draft', title: 'Plan', publishAt: planned }).expect(201)).body.status, 'draft');
});

test('editing: content updates, schedule changes, unpublishing, and keeping the original date', async () => {
  const author = await t.agent();
  const created = (await author.post('/addblog').send({ ...newBlog, date: '01-JAN-2020' }).expect(201)).body;

  // Editing a live story keeps its publish time and display date.
  const edited = (await author.patch(`/posts/${created._id}`).send({ title: 'My trip (updated)', blogp2: '<p>New <em>body</em></p>' }).expect(200)).body;
  assert.equal(edited.title, 'My trip (updated)');
  assert.equal(edited.blogp2, '<p>New <em>body</em></p>');
  assert.equal(edited.publishAt, created.publishAt);
  assert.equal(edited.date, '01-JAN-2020');
  assert.equal(edited.authName, 'Asha Rao');

  // Reschedule into the future: hidden again until then.
  const later = new Date(Date.now() + DAY);
  const moved = (await author.patch(`/posts/${created._id}`).send({ publishAt: later.toISOString() }).expect(200)).body;
  assert.equal(moved.status, 'scheduled');
  assert.equal(moved.date, displayDate(later));

  // "Publish now" on a scheduled story.
  const now = (await author.patch(`/posts/${created._id}`).send({ publishAt: null }).expect(200)).body;
  assert.equal(now.status, 'published');
  assert.ok(new Date(now.publishAt) <= new Date());

  // Back to draft (unpublish), then a live story whose date was never set gets one on the next edit.
  const unpublished = (await author.patch(`/posts/${created._id}`).send({ status: 'draft' }).expect(200)).body;
  assert.equal(unpublished.status, 'draft');
  await Blog.updateOne({ _id: created._id }, { status: 'published', date: '' });
  const dated = (await author.patch(`/posts/${created._id}`).send({ title: 'Dated' }).expect(200)).body;
  assert.equal(dated.date, displayDate(new Date(dated.publishAt)));
  // An explicit display date wins.
  assert.equal((await author.patch(`/posts/${created._id}`).send({ date: '02-FEB-2022' }).expect(200)).body.date, '02-FEB-2022');
  // Validation still applies to edits.
  await author.patch(`/posts/${created._id}`).send({ title: '' }).expect(400);
  await author.patch(`/posts/${created._id}`).send(['array']).expect(200); // ignored body: nothing changes
});

test('only the author can edit, and only real stories', async () => {
  const author = await t.agent();
  const { _id } = (await author.post('/addblog').send(newBlog).expect(201)).body;
  const reader = await t.agent(other);
  await request(t.app()).patch(`/posts/${_id}`).send({ title: 'x' }).expect(401);
  await reader.patch(`/posts/${_id}`).send({ title: 'Hijacked' }).expect(403);
  await author.patch('/posts/featured-1').send({ title: 'x' }).expect(404);
  await author.patch('/posts/0123456789abcdef01234567').send({ title: 'x' }).expect(404);
  assert.equal((await Blog.findById(_id).lean()).title, 'My trip');
});

test('story HTML is sanitized on the way in', async () => {
  const author = await t.agent();
  const body = '<h1>Big</h1><p onclick="x()">Hi <script>alert(1)</script><a href="javascript:alert(1)">bad</a> <a href="https://ok.example">ok</a></p><img src=x onerror=alert(1)>';
  const saved = (await author.post('/addblog').send({ ...newBlog, blogp2: body }).expect(201)).body;
  assert.equal(
    saved.blogp2,
    '<h2>Big</h2><p>Hi  <a href="https://ok.example" target="_blank" rel="noopener noreferrer nofollow">ok</a></p>'
  );
});

test('migrateBlogs upgrades blogs stored before drafts and scheduling', async () => {
  const { migrateBlogs } = require('../src/app');
  const created = new Date('2019-05-05');
  await Blog.collection.insertMany([
    { auth: 'a', title: 'Old', createdAt: created },
    { auth: 'a', title: 'Older, no timestamps' },
    { auth: 'a', title: 'Draft', status: 'draft', publishAt: null },
  ]);
  assert.equal(await migrateBlogs(), 4); // 2 get a status, 2 get a publish time
  const old = await Blog.findOne({ title: 'Old' }).lean();
  assert.equal(old.status, 'published');
  assert.deepEqual(old.publishAt, created);
  assert.ok((await Blog.findOne({ title: 'Older, no timestamps' }).lean()).publishAt instanceof Date);
  assert.equal((await Blog.findOne({ title: 'Draft' }).lean()).publishAt, null);
  assert.equal(await migrateBlogs(), 0);
});
