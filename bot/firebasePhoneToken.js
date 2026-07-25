/**
 * Verify Firebase ID tokens via Identity Toolkit `accounts:lookup`.
 * No Admin SDK / service account required: Google rejects invalid tokens, and
 * claims (uid, email, phoneNumber) come from Google — never from the client body.
 */
import axios from 'axios';

const API_KEY = (
  process.env.FIREBASE_WEB_API_KEY
  || process.env.VITE_FIREBASE_API_KEY
  || 'AIzaSyBMqWK7aUv1rBeZEvtfrK48g-ZQXyb4NHE'
).trim();

const LOOKUP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`;

/**
 * @param {string} idToken
 * @returns {Promise<{
 *   ok: boolean,
 *   uid?: string,
 *   email?: string,
 *   phone?: string,
 *   error?: string,
 * }>}
 */
export async function verifyFirebaseIdToken(idToken) {
  const token = String(idToken || '').trim();
  if (!token || token.length < 20) {
    return { ok: false, error: 'missing_token' };
  }

  try {
    const { data } = await axios.post(
      LOOKUP_URL,
      { idToken: token },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    const user = data?.users?.[0];
    if (!user?.localId) return { ok: false, error: 'invalid_token' };
    return {
      ok: true,
      uid: user.localId,
      email: user.email || '',
      phone: user.phoneNumber || '',
    };
  } catch (err) {
    const message = err?.response?.data?.error?.message || err?.message;
    console.warn('[auth] token verification failed:', message);
    return { ok: false, error: 'invalid_token' };
  }
}

/**
 * SMS / phone-provider tokens only (used by public /tracking).
 */
export async function verifyPhoneIdToken(idToken) {
  const result = await verifyFirebaseIdToken(idToken);
  if (!result.ok) return result;
  if (!result.phone) return { ok: false, error: 'phone_not_verified' };
  return result;
}
