// Settings read from the environment when the modules load (each test file runs in its own process).
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.IMAGE_DIR = path.join(__dirname, '..', '..', 'frontend', 'public', 'picyourpic');
process.env.FRONTEND_DIST = path.join(__dirname, 'no-such-build');
process.env.PORT = '0';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/unused';
process.env.MONGO_PORT = '27999';
process.env.MONGO_DB_PATH = path.join(__dirname, 'no-such-db');
process.env.MAIL_FROM = 'Bloggerbytes <hello@example.com>';
process.env.SMTP_SERVICE = 'example';

test('environment settings are picked up', async () => {
  const request = require('supertest');
  const { createApp, GALLERY_IMAGES } = require('../src/app');
  assert.ok(GALLERY_IMAGES.has('img5'));
  // FRONTEND_DIST points at a missing build, so the API-only message is served.
  const res = await request(createApp({ sessionSecret: 'x', rateLimit: false })).get('/');
  assert.match(res.text, /API is running/);

  const nodemailer = require('nodemailer');
  const { sendWelcomeEmail } = require('../src/mailer');
  process.env.SMTP_USER = 'bot@example.com';
  process.env.SMTP_PASS = 'pw';
  let options;
  let mail;
  nodemailer.createTransport = (o) => ((options = o), { sendMail: async (m) => ((mail = m), { response: 'ok' }) });
  const log = console.log;
  console.log = () => {};
  assert.equal(await sendWelcomeEmail({ username: 'amy', email: 'a@example.com' }), true);
  console.log = log;
  assert.equal(options.service, 'example');
  assert.equal(mail.from, 'Bloggerbytes <hello@example.com>');

  // Modules that read settings at load time.
  assert.equal(typeof require('../src/index').start, 'function');
  assert.equal(typeof require('../src/local-db').startLocalDb, 'function');
});
