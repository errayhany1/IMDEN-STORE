import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

async function frame(srcRel, outRel, w, h, label) {
  const src = path.join(root, srcRel);
  const out = path.join(root, outRel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const logo = await sharp(path.join(root, 'public/app-icon-512.png')).resize(96, 96).toBuffer();
  const shot = await sharp(src).resize(w - 80, h - 200, { fit: 'cover' }).toBuffer();
  const svg = Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0f1a2e"/><stop offset="1" stop-color="#1e3a5f"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="70" text-anchor="middle" fill="white" font-size="36" font-family="Arial" font-weight="700">${label}</text>
  </svg>`);
  await sharp(svg)
    .composite([
      { input: logo, top: 20, left: Math.round((w - 96) / 2) },
      { input: shot, top: 110, left: 40 },
    ])
    .jpeg({ quality: 88 })
    .toFile(out);
  console.log('wrote', outRel);
}

async function main() {
  await frame('play-store/phone-01-catalog.png', 'app-store/screenshots/iphone-01-catalog.jpg', 1290, 2796, 'Errayhany Store');
  await frame('play-store/phone-02-product.png', 'app-store/screenshots/iphone-02-product.jpg', 1290, 2796, 'كتالوج الجملة');
  await frame('play-store/phone-03-cart.png', 'app-store/screenshots/iphone-03-cart.jpg', 1290, 2796, 'سلة الطلبات');
  await frame('play-store/tablet10-01.png', 'app-store/screenshots/ipad-01-catalog.jpg', 2048, 2732, 'Errayhany Store');
  await frame('play-store/tablet10-02.png', 'app-store/screenshots/ipad-02-product.jpg', 2048, 2732, 'للتجار في المغرب');

  fs.mkdirSync(path.join(root, 'public/pwa-screenshots'), { recursive: true });
  await sharp(path.join(root, 'play-store/phone-01-catalog.png')).resize(1080, 1920, { fit: 'cover' }).jpeg({ quality: 85 }).toFile(path.join(root, 'public/pwa-screenshots/narrow-1.jpg'));
  await sharp(path.join(root, 'play-store/phone-03-cart.png')).resize(1080, 1920, { fit: 'cover' }).jpeg({ quality: 85 }).toFile(path.join(root, 'public/pwa-screenshots/narrow-2.jpg'));
  await sharp(path.join(root, 'play-store/tablet10-01.png')).resize(1920, 1080, { fit: 'cover' }).jpeg({ quality: 85 }).toFile(path.join(root, 'public/pwa-screenshots/wide-1.jpg'));
  await sharp(path.join(root, 'play-store/tablet10-02.png')).resize(1920, 1080, { fit: 'cover' }).jpeg({ quality: 85 }).toFile(path.join(root, 'public/pwa-screenshots/wide-2.jpg'));

  await sharp(path.join(root, 'play-store/tablet7-01.png')).resize(1200, 1920, { fit: 'cover' }).jpeg({ quality: 88 }).toFile(path.join(root, 'play-store/upload-tablet7-1.jpg'));
  await sharp(path.join(root, 'play-store/tablet7-02.png')).resize(1200, 1920, { fit: 'cover' }).jpeg({ quality: 88 }).toFile(path.join(root, 'play-store/upload-tablet7-2.jpg'));
  console.log('all screenshots ready');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
