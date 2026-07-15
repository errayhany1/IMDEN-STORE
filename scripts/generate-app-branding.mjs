import sharp from 'sharp';
import { mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const assetsDir = path.join(root, 'assets');
const publicDir = path.join(root, 'public');
const brandNavy = { r: 20, g: 32, b: 56, alpha: 1 }; // #142038
const white = { r: 255, g: 255, b: 255, alpha: 1 };

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveLogo() {
  const candidates = [
    path.join(publicDir, 'logo-512.png'),
    path.join(publicDir, 'app-icon-512.png'),
    path.join(publicDir, 'logo.png'),
  ];
  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  throw new Error('No brand logo found in public/');
}

/** Turn a dark-on-light logo into a white glyph with transparent background. */
async function toWhiteGlyph(logoPath, size) {
  const { data, info } = await sharp(logoPath)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (luminance < 210) {
      const alpha = Math.min(255, Math.round(((210 - luminance) / 210) * 255));
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = alpha;
    } else {
      data[i + 3] = 0;
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function composeSquare(background, glyph, size, padRatio) {
  const inner = Math.round(size * (1 - padRatio * 2));
  const resized = await sharp(glyph)
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: resized, gravity: 'centre' }])
    .png()
    .toBuffer();
}

await mkdir(assetsDir, { recursive: true });
const logoPath = await resolveLogo();

// Keep original dark logo for light surfaces (Play icon / favicon).
const darkIcon1024 = await composeSquare(white, await sharp(logoPath).png().toBuffer(), 1024, 0.16);
const darkIcon512 = await composeSquare(white, await sharp(logoPath).png().toBuffer(), 512, 0.14);
const darkIcon192 = await composeSquare(white, await sharp(logoPath).png().toBuffer(), 192, 0.14);
const darkFavicon = await composeSquare(white, await sharp(logoPath).png().toBuffer(), 64, 0.1);

// White glyph on navy for splash and dark adaptive variants.
const whiteGlyph = await toWhiteGlyph(logoPath, 1024);
const splashLogo = await sharp(whiteGlyph)
  .resize(760, 760, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
const splash = await sharp({
  create: {
    width: 2732,
    height: 2732,
    channels: 4,
    background: brandNavy,
  },
})
  .composite([{ input: splashLogo, gravity: 'centre' }])
  .png()
  .toBuffer();

const darkAdaptiveIcon = await composeSquare(brandNavy, whiteGlyph, 1024, 0.22);

await Promise.all([
  sharp(darkIcon1024).toFile(path.join(assetsDir, 'icon.png')),
  sharp(darkAdaptiveIcon).toFile(path.join(assetsDir, 'icon-foreground.png')),
  sharp(splash).toFile(path.join(assetsDir, 'splash.png')),
  sharp(splash).toFile(path.join(assetsDir, 'splash-dark.png')),
  sharp(darkIcon512).toFile(path.join(publicDir, 'app-icon-512.png')),
  sharp(darkIcon192).toFile(path.join(publicDir, 'app-icon-192.png')),
  sharp(darkFavicon).toFile(path.join(publicDir, 'favicon-64.png')),
]);

console.log(`Branding assets generated from ${path.basename(logoPath)}`);
