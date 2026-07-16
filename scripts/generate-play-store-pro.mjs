import sharp from 'sharp';
import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('C:/Users/pc/Documents/WholesaleCatalog');
const assetsSrc = path.resolve(
  'C:/Users/pc/.cursor/projects/c-Users-pc-Documents-WholesaleCatalog/assets',
);
const outDir = path.join(root, 'play-store');
await mkdir(outDir, { recursive: true });

const files = {
  iconNavy:
    'c__Users_pc_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_icon-512-52dafcc4-0ecc-4c95-8723-85f589e43da8.png',
  markWhite:
    'c__Users_pc_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_ChatGPT_Image_15_______2026__07_50_52__-ae24e0a3-aaa7-46c2-a3bc-05ce9b001154.png',
  wordmark:
    'c__Users_pc_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_20260625_223936-dda9b5a6-cb18-4dba-aeee-63a4069e9c89.png',
  shots: [
    'c__Users_pc_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_IMG_0342-4cb02f51-77f0-47c1-8772-7b5646d27491.png',
    'c__Users_pc_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_IMG_0343-758e2f22-e440-45ca-b3ae-51182e446e55.png',
    'c__Users_pc_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_IMG_0344-12ae8986-d49b-42be-bbc6-b761f82939cc.png',
    'c__Users_pc_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_IMG_0345-7859362f-a160-4d01-80d5-9609ee36daaa.png',
  ],
};

const navy = { r: 20, g: 32, b: 56, alpha: 1 };
const captions = [
  { ar: 'تصفح كتالوج الجملة بسهولة', en: 'Browse wholesale catalog' },
  { ar: 'تفاصيل المنتج والصور', en: 'Product details and gallery' },
  { ar: 'سلة بالجملة مع كميات سريعة', en: 'Bulk cart with quick qty' },
  { ar: 'اتمام الطلب في ثوان', en: 'Checkout in seconds' },
];

const iconPath = path.join(assetsSrc, files.iconNavy);
const markPath = path.join(assetsSrc, files.markWhite);
const wordmarkPath = path.join(assetsSrc, files.wordmark);

// 1) App icon 512×512
await sharp(iconPath).resize(512, 512, { fit: 'cover' }).png().toFile(path.join(outDir, 'icon-512.png'));
await copyFile(path.join(outDir, 'icon-512.png'), path.join(root, 'public', 'app-icon-512.png'));

// 2) Feature graphic 1024×500
const leftPanel = await sharp({
  create: { width: 420, height: 500, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
}).png().toBuffer();

const markOnWhite = await sharp(markPath)
  .resize(300, 300, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .png()
  .toBuffer();

const wordmarkFit = await sharp(wordmarkPath)
  .resize(520, 160, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

// Flatten wordmark onto navy (transparent → navy)
const wordmarkOnNavy = await sharp({
  create: { width: 520, height: 160, channels: 4, background: navy },
})
  .composite([{ input: wordmarkFit, gravity: 'centre' }])
  .png()
  .toBuffer();

const featureText = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="520" height="180" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="40" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="700" fill="#93C5FD">Errayhany Store</text>
  <text x="0" y="88" font-family="Segoe UI, Arial, sans-serif" font-size="26" fill="#FFFFFF">كتالوج الإلكترونيات بالجملة</text>
  <text x="0" y="132" font-family="Segoe UI, Arial, sans-serif" font-size="20" fill="#CBD5E1">Wholesale electronics for retailers</text>
</svg>`);

await sharp({
  create: { width: 1024, height: 500, channels: 4, background: navy },
})
  .composite([
    { input: leftPanel, left: 0, top: 0 },
    { input: markOnWhite, left: 60, top: 100 },
    { input: wordmarkOnNavy, left: 460, top: 90 },
    { input: featureText, left: 460, top: 270 },
  ])
  .png()
  .toFile(path.join(outDir, 'feature-graphic-1024x500.png'));

// 3) Phone screenshots 1080×1920 with branded frame
async function framedShot(srcPath, caption, index) {
  const W = 1080;
  const H = 1920;
  const phoneW = 860;
  const phoneH = 1520;
  const phoneLeft = Math.round((W - phoneW) / 2);
  const phoneTop = 280;

  const shot = await sharp(srcPath)
    .resize(phoneW - 24, phoneH - 24, { fit: 'cover', position: 'top' })
    .png()
    .toBuffer();

  const frame = await sharp({
    create: {
      width: phoneW,
      height: phoneH,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: shot, left: 12, top: 12 }])
    .png()
    .toBuffer();

  const header = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="240" xmlns="http://www.w3.org/2000/svg">
  <text x="${W / 2}" y="95" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="46" font-weight="700" fill="#FFFFFF">${caption.ar}</text>
  <text x="${W / 2}" y="150" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="26" fill="#93C5FD">${caption.en}</text>
</svg>`);

  const badge = await sharp(iconPath)
    .resize(72, 72)
    .png()
    .toBuffer();

  await sharp({
    create: { width: W, height: H, channels: 4, background: navy },
  })
    .composite([
      { input: header, left: 0, top: 40 },
      { input: badge, left: 40, top: 48 },
      {
        input: Buffer.from(`<?xml version="1.0"?><svg width="${phoneW + 16}" height="${phoneH + 16}" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="${phoneW + 16}" height="${phoneH + 16}" rx="48" fill="#0B1220"/>
        </svg>`),
        left: phoneLeft - 8,
        top: phoneTop - 8,
      },
      { input: frame, left: phoneLeft, top: phoneTop },
    ])
    .jpeg({ quality: 90 })
    .toFile(path.join(outDir, `phone-${index + 1}.jpg`));
}

for (let i = 0; i < files.shots.length; i++) {
  await framedShot(path.join(assetsSrc, files.shots[i]), captions[i], i);
}

// 4) Tablet variants from same shots (7" portrait + 10" landscape)
for (let i = 0; i < 2; i++) {
  const src = path.join(assetsSrc, files.shots[i]);
  await sharp(src)
    .resize(1200, 1920, { fit: 'cover', position: 'top' })
    .jpeg({ quality: 90 })
    .toFile(path.join(outDir, `tablet7-${i + 1}.jpg`));
  await sharp(src)
    .resize(1920, 1200, { fit: 'contain', background: navy })
    .jpeg({ quality: 90 })
    .toFile(path.join(outDir, `tablet10-${i + 1}.jpg`));
}

console.log('Play Store pro assets ready in play-store/');
