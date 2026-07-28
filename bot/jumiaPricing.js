/**
 * Jumia retail offer from NocoDB wholesale price.
 *
 * Stock: 100 normally, 0 when POSTEBL === 'NO POSTEBL'
 * Sale price: wholesale + tier profit + 5 DH pack/warehouse, grossed up for 15% Jumia cut
 * List price: sale + 50..100 DH (fake discount feel)
 * Both prices end with .99 or .98
 * Sale window: long (years)
 */

const JUMIA_COMMISSION = 0.15;
const PACK_WAREHOUSE_DH = 5;

/** Profit bands by wholesale (MAD). Interpolate within each band. */
const PROFIT_TIERS = [
  { max: 35, minProfit: 20, maxProfit: 30 },
  { max: 65, minProfit: 30, maxProfit: 50 },
  { max: 110, minProfit: 40, maxProfit: 60 },
  { max: 300, minProfit: 50, maxProfit: 80 },
  { max: 500, minProfit: 60, maxProfit: 90 },
  { max: 800, minProfit: 70, maxProfit: 110 },
  { max: 1200, minProfit: 80, maxProfit: 130 },
  { max: 2000, minProfit: 100, maxProfit: 160 },
  { max: Infinity, minProfit: 120, maxProfit: 180 },
];

function hashString(value = '') {
  let h = 0;
  const s = String(value);
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Stable profit inside the tier for a given wholesale + sku.
 * @param {number} wholesale
 * @param {string} [sku]
 */
export function profitForWholesale(wholesale, sku = '') {
  const w = Math.max(0, Number(wholesale) || 0);
  let prevMax = 0;
  for (const tier of PROFIT_TIERS) {
    if (w <= tier.max) {
      const span = Math.max(1, tier.max - prevMax);
      const t = clamp((w - prevMax) / span, 0, 1);
      // Blend mid-tier with a tiny sku jitter so similar prices aren't identical.
      const mid = tier.minProfit + (tier.maxProfit - tier.minProfit) * t;
      const jitter = ((hashString(sku) % 7) - 3); // -3..+3
      return clamp(
        Math.round(mid + jitter),
        tier.minProfit,
        tier.maxProfit,
      );
    }
    prevMax = tier.max === Infinity ? prevMax : tier.max;
  }
  return 150;
}

/** Charm ending .99 or .98 (stable per sku). */
export function charmPrice(amount, sku = '') {
  const raw = Math.max(1, Number(amount) || 1);
  const ceil = Math.ceil(raw);
  const cents = hashString(sku) % 2 === 0 ? 0.99 : 0.98;
  const charming = Number((ceil - 1 + cents).toFixed(2));
  return Math.max(cents === 0.99 ? 0.99 : 0.98, charming);
}

export function isOutOfStockPostebl(postebl) {
  const v = String(postebl || '').trim().toUpperCase();
  return v === 'NO POSTEBL' || v === 'NO_POSTEBL' || v === 'OUT' || v === '0';
}

/** Always 100, or 0 when NocoDB says NO POSTEBL. */
export function resolveJumiaStock(postebl) {
  return isOutOfStockPostebl(postebl) ? 0 : 100;
}

function longSaleWindow() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 3);
  return {
    saleStartDate: start.toISOString(),
    saleEndDate: end.toISOString(),
  };
}

/**
 * @param {{ wholesale: number, postebl?: string, sku?: string }} opts
 * @returns {{
 *   stock: number,
 *   wholesale: number,
 *   profit: number,
 *   packFee: number,
 *   commissionRate: number,
 *   netBeforeCommission: number,
 *   salePrice: number,
 *   listPrice: number,
 *   saleStartDate: string,
 *   saleEndDate: string,
 * }}
 */
export function buildJumiaOffer({ wholesale, postebl = 'POSTEBL', sku = '' } = {}) {
  const w = Math.max(0, Number(wholesale) || 0);
  const profit = profitForWholesale(w, sku);
  const packFee = PACK_WAREHOUSE_DH;
  const netBeforeCommission = w + profit + packFee;
  // Gross-up so after 15% Jumia cut we still keep netBeforeCommission.
  const saleRaw = netBeforeCommission / (1 - JUMIA_COMMISSION);
  const salePrice = charmPrice(saleRaw, `${sku}:sale`);

  const bump = 50 + (hashString(`${sku}:bump`) % 51); // 50..100
  let listPrice = charmPrice(salePrice + bump, `${sku}:list`);
  if (listPrice <= salePrice) {
    listPrice = charmPrice(salePrice + 50, `${sku}:list2`);
  }
  if (listPrice <= salePrice) {
    listPrice = Number((salePrice + 50.99).toFixed(2));
  }

  const { saleStartDate, saleEndDate } = longSaleWindow();

  return {
    stock: resolveJumiaStock(postebl),
    wholesale: w,
    profit,
    packFee,
    commissionRate: JUMIA_COMMISSION,
    netBeforeCommission: Number(netBeforeCommission.toFixed(2)),
    salePrice,
    listPrice,
    saleStartDate,
    saleEndDate,
  };
}
