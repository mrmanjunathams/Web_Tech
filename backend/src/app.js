const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { User, Blog, Subscriber } = require('./models');
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

const str = (v) => (typeof v === 'string' ? v.trim() : '');

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
          res.set({ 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
          return res.sendStatus(204);
        }
      }
      next();
    });
  }
  app.use(express.json({ limit: '100kb' }));
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

  /* ---- API ---- */
  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // Featured blogs shown on the BLOG page (static content).
  app.get('/blogs', (req, res) => res.sendFile(path.join(DATA_DIR, 'blogs.json')));
  // Original static category data (kept for compatibility; the CATEGORY page uses /BAdd).
  app.get('/cate', (req, res) => res.sendFile(path.join(DATA_DIR, 'seed-blogs.json')));

  // All user-published blogs, newest first.
  app.get('/BAdd', async (req, res) => {
    const blogs = await Blog.find({}, { __v: 0 }).sort({ createdAt: -1 }).lean();
    res.json(blogs);
  });

  app.post('/adduser', authLimiter, async (req, res) => {
    const username = str(req.body?.username);
    const email = str(req.body?.email).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!USERNAME_RE.test(username)) return badRequest(res, 'Username must be 3-30 characters: letters, numbers, . _ -');
    if (!EMAIL_RE.test(email)) return badRequest(res, 'Please enter a valid email address.');
    if (password.length < 6 || password.length > 128) return badRequest(res, 'Password must be 6-128 characters.');

    const existing = await User.findOne({ $or: [{ username }, { email }] }).lean();
    if (existing) {
      const field = existing.username === username ? 'username' : 'email';
      return res.status(409).json({ error: `That ${field} is already registered.` });
    }

    const user = new User({ username, email });
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
    const username = str(req.body?.username);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!username || !password) return badRequest(res, 'Username and password are required.');

    const user = await User.findOne({ username });
    if (!user || !(await user.checkPassword(password))) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    await regenerateSession(req);
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ message: 'successful login', username: user.username });
  });

  app.post('/logout', (req, res, next) => {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie('bb.sid');
      res.json({ message: 'logged out' });
    });
  });

  // Signed-in user's profile plus the blogs they published.
  app.get('/myacc', requireLogin, async (req, res) => {
    const user = await User.findById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'Please sign in first.' });
    }
    const blogs = await Blog.find({ auth: user.username }, { __v: 0 }).sort({ createdAt: -1 }).lean();
    res.json({ ...user.toPublic(), blogs });
  });

  app.post('/addblog', requireLogin, async (req, res) => {
    const blog = {
      auth: req.session.username,
      title: str(req.body?.title),
      cate: str(req.body?.cate),
      date: str(req.body?.date),
      img: str(req.body?.img),
      blogp1: str(req.body?.blogp1),
      blogp2: str(req.body?.blogp2),
    };
    const missing = Object.keys(blog).filter((k) => !blog[k]);
    if (missing.length) return badRequest(res, `Missing fields: ${missing.join(', ')}`);
    if (!GALLERY_IMAGES.has(blog.img)) return badRequest(res, 'Image name must be one from the Image Pool (e.g. img5).');

    const saved = await Blog.create(blog);
    res.status(201).json(saved.toObject({ versionKey: false }));
  });

  app.post('/subscribe', async (req, res) => {
    const email = str(req.body?.email).toLowerCase();
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
  const docs = await Blog.insertMany(seed.map(({ no, ...b }) => b));
  return docs.length;
}

module.exports = { createApp, seedBlogs, GALLERY_IMAGES };
