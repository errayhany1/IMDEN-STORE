/**
 * Restore solid (non-transparent) category images from _solid backup.
 * node scripts/restore-category-images-solid.cjs
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'public', 'category-images');
const BACKUP = path.join(DIR, '_solid');

if (!fs.existsSync(BACKUP)) {
  console.error('No backup at', BACKUP);
  process.exit(1);
}

const files = fs.readdirSync(BACKUP).filter((f) => f.endsWith('.png'));
for (const file of files) {
  fs.copyFileSync(path.join(BACKUP, file), path.join(DIR, file));
  console.log('restored', file);
}
console.log(`Restored ${files.length} solid images.`);
