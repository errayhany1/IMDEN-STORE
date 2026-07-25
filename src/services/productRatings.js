import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

const SUMMARY_COL = 'productRatings';
const VOTE_COL = 'productRatingVotes';
const VOTER_KEY = 'ery_rating_voter_id';

const memoryCache = new Map();

export const productRatingKey = (product) => {
  const raw = String(product?.ref || product?.id || '').trim();
  return raw
    .replace(/[/#?[\]*]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 120) || '';
};

export const getVoterId = (user) => {
  if (user?.uid) return `uid_${user.uid}`;
  try {
    let id = localStorage.getItem(VOTER_KEY);
    if (!id) {
      id = `anon_${crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`}`;
      localStorage.setItem(VOTER_KEY, id);
    }
    return id;
  } catch {
    return `anon_session_${Date.now()}`;
  }
};

const clampStars = (value) => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.min(5, Math.max(1, n));
};

const emptySummary = () => ({ avg: 0, count: 0, myRating: 0 });

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
    const [summarySnap, voteSnap] = await Promise.all([
      getDoc(doc(db, SUMMARY_COL, key)),
      getDoc(doc(db, VOTE_COL, `${key}__${voterId}`)),
    ]);

    const summary = summarySnap.exists()
      ? summarySnap.data()
      : { avg: 0, count: 0, sum: 0 };
    const myRating = voteSnap.exists()
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
 * One vote per visitor (local anon id or Firebase uid).
 */
export async function submitProductRating(product, stars, user = null) {
  const key = productRatingKey(product);
  const rating = clampStars(stars);
  if (!key || !rating) {
    throw new Error('تقييم غير صالح');
  }

  const voterId = getVoterId(user);
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
      rating,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return { avg, count, myRating: rating };
  });

  memoryCache.set(key, result);
  return result;
}
