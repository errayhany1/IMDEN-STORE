/**
 * Export Tifawt ↔ NocoDB inventory reconciliation CSV files.
 *
 * Usage: node scripts/reconcile-tifawt-nocodb.mjs
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadInventoryReconcile,
  reconcileToCsvFiles,
} from '../bot/inventoryReconcile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env') });
dotenv.config({ path: path.join(ROOT, 'bot', '.env'), override: true });

const OUT_DIR = path.join(ROOT, 'docs', 'inventory');

async function main() {
  const reconcile = await loadInventoryReconcile();
  const csv = reconcileToCsvFiles(reconcile);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'tifawt-stocked-not-in-nocodb.csv'), `\uFEFF${csv.tifawtStockedNotInNoco}`);
  fs.writeFileSync(path.join(OUT_DIR, 'noco-postebl-unlinked-tifawt.csv'), `\uFEFF${csv.nocoPosteblUnlinked}`);
  fs.writeFileSync(path.join(OUT_DIR, 'tifawt-noco-matched-ok.csv'), `\uFEFF${csv.matchedOk}`);
  fs.writeFileSync(
    path.join(OUT_DIR, 'reconcile-summary.json'),
    JSON.stringify({ generatedAt: reconcile.generatedAt, totals: reconcile.totals }, null, 2),
  );

  console.log(JSON.stringify(reconcile.totals, null, 2));
  console.log(`Files written to ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
