/**
 * Convert Template-2 category cards to transparent PNGs (white/light bg → alpha).
 * Backs up originals to public/category-images/_solid/
 *
 * node scripts/make-category-images-transparent.cjs
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DIR = path.join(__dirname, '..', 'public', 'category-images');
const BACKUP = path.join(DIR, '_solid');

async function toTransparent(inputPath, outputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  // Soft key: near-white / very light cool gray → transparent
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const brightness = (r + g + b) / 3;
    const sat = max === 0 ? 0 : (max - min) / max;

    // Light background (studio white / pale blue-gray)
    if (brightness > 232 && sat < 0.12) {
      data[i + 3] = 0;
      continue;
    }
    // Soft edge fade for near-white
    if (brightness > 210 && sat < 0.18) {
      const t = (brightness - 210) / (255 - 210);
      data[i + 3] = Math.max(0, Math.min(255, Math.round(255 * (1 - t * 1.35))));
    }
  }

  await sharp(data, { raw: { width, height, channels } })
    .png()
    .toFile(outputPath);
}

async function main() {
  fs.mkdirSync(BACKUP, { recursive: true });
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.png') && !f.startsWith('_'));
  console.log(`Converting ${files.length} images...`);

  for (const file of files) {
    const src = path.join(DIR, file);
    const bak = path.join(BACKUP, file);
    if (!fs.existsSync(bak)) {
      fs.copyFileSync(src, bak);
    }
    const tmp = path.join(DIR, `._tmp_${file}`);
    await toTransparent(bak, tmp);
    fs.renameSync(tmp, src);
    const meta = await sharp(src).metadata();
    console.log(`OK ${file} alpha=${meta.hasAlpha} ${meta.width}x${meta.height}`);
  }
  console.log('Done. Solid backups in public/category-images/_solid/');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
