// Builds web-sized copies of the Image Pool photos (the originals are multi-megabyte camera files):
//   public/picyourpic/opt/<name>-800.webp   cards, gallery, editor picker
//   public/picyourpic/opt/<name>-1800.webp  story covers, lightbox
// and refreshes public/picyourpic/manifest.json. Originals are never modified.
// Run after adding pictures: npm run images
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'picyourpic');
const outDir = path.join(dir, 'opt');
const SIZES = [800, 1800];
fs.mkdirSync(outDir, { recursive: true });

const names = fs.readdirSync(dir)
  .filter((f) => f.toLowerCase().endsWith('.jpg'))
  .map((f) => f.slice(0, -4))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

let before = 0;
let after = 0;
for (const name of names) {
  const src = path.join(dir, `${name}.jpg`);
  before += fs.statSync(src).size;
  for (const width of SIZES) {
    const out = path.join(outDir, `${name}-${width}.webp`);
    if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(src).mtimeMs) {
      await sharp(src).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: width > 1000 ? 78 : 72 }).toFile(out);
    }
    if (width === 800) after += fs.statSync(out).size;
  }
}
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(names, null, 2) + '\n');
const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
console.log(`${names.length} pictures: originals ${mb(before)} -> 800px set ${mb(after)}`);
