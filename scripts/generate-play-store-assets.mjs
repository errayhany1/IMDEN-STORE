import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

await mkdir('play-store', { recursive: true });

const logoPath = 'public/app-icon-512.png';
const navy = { r: 20, g: 32, b: 56, alpha: 1 };

await sharp(logoPath).resize(512, 512).png().toFile('play-store/icon-512.png');

const mark = await sharp(logoPath)
  .resize(260, 260, {
    fit: 'contain',
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  })
  .png()
  .toBuffer();

const textSvg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="560" height="500" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="210" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="700" fill="#FFFFFF">Errayhany Store</text>
  <text x="0" y="268" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#93C5FD">إلكترونيات بالجملة في المغرب</text>
  <text x="0" y="318" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#CBD5E1">Wholesale electronics for retailers</text>
</svg>`);

await sharp({
  create: {
    width: 1024,
    height: 500,
    channels: 4,
    background: navy,
  },
})
  .composite([
    {
      input: await sharp({
        create: {
          width: 400,
          height: 500,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      }).png().toBuffer(),
      left: 0,
      top: 0,
    },
    { input: mark, left: 70, top: 120 },
    { input: textSvg, left: 450, top: 0 },
  ])
  .png()
  .toFile('play-store/feature-graphic-1024x500.png');

console.log('Created play-store/icon-512.png and play-store/feature-graphic-1024x500.png');
