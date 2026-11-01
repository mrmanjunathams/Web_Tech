const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const mongoose = require('mongoose');
const { User, Blog, Subscriber, serializeBlog, namesOf, liveFilter, statusOf } = require('./models');
const { toHtml, plainText } = require('./content');
const { sendWelcomeEmail } = require('./mailer');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FRONTEND_ROOT = path.join(__dirname, '..', '..', 'frontend');
// Built Angular app ("npm run build" in frontend/). Served when present.
const FRONTEND_DIST = path.resolve(process.env.FRONTEND_DIST || path.join(FRONTEND_ROOT, 'dist', 'frontend', 'browser'));
// Image Pool pictures, used to validate the image name of a new blog.
const IMAGE_DIR = path.resolve(process.env.IMAGE_DIR || path.join(FRONTEND_ROOT, 'public', 'picyourpic'));

// Image names a blog may reference ("img5" -> picyourpic/img5.jpg).
const GALLERY_IMAGES = new Set(
  fs.readdirSync(IMAGE_DIR)
    .filter((f) => f.toLowerCase().endsWith('.jpg'))
    .map((f) => f.slice(0, -4))
);

const USERNAME_RE = /^[A-Za-z0-9_.-]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/;
const MAX_SCHEDULE_MS = 366 * 24 * 60 * 60 * 1000;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const bodyOf = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {});

/** Blog display date, e.g. "01-NOV-2026" (the format of the seed data). */
const displayDate = (d) => `${String(d.getUTCDate()).padStart(2, '0')}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;

/** Display name rule: 1-60 visible characters. Returns an error message, or '' when valid. */
function nameError(name) {
  if (!name || name.length > 60 || CONTROL_RE.test(name)) return 'Please enter your name (up to 60 characters).';
  return '';
}

function badRequest(res, error) {
  return res.status(400).json({ error });
}

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Please sign in first.' });
  next();
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
}

/**
 * Blog fields from a create (`current` null) or edit request, validated for the resulting status.
 * Drafts may be incomplete; published (and scheduled) stories need every field.
 * @returns {{ fields: object } | { error: string }}
 */
function blogFields(body, current, now = new Date()) {
  const has = (k) => body[k] !== undefined;
  const pick = (k) => (has(k) ? str(body[k]) : current ? current[k] : '');
  const fields = {
    title: pick('title'),
    cate: pick('cate'),
    img: pick('img'),
    blogp1: pick('blogp1'),
    blogp2: has('blogp2') ? toHtml(body.blogp2) : current ? current.blogp2 : '',
    status: body.status === 'draft' || body.status === 'published' ? body.status : current ? current.status : 'published',
  };

  let publishAt = current ? current.publishAt : null;
  if (has('publishAt')) {
    publishAt = body.publishAt === null || body.publishAt === '' ? null : new Date(body.publishAt);
    if (publishAt && (Number.isNaN(publishAt.getTime()) || typeof body.publishAt === 'boolean')) {
      return { error: 'publishAt must be a date.' };
    }
    if (publishAt && publishAt - now > MAX_SCHEDULE_MS) return { error: 'You can schedule up to a year ahead.' };
  }

  const wasLive = Boolean(current && statusOf(current, now) === 'published');
  if (fields.status === 'published') {
    // Not scheduled for the future: go live now, or keep the original time of an already-live story.
    if (!publishAt || publishAt <= now) publishAt = wasLive && current.publishAt ? current.publishAt : now;
    const missing = ['title', 'cate', 'img', 'blogp1'].filter((k) => !fields[k]);
    if (!plainText(fields.blogp2)) missing.push('blogp2');
    if (missing.length) return { error: `Missing fields: ${missing.join(', ')}` };
  } else if (!fields.title && !fields.blogp1 && !plainText(fields.blogp2)) {
    return { error: 'A draft needs a title or some text.' };
  }
  if (fields.img && !GALLERY_IMAGES.has(fields.img)) return { error: 'Image name must be one from the Image Pool (e.g. img5).' };

  // Display date: what the client sent, else the go-live date (kept for live stories whose time did not change).
  const sameTime = wasLive && publishAt && current.publishAt && publishAt.getTime() === new Date(current.publishAt).getTime();
  if (str(body.date)) fields.date = str(body.date);
  else if (fields.status === 'published') fields.date = sameTime && current.date ? current.date : displayDate(publishAt);
  else fields.date = current ? current.date : '';

  fields.publishAt = publishAt;
  return { fields };
}

/**
 * Builds the Express app: the JSON API, plus the built Angular frontend when one exists.
 * @param {{ sessionStore?: import('express-session').Store, sessionSecret?: string, rateLimit?: boolean, frontendDist?: string | false }} [options]
 */
function createApp(options = {}) {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';
  const secret = options.sessionSecret || process.env.SESSION_SECRET;
  if (!secret && isProd) throw new Error('SESSION_SECRET must be set in production');

  if (isProd) app.set('trust proxy', 1);

  // CSP is off because the frontend uses inline styles and Google Fonts.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  // Only needed when the frontend is hosted on a different origin than this API.
  const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
  if (corsOrigins.length) {
    app.use((req, res, next) => {
      const origin = req.get('Origin');
      if (origin && corsOrigins.includes(origin)) {
        res.set({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', Vary: 'Origin' });
        if (req.method === 'OPTIONS') {
          res.set({ 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
          return res.sendStatus(204);
        }
      }
      next();
    });
  }
  // Rich-text bodies are larger than the old two paragraphs.
  app.use(express.json({ limit: '512kb' }));
  app.use(
    session({
      name: 'bb.sid',
      secret: secret || 'dev-only-insecure-secret',
      store: options.sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: corsOrigins.length && isProd ? 'none' : 'lax', secure: isProd, maxAge: 7 * 24 * 60 * 60 * 1000 },
    })
  );

  const authLimiter =
    options.rateLimit === false
      ? (req, res, next) => next()
      : rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
          message: { error: 'Too many attempts, please try again later.' } });

  /** Serializes blogs with their authors' display names. */
  async function blogsJson(blogs, username) {
    const names = await namesOf(blogs.map((b) => b.auth));
    return blogs.map((b) => serializeBlog(b, username, names));
  }

  async function accountJson(user) {
    const blogs = await Blog.find({ auth: user.username }).sort({ updatedAt: -1 }).lean();
    return { ...user.toPublic(), blogs: await blogsJson(blogs, user.username) };
  }

  /** The signed-in author's own blog, or an error response. */
  async function ownBlog(req, res) {
    const { id } = req.params;
    const blog = mongoose.isValidObjectId(id) ? await Blog.findById(id) : null;
    if (!blog) return void res.status(404).json({ error: 'Blog not found.' });
    if (blog.auth !== req.session.username) return void res.status(403).json({ error: 'You can only change your own blogs.' });
    return blog;
  }

  /* ---- API ---- */
  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // Featured blogs shown on the BLOG page (static content), addressable as /posts/featured-<no>.
  const featured = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'blogs.json'), 'utf8')).map(({ no, ...b }) => ({
    _id: `featured-${no}`,
    ...b,
    blogp2: toHtml(b.blogp2),
    authName: b.auth,
    status: 'published',
    publishAt: null,
    featured: true,
    likes: 0,
    liked: false,
    views: 0,
  }));
  app.get('/blogs', (req, res) => res.json(featured));
  // Original static category data (kept for compatibility; the CATEGORY page uses /BAdd).
  app.get('/cate', (req, res) => res.sendFile(path.join(DATA_DIR, 'seed-blogs.json')));

  // All live blogs, newest first (drafts and not-yet-due scheduled stories are hidden).
  app.get('/BAdd', async (req, res) => {
    const blogs = await Blog.find(liveFilter()).sort({ publishAt: -1, createdAt: -1 }).lean();
    res.json(await blogsJson(blogs, req.session.username));
  });

  // One blog (live, featured, or the signed-in author's own draft/scheduled one). Counts a view for live blogs.
  app.get('/posts/:id', async (req, res) => {
    const { id } = req.params;
    const feat = featured.find((b) => b._id === id);
    if (feat) return res.json(feat);
    const blog = mongoose.isValidObjectId(id) ? await Blog.findById(id).lean() : null;
    const live = blog && statusOf(blog) === 'published';
    if (!blog || (!live && blog.auth !== req.session.username)) return res.status(404).json({ error: 'Blog not found.' });
    if (live) {
      await Blog.updateOne({ _id: id }, { $inc: { views: 1 } });
      blog.views = (blog.views || 0) + 1;
    }
    res.json((await blogsJson([blog], req.session.username))[0]);
  });

  // Toggles the signed-in user's like (live blogs only).
  app.post('/posts/:id/like', requireLogin, async (req, res) => {
    const { id } = req.params;
    const current = mongoose.isValidObjectId(id) ? await Blog.findOne({ _id: id, ...liveFilter() }, { likedBy: 1 }).lean() : null;
    if (!current) return res.status(404).json({ error: 'Blog not found.' });
    const username = req.session.username;
    const liked = !(current.likedBy || []).includes(username); // blogs from the 2018 app have no likedBy
    const blog = await Blog.findByIdAndUpdate(
      id, liked ? { $addToSet: { likedBy: username } } : { $pull: { likedBy: username } }, { returnDocument: 'after' }
    ).lean();
    res.json({ likes: blog.likedBy.length, liked });
  });

  // Authors edit their own blogs: content, draft/publish, schedule.
  app.patch('/posts/:id', requireLogin, async (req, res) => {
    const blog = await ownBlog(req, res);
    if (!blog) return;
    const result = blogFields(bodyOf(req), blog);
    if (result.error) return badRequest(res, result.error);
    blog.set(result.fields);
    await blog.save();
    res.json((await blogsJson([blog], req.session.username))[0]);
  });

  // Authors can delete their own blogs.
  app.delete('/posts/:id', requireLogin, async (req, res) => {
    const blog = await ownBlog(req, res);
    if (!blog) return;
    await Blog.deleteOne({ _id: blog._id });
    res.json({ message: 'deleted' });
  });

  // Site-wide numbers for the home page (live blogs only).
  app.get('/stats', async (req, res) => {
    const live = liveFilter();
    const [blogs, writers, cates, likes] = await Promise.all([
      Blog.countDocuments(live),
      User.estimatedDocumentCount(),
      Blog.distinct('cate', live),
      Blog.aggregate([{ $match: live }, { $group: { _id: null, n: { $sum: { $size: { $ifNull: ['$likedBy', []] } } } } }]),
    ]);
    const categories = new Set(cates.flatMap((c) => c.split('|').map((s) => s.trim().toLowerCase()).filter(Boolean)));
    res.json({ blogs: blogs + featured.length, writers, categories: categories.size, likes: likes[0]?.n || 0 });
  });

  // Writers ranked by likes received, then by posts (live blogs only).
  app.get('/leaderboard', async (req, res) => {
    const rows = await Blog.aggregate([
      { $match: liveFilter() },
      { $group: { _id: '$auth', posts: { $sum: 1 }, likes: { $sum: { $size: { $ifNull: ['$likedBy', []] } } }, views: { $sum: '$views' } } },
      { $sort: { likes: -1, posts: -1, views: -1, _id: 1 } },
      { $limit: 10 },
    ]);
    const names = await namesOf(rows.map((r) => r._id));
    res.json(rows.map(({ _id, ...r }) => ({ username: _id, name: names.get(_id) || _id, ...r })));
  });

  app.post('/adduser', authLimiter, async (req, res) => {
    const body = bodyOf(req);
    const username = str(body.username);
    const name = str(body.name);
    const email = str(body.email).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';

    if (!USERNAME_RE.test(username)) return badRequest(res, 'Username must be 3-30 characters: letters, numbers, . _ -');
    if (nameError(name)) return badRequest(res, nameError(name));
    if (!EMAIL_RE.test(email)) return badRequest(res, 'Please enter a valid email address.');
    if (password.length < 6 || password.length > 128) return badRequest(res, 'Password must be 6-128 characters.');

    const existing = await User.findOne({ $or: [{ username }, { email }] }).lean();
    if (existing) {
      const field = existing.username === username ? 'username' : 'email';
      return res.status(409).json({ error: `That ${field} is already registered.` });
    }

    const user = new User({ username, name, email });
    await user.setPassword(password);
    try {
      await user.save();
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ error: 'That username or email is already registered.' });
      throw err;
    }

    await regenerateSession(req);
    req.session.userId = user.id;
    req.session.username = user.username;

    sendWelcomeEmail(user); // fire and forget
    res.status(201).json(user.toPublic());
  });

  app.post('/loginuser', authLimiter, async (req, res) => {
    const body = bodyOf(req);
    const username = str(body.username);
    const password = typeof body.password === 'string' ? body.password : '';
    if (!username || !password) return badRequest(res, 'Username and password are required.');

    const user = await User.findOne({ username });
    if (!user || !(await user.checkPassword(password))) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    await regenerateSession(req);
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ message: 'successful login', username: user.username, name: user.name || '' });
  });

  app.post('/logout', (req, res, next) => {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie('bb.sid');
      res.json({ message: 'logged out' });
    });
  });

  /** The signed-in user, or a 401 (also when the account no longer exists). */
  async function currentUser(req, res) {
    const user = await User.findById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      res.status(401).json({ error: 'Please sign in first.' });
    }
    return user;
  }

  // Signed-in user's profile plus all their blogs (drafts and scheduled ones included), recently edited first.
  app.get('/myacc', requireLogin, async (req, res) => {
    const user = await currentUser(req, res);
    if (user) res.json(await accountJson(user));
  });

  // Profile update: display name.
  app.patch('/myacc', requireLogin, async (req, res) => {
    const name = str(bodyOf(req).name);
    if (nameError(name)) return badRequest(res, nameError(name));
    const user = await currentUser(req, res);
    if (!user) return;
    user.name = name;
    await user.save();
    res.json(await accountJson(user));
  });

  // Publish now, schedule (publishAt in the future) or save a draft (status: 'draft').
  app.post('/addblog', requireLogin, async (req, res) => {
    const result = blogFields(bodyOf(req), null);
    if (result.error) return badRequest(res, result.error);
    const saved = await Blog.create({ ...result.fields, auth: req.session.username });
    res.status(201).json((await blogsJson([saved], req.session.username))[0]);
  });

  app.post('/subscribe', async (req, res) => {
    const email = str(bodyOf(req).email).toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254) return badRequest(res, 'Please enter a valid email address.');
    await Subscriber.updateOne({ email }, { $setOnInsert: { email } }, { upsert: true });
    res.status(201).json({ message: 'subscribed' });
  });

  /* ---- Frontend (production build) ---- */
  const frontendDist = options.frontendDist === undefined ? FRONTEND_DIST : options.frontendDist;
  if (frontendDist && fs.existsSync(path.join(frontendDist, 'index.html'))) {
    app.use(express.static(frontendDist));
  } else if (frontendDist) {
    app.get('/', (req, res) =>
      res.type('text').send('API is running. Build the frontend ("npm run build") or use "ng serve" on port 4200.'));
  }

  /* ---- Errors ---- */
  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return badRequest(res, 'Invalid JSON body.');
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That story is too long.' });
    if (err.name === 'ValidationError') return badRequest(res, err.message);
    console.error(err);
    res.status(err.status || 500).json({ error: 'Something went wrong. Please try again.' });
  });

  return app;
}

/** Inserts the bundled sample blogs when the blogs collection is empty. */
async function seedBlogs() {
  if ((await Blog.estimatedDocumentCount()) > 0) return 0;
  const seed = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'seed-blogs.json'), 'utf8'));
  const docs = await Blog.insertMany(seed.map(({ no, ...b }) => ({ ...b, status: 'published', publishAt: new Date() })));
  return docs.length;
}

/** Brings blogs stored before drafts/scheduling existed up to date: published, live since they were created. */
async function migrateBlogs() {
  const status = await Blog.collection.updateMany({ status: { $exists: false } }, { $set: { status: 'published' } });
  const live = await Blog.collection.updateMany(
    { status: 'published', publishAt: null },
    [{ $set: { publishAt: { $ifNull: ['$createdAt', '$$NOW'] } } }]
  );
  return status.modifiedCount + live.modifiedCount;
}

module.exports = { createApp, seedBlogs, migrateBlogs, displayDate, GALLERY_IMAGES };
