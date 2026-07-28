import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  getOrdersForAccount,
  isCustomerAccountsConfigured,
  normalizeMoroccanPhone,
} from './customerAccount';
import { fetchAccountOrders } from './orderTracking';

const SUMMARY_COL = 'productRatings';
const VOTE_COL = 'productRatingVotes';

const memoryCache = new Map();
const purchaseCache = new Map();

export const productRatingKey = (product) => {
  const raw = String(product?.ref || product?.id || '').trim();
  return raw
    .replace(/[/#?[\]*]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 120) || '';
};

/** Signed-in users only — anonymous localStorage votes are no longer accepted. */
export const getVoterId = (user) => {
  if (user?.uid) return `uid_${user.uid}`;
  return '';
};

const clampStars = (value) => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.min(5, Math.max(1, n));
};

const emptySummary = () => ({ avg: 0, count: 0, myRating: 0 });

export const normalizeProductSku = (value = '') => String(value || '')
  .trim()
  .toUpperCase()
  .replace(/\s+/g, '-')
  .replace(/^ERY[-_]?/i, '');

export const productSkuCandidates = (product) => {
  const raw = [
    product?.ref,
    product?.SKU,
    product?.sku,
    product?.id,
    product?.Id,
    product?.SellerSKU,
  ].map((v) => String(v || '').trim()).filter(Boolean);
  const out = new Set();
  for (const item of raw) {
    out.add(item.toUpperCase());
    const bare = normalizeProductSku(item);
    if (bare) {
      out.add(bare);
      out.add(`ERY-${bare}`);
    }
  }
  return [...out];
};

const isCancelledOrReturned = (status) => {
  const s = String(status || '').trim().toLowerCase();
  return (
    s.includes('cancel')
    || s.includes('ملغي')
    || s.includes('return')
    || s.includes('مرتجع')
    || s.includes('refus')
    || s.includes('reject')
    || s === 'duplicate'
  );
};

const parseOrderItems = (order) => {
  if (Array.isArray(order?.products) && order.products.length) {
    return order.products;
  }
  if (Array.isArray(order?.items) && order.items.length) {
    return order.items;
  }
  const raw = order?.['Order Metadata'] || order?.orderMetadata || '[]';
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const orderContainsProduct = (order, candidates) => {
  if (isCancelledOrReturned(order?.status || order?.Status || order?.statusLabel)) {
    return false;
  }
  const wanted = new Set(candidates.map((c) => normalizeProductSku(c)).filter(Boolean));
  if (!wanted.size) return false;

  for (const item of parseOrderItems(order)) {
    const keys = [
      item?.ref,
      item?.sku,
      item?.SKU,
      item?.id,
      item?.Id,
      item?.product?.sku,
      item?.rawSku,
    ];
    for (const key of keys) {
      const bare = normalizeProductSku(key);
      if (bare && wanted.has(bare)) return true;
    }
  }
  return false;
};

/**
 * True when the signed-in customer has a non-cancelled order that includes this product
 * (site NocoDB orders and/or Tifawt account orders).
 */
export async function hasPurchasedProduct(product, user) {
  if (!user?.uid || !product) return false;

  const candidates = productSkuCandidates(product);
  if (!candidates.length) return false;

  const cacheKey = `${user.uid}::${candidates.sort().join('|')}`;
  if (purchaseCache.has(cacheKey)) {
    return purchaseCache.get(cacheKey);
  }

  let purchased = false;
  try {
    const tasks = [];

    if (isCustomerAccountsConfigured) {
      const phone = normalizeMoroccanPhone(user.phoneNumber || '');
      tasks.push(
        getOrdersForAccount({ uid: user.uid, phone }).catch(() => []),
      );
    }

    if (typeof user.getIdToken === 'function') {
      tasks.push(
        (async () => {
          try {
            const idToken = await user.getIdToken();
            const result = await fetchAccountOrders(idToken);
            return Array.isArray(result?.orders) ? result.orders : [];
          } catch {
            return [];
          }
        })(),
      );
    }

    const groups = await Promise.all(tasks);
    purchased = groups.flat().some((order) => orderContainsProduct(order, candidates));
  } catch (err) {
    console.warn('hasPurchasedProduct failed:', err?.message || err);
    purchased = false;
  }

  purchaseCache.set(cacheKey, purchased);
  // Only keep positive hits — a fresh order should unlock rating without a hard refresh.
  if (!purchased) purchaseCache.delete(cacheKey);
  return purchased;
}

/**
 * Average only — used by the grid cards, which never vote. Cached per session
 * so a page full of cards costs one read per product at most.
 */
export async function fetchProductRatingSummary(product) {
  const key = productRatingKey(product);
  if (!key) return emptySummary();

  const cached = memoryCache.get(key);
  if (cached) return cached;

  try {
    const snap = await getDoc(doc(db, SUMMARY_COL, key));
    const data = snap.exists() ? snap.data() : {};
    const result = {
      avg: Number(data.avg) || 0,
      count: Number(data.count) || 0,
      myRating: 0,
    };
    memoryCache.set(key, result);
    return result;
  } catch (err) {
    console.warn('fetchProductRatingSummary failed:', err?.message || err);
    return emptySummary();
  }
}

/**
 * Load rating summary + current visitor vote for a product.
 */
export async function fetchProductRating(product, user = null) {
  const key = productRatingKey(product);
  if (!key) return emptySummary();

  const cached = memoryCache.get(key);
  const voterId = getVoterId(user);

  try {
    const reads = [getDoc(doc(db, SUMMARY_COL, key))];
    if (voterId) {
      reads.push(getDoc(doc(db, VOTE_COL, `${key}__${voterId}`)));
    }
    const [summarySnap, voteSnap] = await Promise.all(reads);

    const summary = summarySnap.exists()
      ? summarySnap.data()
      : { avg: 0, count: 0, sum: 0 };
    const myRating = voteSnap?.exists?.()
      ? clampStars(voteSnap.data()?.rating)
      : 0;

    const result = {
      avg: Number(summary.avg) || 0,
      count: Number(summary.count) || 0,
      myRating,
    };
    memoryCache.set(key, result);
    return result;
  } catch (err) {
    console.warn('fetchProductRating failed:', err?.message || err);
    return cached || emptySummary();
  }
}

/**
 * Submit / update a 1–5 star rating for a product.
 * Only signed-in customers who previously purchased the product may vote.
 */
export async function submitProductRating(product, stars, user = null) {
  const key = productRatingKey(product);
  const rating = clampStars(stars);
  if (!key || !rating) {
    throw new Error('تقييم غير صالح');
  }
  if (!user?.uid) {
    const err = new Error('يجب تسجيل الدخول لتقييم المنتج');
    err.code = 'auth_required';
    throw err;
  }

  const purchased = await hasPurchasedProduct(product, user);
  if (!purchased) {
    const err = new Error('التقييم متاح فقط بعد شراء هذا المنتج');
    err.code = 'purchase_required';
    throw err;
  }

  const voterId = getVoterId(user);
  if (!voterId) {
    const err = new Error('يجب تسجيل الدخول لتقييم المنتج');
    err.code = 'auth_required';
    throw err;
  }

  const summaryRef = doc(db, SUMMARY_COL, key);
  const voteRef = doc(db, VOTE_COL, `${key}__${voterId}`);

  const result = await runTransaction(db, async (tx) => {
    // Reads must be sequential before any writes in a Firestore transaction.
    const summarySnap = await tx.get(summaryRef);
    const voteSnap = await tx.get(voteRef);

    let sum = summarySnap.exists() ? Number(summarySnap.data().sum) || 0 : 0;
    let count = summarySnap.exists() ? Number(summarySnap.data().count) || 0 : 0;
    const prev = voteSnap.exists() ? clampStars(voteSnap.data()?.rating) : 0;

    if (prev) {
      sum = sum - prev + rating;
    } else {
      sum += rating;
      count += 1;
    }

    const avg = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;

    tx.set(summaryRef, {
      productKey: key,
      ref: String(product.ref || ''),
      productId: String(product.id || ''),
      sum,
      count,
      avg,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    tx.set(voteRef, {
      productKey: key,
      voterId,
      uid: user.uid,
      rating,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return { avg, count, myRating: rating };
  });

  memoryCache.set(key, result);
  return result;
}
