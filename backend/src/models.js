const crypto = require('node:crypto');
const { promisify } = require('node:util');
const mongoose = require('mongoose');

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

/* Users ------------------------------------------------------------------ */
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
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
  return { username: this.username, email: this.email, createdAt: this.createdAt };
};

/* Blogs ------------------------------------------------------------------ */
const blogSchema = new mongoose.Schema(
  {
    auth: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    cate: { type: String, required: true, trim: true, maxlength: 100 },
    date: { type: String, required: true, trim: true, maxlength: 40 },
    img: { type: String, required: true, trim: true },
    blogp1: { type: String, required: true, maxlength: 20000 },
    blogp2: { type: String, required: true, maxlength: 20000 },
  },
  { timestamps: true }
);

/* Newsletter subscribers -------------------------------------------------- */
const subscriberSchema = new mongoose.Schema(
  { email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254 } },
  { timestamps: true }
);

// Collection names match the original app ("users" / "blogs").
const User = mongoose.models.user || mongoose.model('user', userSchema);
const Blog = mongoose.models.blog || mongoose.model('blog', blogSchema);
const Subscriber = mongoose.models.subscriber || mongoose.model('subscriber', subscriberSchema);

module.exports = { User, Blog, Subscriber };
