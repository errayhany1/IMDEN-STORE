/**
 * Resolve the Moroccan phone number SMS-verified and linked to a Firebase
 * account. Order of trust:
 *  1. phoneNumber claim on the Firebase ID token (phone provider / linked)
 *  2. Firestore customerAccounts/{uid} (owner-readable with the same idToken)
 *  3. NocoDB Customers table (optional; needs VITE_NOCODB_TABLE_CUSTOMERS)
 *
 * The client never chooses the phone freely for /api/orders/account.
 */
import axios from 'axios';
import { normalizePhone } from './tifawtOrders.js';

const PROJECT_ID = (
  process.env.FIREBASE_PROJECT_ID
  || process.env.VITE_FIREBASE_PROJECT_ID
  || 'imden-errayany'
).trim();

const NOCODB_URL = (
  process.env.VITE_NOCODB_URL || process.env.NOCODB_URL || ''
).replace(/\/$/, '');
const NOCODB_TOKEN = (
  process.env.VITE_NOCODB_ORDERS_TOKEN
  || process.env.VITE_NOCODB_API_TOKEN
  || process.env.NOCODB_API_TOKEN
  || ''
).trim();
const CUSTOMERS_TABLE = (
  process.env.VITE_NOCODB_TABLE_CUSTOMERS
  || process.env.NOCODB_TABLE_CUSTOMERS
  || ''
).trim();

const safeWhereValue = (value = '') => String(value).replace(/[(),]/g, '').trim();
const isValidMaPhone = (phone) => /^0[5-7]\d{8}$/.test(phone);

async function phoneFromFirestore(uid, idToken) {
  if (!uid || !idToken) return '';
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/customerAccounts/${encodeURIComponent(uid)}`;
  try {
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${idToken}` },
      timeout: 15000,
    });
    const fields = data?.fields || {};
    const verified = fields.phoneVerified?.booleanValue === true;
    if (!verified) return '';
    return normalizePhone(
      fields.normalizedPhone?.stringValue
      || fields.phone?.stringValue
      || ''
    );
  } catch (err) {
    const status = err?.response?.status;
    if (status !== 404) {
      console.warn('[account] Firestore phone lookup:', status, err?.message);
    }
    return '';
  }
}

async function phoneFromNoco(uid) {
  if (!uid || !NOCODB_URL || !NOCODB_TOKEN || !CUSTOMERS_TABLE) return '';
  try {
    const { data } = await axios.get(
      `${NOCODB_URL}/api/v2/tables/${CUSTOMERS_TABLE}/records`,
      {
        headers: {
          'xc-token': NOCODB_TOKEN,
          'Content-Type': 'application/json',
        },
        params: {
          where: `(Firebase UID,eq,${safeWhereValue(uid)})`,
          limit: 1,
        },
        timeout: 20000,
      }
    );
    const row = data?.list?.[0];
    if (!row) return '';
    const verified = row['Phone Verified'] === true
      || row['Phone Verified'] === 1
      || row['Phone Verified'] === '1'
      || row['Phone Verified'] === 'true';
    if (!verified) return '';
    return normalizePhone(row['Phone Normalized'] || row.Phone || '');
  } catch (err) {
    console.error('[account] NocoDB phone lookup failed:', err?.message || err);
    return '';
  }
}

/**
 * @param {{ uid: string, authPhone?: string, idToken?: string }} input
 */
export async function resolveLinkedPhone({ uid, authPhone = '', idToken = '' }) {
  const fromAuth = normalizePhone(authPhone);
  if (isValidMaPhone(fromAuth)) {
    return { ok: true, phone: fromAuth, source: 'firebase_auth' };
  }

  if (!uid) return { ok: false, error: 'missing_uid' };

  const fromFs = await phoneFromFirestore(uid, idToken);
  if (isValidMaPhone(fromFs)) {
    return { ok: true, phone: fromFs, source: 'firestore' };
  }

  const fromNoco = await phoneFromNoco(uid);
  if (isValidMaPhone(fromNoco)) {
    return { ok: true, phone: fromNoco, source: 'customer_profile' };
  }

  return { ok: false, error: 'phone_not_linked' };
}
