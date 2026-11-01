const { test } = require('node:test');
const assert = require('node:assert/strict');
const { toHtml, plainText } = require('../src/content');
const { serializeBlog, statusOf } = require('../src/models');

test('toHtml keeps allowed formatting and normalizes the rest', () => {
  assert.equal(
    toHtml('<h3>Sub</h3><ul><li><b>b</b> <i>i</i> <u>u</u> <strike>s</strike> <del>d</del></li></ul><ol><li>1</li></ol><blockquote>q</blockquote><pre><code>x</code></pre><hr><p>a<br>b</p>'),
    '<h3>Sub</h3><ul><li><strong>b</strong> <em>i</em> <u>u</u> <s>s</s> <s>d</s></li></ul><ol><li>1</li></ol><blockquote>q</blockquote><pre><code>x</code></pre><hr /><p>a<br />b</p>'
  );
  assert.equal(toHtml('<h4>a</h4><h5>b</h5><h6>c</h6><div>d</div><span style="color:red">e</span>'), '<h3>a</h3><h3>b</h3><h3>c</h3><p>d</p>e');
  assert.equal(toHtml('<p><a>no link</a> <a href="mailto:x@y.z">mail</a> <a href="//evil.example">proto-relative</a></p>'),
    // Links without a safe absolute URL are dropped entirely.
    '<p> <a href="mailto:x@y.z" target="_blank" rel="noopener noreferrer nofollow">mail</a> </p>');
});

test('toHtml turns plain text into paragraphs and ignores non-strings', () => {
  assert.equal(toHtml('One\ntwo\n\n\n  Three & <four>  '), '<p>One<br>two</p><p>Three &amp; &lt;four&gt;</p>');
  assert.equal(toHtml('"quotes" and \'apostrophes\''), '<p>&quot;quotes&quot; and &#39;apostrophes&#39;</p>');
  assert.equal(toHtml(''), '');
  assert.equal(toHtml(undefined), '');
  assert.equal(toHtml({ $gt: '' }), '');
});

test('plainText strips tags and collapses whitespace', () => {
  assert.equal(plainText('<h2>Title</h2>\n<p>Some   <b>bold</b></p>'), 'Title Some bold');
  assert.equal(plainText('<p> </p><br>'), '');
});

test('statusOf and serializeBlog', () => {
  const now = new Date('2026-11-01T00:00:00Z');
  assert.equal(statusOf({ status: 'draft' }, now), 'draft');
  assert.equal(statusOf({ status: 'published', publishAt: new Date('2026-12-01') }, now), 'scheduled');
  assert.equal(statusOf({ status: 'published', publishAt: new Date('2026-10-01') }, now), 'published');
  assert.equal(statusOf({ status: 'published', publishAt: null }, now), 'published');
  assert.equal(statusOf({}), 'published'); // older blogs without a status

  const s = serializeBlog({ _id: 'x', __v: 3, auth: 'amy', blogp2: 'plain', likedBy: ['bo'] }, 'bo', new Map([['amy', 'Amy W']]));
  assert.deepEqual(s, {
    _id: 'x', auth: 'amy', blogp2: '<p>plain</p>', authName: 'Amy W', status: 'published', publishAt: null, likes: 1, liked: true, views: 0,
  });
  assert.equal(serializeBlog({ auth: 'amy' }, undefined, new Map()).liked, false);
  assert.equal(serializeBlog({ auth: 'amy' }, undefined, new Map()).authName, 'amy');
});
