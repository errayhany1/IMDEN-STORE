const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const distDesktop = path.join(root, 'dist-desktop');
const outDir = path.join(root, 'public', 'downloads');

if (!fs.existsSync(distDesktop)) {
  console.error('dist-desktop/ not found. Run: npm run desktop:build');
  process.exit(1);
}

const files = fs.readdirSync(distDesktop).filter((f) => f.endsWith('.exe'));
if (!files.length) {
  console.error('No .exe found in dist-desktop/');
  process.exit(1);
}

// Prefer NSIS installer, then portable
const preferred =
  files.find((f) => /setup/i.test(f)) ||
  files.find((f) => /portable/i.test(f)) ||
  files[0];

fs.mkdirSync(outDir, { recursive: true });
const target = path.join(outDir, 'Errayhany-Store-Setup.exe');
fs.copyFileSync(path.join(distDesktop, preferred), target);
console.log(`Copied ${preferred} -> public/downloads/Errayhany-Store-Setup.exe`);
