// The Material Symbols font in src/index.html is subset to the icons we use (icon_names=…), which cuts it
// from ~1.2 MB to ~25 KB. This check fails the build if a template uses an icon missing from that list.
// Runs automatically before "npm run build".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|html)$/.test(f)) files.push(p);
  }
})(path.join(src, 'app'));

const used = new Set();
for (const file of files) {
  const s = fs.readFileSync(file, 'utf8');
  for (const m of s.matchAll(/class="ms[^"]*">([a-z0-9_]+)</g)) used.add(m[1]); // <span class="ms">home</span>
  for (const m of s.matchAll(/class="ms[^"]*">\{\{([^}]*)\}\}</g)) {             // {{ cond ? 'a' : 'b' }}
    for (const q of m[1].matchAll(/[?:]\s*'([a-z0-9_]+)'/g)) used.add(q[1]);
  }
  for (const m of s.matchAll(/icon: '([a-z0-9_]+)'/g)) used.add(m[1]);             // { icon: 'bolt', … }
}

const index = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
const listed = new Set((index.match(/icon_names=([a-z0-9_,]+)/)?.[1] ?? '').split(',').filter(Boolean));
const missing = [...used].filter((n) => !listed.has(n)).sort();

if (missing.length) {
  console.error(`Icons used but missing from icon_names in src/index.html: ${missing.join(', ')}`);
  console.error(`Use this list (alphabetical, as Google Fonts requires):\n${[...new Set([...listed, ...used])].sort().join(',')}`);
  process.exit(1);
}
console.log(`Icon font check: ${used.size} icons used, all present in the font request.`);
