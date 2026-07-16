const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Minimal ICO writer (PNG-compressed entries) — avoids electron-builder WASM OOM.
async function main() {
  const src = path.join(__dirname, '..', 'public', 'app-icon-512.png');
  const outDir = path.join(__dirname, '..', 'build');
  const outIco = path.join(outDir, 'icon.ico');
  fs.mkdirSync(outDir, { recursive: true });

  const sizes = [16, 32, 48, 64, 128, 256];
  const pngs = [];
  for (const size of sizes) {
    const buf = await sharp(src)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toBuffer();
    pngs.push({ size, buf });
  }

  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = headerSize + dirEntrySize * pngs.length;
  let offset = dirSize;
  const entries = pngs.map(({ size, buf }) => {
    const entry = {
      width: size >= 256 ? 0 : size,
      height: size >= 256 ? 0 : size,
      bytes: buf.length,
      offset,
    };
    offset += buf.length;
    return entry;
  });

  const out = Buffer.alloc(offset);
  out.writeUInt16LE(0, 0); // reserved
  out.writeUInt16LE(1, 2); // type = icon
  out.writeUInt16LE(pngs.length, 4);

  entries.forEach((e, i) => {
    const o = headerSize + i * dirEntrySize;
    out.writeUInt8(e.width, o);
    out.writeUInt8(e.height, o + 1);
    out.writeUInt8(0, o + 2); // color palette
    out.writeUInt8(0, o + 3);
    out.writeUInt16LE(1, o + 4); // planes
    out.writeUInt16LE(32, o + 6); // bit count
    out.writeUInt32LE(e.bytes, o + 8);
    out.writeUInt32LE(e.offset, o + 12);
  });

  let cursor = dirSize;
  for (const { buf } of pngs) {
    buf.copy(out, cursor);
    cursor += buf.length;
  }

  fs.writeFileSync(outIco, out);
  console.log('Wrote', outIco, `(${out.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
