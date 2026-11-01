const crypto = require('node:crypto');
const { promisify } = require('node:util');
const mongoose = require('mongoose');
const { toHtml } = require('./content');

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

/* Users ------------------------------------------------------------------ */
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
    // Display name shown across the site; accounts created before names existed have none (UI falls back to username).
    name: { type: String, trim: true, maxlength: 60, default: '' },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function (password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, KEY_LENGTH);
  this.passwordHash = `${salt}:${key.toString('hex')}`;
};

userSchema.methods.checkPassword = async function (password) {
  const [salt, stored] = (this.passwordHash || '').split(':');
  if (!salt || !stored) return false;
  const key = await scrypt(password, salt, KEY_LENGTH);
  const storedBuf = Buffer.from(stored, 'hex');
  return storedBuf.length === key.length && crypto.timingSafeEqual(storedBuf, key);
};

userSchema.methods.toPublic = function () {
  return { username: this.username, name: this.name || '', email: this.email, createdAt: this.createdAt };
};

/* Blogs ------------------------------------------------------------------ */
// Required fields are checked by the API, because drafts may be incomplete.
const blogSchema = new mongoose.Schema(
  {
    auth: { type: String, required: true, trim: true }, // author's username
    title: { type: String, trim: true, maxlength: 200, default: '' },
    cate: { type: String, trim: true, maxlength: 100, default: '' },
    date: { type: String, trim: true, maxlength: 40, default: '' }, // display date, e.g. "01-NOV-2026"
    img: { type: String, trim: true, default: '' },
    blogp1: { type: String, maxlength: 20000, default: '' }, // opening paragraph, plain text (also the excerpt)
    blogp2: { type: String, maxlength: 200000, default: '' }, // story body, sanitized HTML
    status: { type: String, enum: ['draft', 'published'], default: 'published' },
    publishAt: { type: Date, default: null }, // published stories go live at this time (scheduled when in the future)
    likedBy: { type: [String], default: [] }, // usernames
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

blogSchema.index({ auth: 1, createdAt: -1 });
blogSchema.index({ status: 1, publishAt: -1 });

/** Query for stories the public can see: published, and live (no schedule, or the schedule has passed). */
const liveFilter = () => ({ status: { $ne: 'draft' }, $or: [{ publishAt: null }, { publishAt: { $lte: new Date() } }] });

/** 'draft', 'scheduled' (published with a future publishAt) or 'published'. */
function statusOf(b, now = new Date()) {
  if (b.status === 'draft') return 'draft';
  return b.publishAt && new Date(b.publishAt) > now ? 'scheduled' : 'published';
}

/* Newsletter subscribers -------------------------------------------------- */
const subscriberSchema = new mongoose.Schema(
  { email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254 } },
  { timestamps: true }
);

/**
 * API shape of a blog: a like count instead of the likers list, whether `username` liked it, the author's
 * display name (`authName`, from `names`), the computed status, and the body always as HTML.
 */
function serializeBlog(b, username, names) {
  const { likedBy = [], __v, ...rest } = b.toObject ? b.toObject() : b;
  return {
    ...rest,
    blogp2: toHtml(rest.blogp2),
    authName: names.get(rest.auth) || rest.auth,
    status: statusOf(rest),
    publishAt: rest.publishAt || null,
    likes: likedBy.length,
    liked: Boolean(username && likedBy.includes(username)),
    views: rest.views || 0,
  };
}

// Collection names match the original app ("users" / "blogs").
const User = mongoose.model('user', userSchema);
const Blog = mongoose.model('blog', blogSchema);
const Subscriber = mongoose.model('subscriber', subscriberSchema);

/** Display names for the given usernames (users without a name are left out). */
async function namesOf(usernames) {
  const users = await User.find({ username: { $in: [...new Set(usernames)] }, name: { $nin: ['', null] } }, { username: 1, name: 1 }).lean();
  return new Map(users.map((u) => [u.username, u.name]));
}

module.exports = { User, Blog, Subscriber, serializeBlog, namesOf, liveFilter, statusOf };
