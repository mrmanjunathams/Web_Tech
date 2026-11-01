const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: process.env.SMTP_SERVICE || 'gmail',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Sends the welcome email. Never throws: email failure must not break sign-up. */
async function sendWelcomeEmail(user) {
  const t = getTransporter();
  if (!t) return false;
  try {
    const info = await t.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: user.email,
      subject: 'Welcome to Bloggerbytes',
      text: `Hi ${user.name || user.username}, welcome to Bloggerbytes. We are happy to see you here.`,
      html:
        '<div style="background:#99ebff;padding:24px;font-family:sans-serif">' +
        '<div style="max-width:560px;margin:auto;background:#fff;padding:24px;text-align:center">' +
        '<img src="https://image.ibb.co/n53MH0/logoalt.png" alt="Bloggerbytes" width="50%">' +
        '<h2>Publish your passions, your way</h2>' +
        '<p>Create a unique and beautiful blog. It\'s easy and free.</p>' +
        `<h3>Welcome to Bloggerbytes, ${escapeHtml(user.name || user.username)}.<br>We are happy to see you here.</h3>` +
        '</div></div>',
    });
    console.log('Welcome email sent:', info.response);
    return true;
  } catch (err) {
    console.error('Welcome email failed:', err.message);
    return false;
  }
}

module.exports = { sendWelcomeEmail };
