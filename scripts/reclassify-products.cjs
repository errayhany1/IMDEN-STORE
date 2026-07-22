/**
 * Reclassify NocoDB products into the expanded taxonomy.
 * Dry-run by default; pass --apply to PATCH Category_ID.
 *
 * Usage:
 *   node scripts/reclassify-products.cjs
 *   node scripts/reclassify-products.cjs --apply
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const envPath = path.join(ROOT, '.env');
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')];
    })
);

const BASE = (env.VITE_NOCODB_URL || '').replace(/\/$/, '');
const TABLE = env.VITE_NOCODB_TABLE_PRODUCTS;
const TOKEN = env.VITE_NOCODB_API_TOKEN;
const APPLY = process.argv.includes('--apply');

const CAT = {
  Chargers: 1,
  Audio: 2,
  SmartWatches: 3,
  Gaming: 4,
  MouseKeyboard: 5,
  Storage: 6,
  LaptopChargers: 7,
  Stands: 8,
  Lighting: 9,
  Cameras: 10,
  Network: 11,
  General: 12,
  Microphones: 13,
  Batteries: 14,
  OutOfStock: 15,
  Cables: 16,
  Car: 17,
  Adapters: 18,
  TvBoxes: 19,
  Cooling: 20,
  Phones: 21,
};

const NAME = {
  1: 'Chargers',
  2: 'Audio',
  3: 'Smart Watches',
  4: 'Gaming',
  5: 'Mouse & Keyboard',
  6: 'Storage',
  7: 'Laptop Chargers',
  8: 'Stands',
  9: 'Lighting',
  10: 'Cameras',
  11: 'Network',
  12: 'General',
  13: 'Microphones',
  14: 'Batteries & Power Banks',
  15: 'Out of Stock',
  16: 'Cables',
  17: 'Car Accessories',
  18: 'Adapters & Hubs',
  19: 'TV Boxes',
  20: 'Cooling',
  21: 'Phones',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchAll() {
  const all = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const url = `${BASE}/api/v2/tables/${TABLE}/records?limit=${limit}&offset=${offset}&fields=Id,Title,Arabic_Title,Woo_Title,SKU,Category_ID`;
    let res;
    for (let attempt = 0; attempt < 6; attempt++) {
      res = await fetch(url, { headers: { 'xc-token': TOKEN, accept: 'application/json' } });
      if (res.status !== 429) break;
      const wait = Math.min(30000, 2000 * 2 ** attempt);
      console.warn(`Rate limited, waiting ${wait}ms...`);
      await sleep(wait);
    }
    if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const batch = data.list || [];
    all.push(...batch);
    console.log(`Fetched ${all.length}...`);
    if (batch.length < limit) break;
    offset += limit;
    await sleep(400);
  }
  return all;
}

function textOf(p) {
  return [p.Title, p.Arabic_Title, p.Woo_Title, p.SKU].filter(Boolean).join(' ');
}

/**
 * Ordered rules: first match wins. Conservative — only clear misfiles / new buckets.
 */
function suggestCategoryId(p) {
  const t = textOf(p);
  const current = Number(p.Category_ID) || 12;

  // Keep Out of Stock untouched
  if (current === 15) return null;

  // --- New / clear buckets (high confidence) ---
  if (/tv\s*box|android\s*tv|tv\s*stick|tvr3|fire\s*stick/i.test(t)) return CAT.TvBoxes;

  if (/\bnokia\b|^\s*t[eé]l[eé]phone\s*$/i.test(t) && !/support|حامل|stand|selfie/i.test(t)) {
    return CAT.Phones;
  }

  if (/cooling\s*(pad|pod)|baf\s*pc|notebook\s*cooling|phone\s*cooler|tablet\s*cooler|ventilateur|مروحة|cooler\s*dla|cooler\s*dl0/i.test(t)) {
    return CAT.Cooling;
  }

  if (/\bspeaker\b|سبيكر|enceinte|مكبر صوت/i.test(t)) return CAT.Audio;

  if (/cl[eé]\s*usb|usb\s*flash|kingston\s*\d+\s*gb|ميموار|carte\s*m[eé]moire|\bsd\s*card\b|pendrive/i.test(t)) {
    return CAT.Storage;
  }

  // Car accessories (before generic charger / stand rules)
  if (/car\s*charger|chargeur\s*voiture|شاحن\s*سيار|allume\s*cigare|mp3\s*car|car\s*fm|fm\s*player|wireless\s*carplay|carplay|support\s*moto|حامل\s*سيار/i.test(t)
    || (/\bcar\b|voiture|سيارة/i.test(t) && /(charger|chargeur|fm|mp3|player|mount|support|holder)/i.test(t))) {
    return CAT.Car;
  }

  // Adapters & Hubs (before cables — "câble display to hdmi" is adapter-ish; prefer Adapters for convert/hub)
  if (/\bhub\b|\botg\b|docking|dock\s*station|rj45\s*to\s*usb|type[-\s]?c\s*to\s*rj45|typec\s*to\s*hdtv|to\s*hdmi|to\s*vga|display\s*to|usb\s*3\.0\s*to\s*vga|usb\s*-\s*rs232|lightning\s*to\s*sd|card\s*reader|adaptateur|adapter(?!\s*wifi)|محول|convertisseur|multifunction\s*adapter/i.test(t)) {
    return CAT.Adapters;
  }

  // Cables (explicit cable products; not "cable" inside unrelated names if too vague — require cable/كابل)
  if (/\bcable\b|\bcâble\b|كابل|سلك\s*(شحن|usb)|cable\s*flair|cable\s*watch|cable\s*radio|cable\s*imprimante|cable\s*pc|cable\s*boost|aux\b.*adapt/i.test(t)
    || (/imprimante/i.test(t) && /cable|câble/i.test(t))) {
    return CAT.Cables;
  }

  // Adaptateur aux alone → adapters (already covered) or cables — leave adapters

  // No change suggested
  return null;
}

async function patchCategory(id, categoryId) {
  const url = `${BASE}/api/v2/tables/${TABLE}/records`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'xc-token': TOKEN,
        accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ Id: id, Category_ID: categoryId }),
    });
    if (res.status === 429) {
      const wait = Math.min(30000, 2000 * 2 ** attempt);
      console.warn(`PATCH rate limited, waiting ${wait}ms...`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`PATCH #${id} failed ${res.status}: ${await res.text()}`);
    return;
  }
  throw new Error(`PATCH #${id} failed after retries`);
}

async function main() {
  if (!BASE || !TABLE || !TOKEN) throw new Error('Missing NocoDB env vars');
  console.log(APPLY ? 'MODE: APPLY (will update NocoDB)' : 'MODE: dry-run (pass --apply to write)');

  const products = await fetchAll();
  const changes = [];

  for (const p of products) {
    const next = suggestCategoryId(p);
    if (next == null) continue;
    const current = Number(p.Category_ID) || 12;
    if (next === current) continue;
    changes.push({
      id: p.Id,
      name: p.Arabic_Title || p.Title || p.Woo_Title || p.SKU,
      from: current,
      fromName: NAME[current] || '?',
      to: next,
      toName: NAME[next],
    });
  }

  console.log(`\nProposed changes: ${changes.length}`);
  const byPair = {};
  for (const c of changes) {
    const k = `${c.fromName} → ${c.toName}`;
    byPair[k] = (byPair[k] || 0) + 1;
  }
  Object.entries(byPair)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}  ${k}`));

  fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, 'tmp/reclassify-plan.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), apply: APPLY, changes }, null, 2)
  );
  console.log('Wrote tmp/reclassify-plan.json');

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to update NocoDB.');
    return;
  }

  let ok = 0;
  for (const c of changes) {
    await patchCategory(c.id, c.to);
    ok += 1;
    if (ok % 10 === 0) console.log(`Updated ${ok}/${changes.length}...`);
    await sleep(350);
  }
  console.log(`Done. Updated ${ok} products.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
