#!/usr/bin/env node
/**
 * Sync NocoDB Category_ID → Tifawt product categoryId for all categorized products.
 *
 * Usage:
 *   node scripts/sync-tifawt-product-categories.mjs
 *   node scripts/sync-tifawt-product-categories.mjs --dry-run
 *   node scripts/sync-tifawt-product-categories.mjs --save-map
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchAllNocoRecords, fetchAllTifawtProducts, normSku } from '../bot/inventoryReconcile.js';
import {
  buildStoreToTifawtCategoryMap,
  listTifawtProductCategories,
  syncTifawtCategoryForProduct,
  tifawtCategoryMapToText,
} from '../bot/tifawtCategories.js';
import { getStoreCategoryName } from '../bot/storeCategories.js';
import { parseTifawtSkuAliases, resolveTifawtOrderSku } from '../bot/tifawtSku.js';
import { getBotSetting, updateBotSettings } from '../bot/runtimeSettings.js';
import { isTifawtApiConfigured } from '../bot/tifawtClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', 'bot', '.env'), override: true });

const dryRun = process.argv.includes('--dry-run');
const saveMap = process.argv.includes('--save-map');

function readCategoryId(record) {
  const raw = record?.Category_ID ?? record?.category_id ?? record?.CategoryId;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!isTifawtApiConfigured()) {
    console.error('Missing TIFAWT_EMAIL / TIFAWT_PASSWORD');
    process.exit(1);
  }

  const [tifawtCategories, nocoRecords, tifawtProducts] = await Promise.all([
    listTifawtProductCategories(),
    fetchAllNocoRecords(),
    fetchAllTifawtProducts(),
  ]);

  const categoryMap = buildStoreToTifawtCategoryMap(tifawtCategories);
  console.log(`Tifawt categories: ${tifawtCategories.length}`);
  console.log(`Mapped store categories: ${categoryMap.size}`);
  for (const [storeId, tifawtId] of [...categoryMap.entries()].sort((a, b) => a[0] - b[0])) {
    const tifawtName = tifawtCategories.find((c) => c.id === tifawtId)?.name || '?';
    console.log(`  ${storeId} ${getStoreCategoryName(storeId)} → #${tifawtId} ${tifawtName}`);
  }

  for (let id = 1; id <= 21; id += 1) {
    if (id === 15) continue;
    if (!categoryMap.has(id)) {
      console.warn(`⚠️ No Tifawt match for store category ${id} (${getStoreCategoryName(id)})`);
    }
  }

  if (saveMap && categoryMap.size && !dryRun) {
    const manual = getBotSetting('tifawtCategoryMap') || '';
    if (!manual.trim()) {
      await updateBotSettings({ tifawtCategoryMap: tifawtCategoryMapToText(categoryMap) });
      console.log('\nSaved tifawtCategoryMap to Bot Control settings.');
    }
  }

  const aliases = getBotSetting('tifawtSkuAliases') || '';
  const tifawtBySku = new Map();
  for (const product of tifawtProducts) {
    const key = normSku(product?.sku);
    if (key) tifawtBySku.set(key, product);
  }

  const categorized = nocoRecords.filter((row) => readCategoryId(row));
  console.log(`\nNocoDB products with category: ${categorized.length}`);

  let updated = 0;
  let skippedNoTifawt = 0;
  let skippedNoMapping = 0;
  let skippedSame = 0;
  let failed = 0;

  for (const row of categorized) {
    const storeCategoryId = readCategoryId(row);
    const tifawtCategoryId = categoryMap.get(storeCategoryId);
    if (!tifawtCategoryId) {
      skippedNoMapping += 1;
      continue;
    }

    const siteSku = String(row?.SKU || row?.sku || '').trim();
    if (!siteSku) continue;

    const tifawtSku = resolveTifawtOrderSku(siteSku, aliases);
    const tifawtProduct = tifawtBySku.get(normSku(tifawtSku))
      || tifawtBySku.get(normSku(siteSku));
    if (!tifawtProduct?.id) {
      skippedNoTifawt += 1;
      continue;
    }

    if (Number(tifawtProduct.categoryId) === Number(tifawtCategoryId)) {
      skippedSame += 1;
      continue;
    }

    const label = `${siteSku} → ${getStoreCategoryName(storeCategoryId)} (#${tifawtCategoryId})`;
    if (dryRun) {
      console.log(`[dry-run] ${label}`);
      updated += 1;
      continue;
    }

    const result = await syncTifawtCategoryForProduct({
      sku: tifawtProduct.sku || tifawtSku,
      storeCategoryId,
      categoryMap,
      tifawtCategoryId,
    });
    if (result?.ok) {
      updated += 1;
      tifawtProduct.categoryId = tifawtCategoryId;
      console.log(`✅ ${label}`);
    } else {
      failed += 1;
      console.warn(`❌ ${label}: ${result?.error || result?.reason || 'failed'}`);
    }
    await delay(120);
  }

  console.log('\n=== Summary ===');
  console.log(`Updated: ${updated}`);
  console.log(`Already correct: ${skippedSame}`);
  console.log(`No Tifawt product: ${skippedNoTifawt}`);
  console.log(`No category mapping: ${skippedNoMapping}`);
  console.log(`Failed: ${failed}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
