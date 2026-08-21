#!/usr/bin/env node
/**
 * Create store categories in Tifawt ERP and print the Bot Control mapping.
 *
 * Usage:
 *   node scripts/setup-tifawt-categories.mjs
 *   node scripts/setup-tifawt-categories.mjs --dry-run
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  PICKER_CATEGORY_IDS,
  STORE_CATEGORY_BY_ID,
  STORE_CATEGORY_LABEL_AR,
  TIFAWT_CATEGORY_NAME_FR,
} from '../bot/storeCategories.js';
import {
  createTifawtProductCategory,
  listTifawtProductCategories,
  tifawtCategoryMapToText,
} from '../bot/tifawtCategories.js';
import { isTifawtApiConfigured } from '../bot/tifawtClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', 'bot', '.env'), override: true });

const dryRun = process.argv.includes('--dry-run');

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

async function main() {
  if (!dryRun && !isTifawtApiConfigured()) {
    console.error('Missing TIFAWT_EMAIL / TIFAWT_PASSWORD');
    process.exit(1);
  }

  const map = new Map();
  const rows = [];

  if (dryRun) {
    for (const storeId of PICKER_CATEGORY_IDS) {
      rows.push({
        storeId,
        frName: TIFAWT_CATEGORY_NAME_FR[storeId],
        enName: STORE_CATEGORY_BY_ID[storeId],
        arName: STORE_CATEGORY_LABEL_AR[storeId],
        tifawtId: '(create in Tifawt UI)',
      });
    }
  } else {
    const existing = await listTifawtProductCategories();
    const byName = new Map(existing.map((cat) => [normalizeName(cat.name), cat]));

    for (const storeId of PICKER_CATEGORY_IDS) {
      const frName = TIFAWT_CATEGORY_NAME_FR[storeId];
      const enName = STORE_CATEGORY_BY_ID[storeId];
      const arName = STORE_CATEGORY_LABEL_AR[storeId];
      if (!frName) continue;

      let tifawtCat = byName.get(normalizeName(frName));
      if (!tifawtCat) {
        tifawtCat = await createTifawtProductCategory(frName);
        byName.set(normalizeName(frName), tifawtCat);
        console.log(`Created Tifawt category #${tifawtCat.id}: ${frName}`);
      } else {
        console.log(`Exists Tifawt category #${tifawtCat.id}: ${frName}`);
      }
      map.set(storeId, tifawtCat.id);
      rows.push({ storeId, frName, enName, arName, tifawtId: tifawtCat.id });
    }
  }

  console.log('\n=== Store categories for Tifawt ===\n');
  console.log('Store_ID | Arabic | English | Tifawt name (FR) | Tifawt ID');
  console.log('---------|--------|---------|------------------|----------');
  for (const row of rows) {
    console.log(
      `${String(row.storeId).padEnd(8)} | ${row.arName} | ${row.enName} | ${row.frName} | ${row.tifawtId}`,
    );
  }

  if (!dryRun && map.size) {
    console.log('\n=== Paste into Bot Control → tifawtCategoryMap ===\n');
    console.log(tifawtCategoryMapToText(map));
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
