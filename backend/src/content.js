// Story body handling: the rich-text editors (web and mobile) send HTML, which is sanitized here against a
// strict allowlist before it is stored. Older stories are plain text and are turned into paragraphs.
const sanitizeHtml = require('sanitize-html');

const SANITIZE = {
  allowedTags: ['p', 'br', 'h2', 'h3', 'strong', 'em', 'u', 's', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'hr'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  transformTags: {
    h1: 'h2',
    h4: 'h3',
    h5: 'h3',
    h6: 'h3',
    b: 'strong',
    i: 'em',
    strike: 's',
    del: 's',
    div: 'p',
    a: (tagName, attribs) => ({
      tagName,
      attribs: { href: attribs.href || '', target: '_blank', rel: 'noopener noreferrer nofollow' },
    }),
  },
  exclusiveFilter: (frame) => frame.tag === 'a' && !frame.attribs.href,
};

const HTML_TAG = /<\/?(p|br|h[1-6]|strong|em|b|i|u|s|code|pre|blockquote|ul|ol|li|a|hr|div|span)\b[^>]*>/i;

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Plain text -> paragraphs (blank lines split paragraphs, single newlines become <br>). */
function textToHtml(text) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Body as safe HTML, whether it was stored as HTML (from the editors) or plain text (older stories). */
function toHtml(body) {
  const s = typeof body === 'string' ? body : '';
  return HTML_TAG.test(s) ? sanitizeHtml(s, SANITIZE) : textToHtml(s);
}

/** Visible text of a body, for "is it empty?" checks and word counts. */
function plainText(html) {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim();
}

module.exports = { toHtml, plainText };
