/**
 * Shared authenticated client for the Tifawt ERP API.
 * Auth: email/password login → Bearer accessToken (cached in memory, 401-aware).
 */
import axios from 'axios';

export const API_BASE = (
  process.env.TIFAWT_API_BASE
  || 'https://errayhany.tifawt.ma/api/v1'
).replace(/\/$/, '');

export const BUSINESS_ID = Number(process.env.TIFAWT_BUSINESS_ID || 1);

/** Read on each call so dotenv / EasyPanel env is visible after module load. */
function tifawtEmail() {
  return (process.env.TIFAWT_EMAIL || '').trim();
}
function tifawtPassword() {
  return process.env.TIFAWT_PASSWORD || '';
}
function tifawtStaticToken() {
  return (process.env.TIFAWT_ACCESS_TOKEN || '').trim();
}

let cachedToken = '';
let tokenFetchedAt = 0;
/** Soft TTL — re-login after 6h or on 401. */
const TOKEN_TTL_MS = Number(process.env.TIFAWT_TOKEN_TTL_MS || 6 * 60 * 60 * 1000);

export function isTifawtApiConfigured() {
  return Boolean((tifawtEmail() && tifawtPassword()) || tifawtStaticToken() || cachedToken);
}

async function login() {
  const email = tifawtEmail();
  const password = tifawtPassword();
  const staticToken = tifawtStaticToken();
  if (!email || !password) {
    if (staticToken) {
      cachedToken = staticToken;
      tokenFetchedAt = Date.now();
      return staticToken;
    }
    throw new Error('TIFAWT_EMAIL / TIFAWT_PASSWORD missing');
  }
  const { data } = await axios.post(
    `${API_BASE}/auth/login`,
    { email, password },
    { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
  );
  const token = data?.accessToken;
  if (!token) throw new Error('Tifawt login: no accessToken in response');
  cachedToken = token;
  tokenFetchedAt = Date.now();
  return token;
}

export async function getTifawtToken({ force = false } = {}) {
  const email = tifawtEmail();
  const password = tifawtPassword();
  const staticToken = tifawtStaticToken();

  if (email && password) {
    const fresh = cachedToken
      && !force
      && (Date.now() - tokenFetchedAt) < TOKEN_TTL_MS;
    if (fresh) return cachedToken;
    return login();
  }

  if (!cachedToken && staticToken) {
    cachedToken = staticToken;
    tokenFetchedAt = Date.now();
  }
  const fresh = cachedToken
    && !force
    && (Date.now() - tokenFetchedAt) < TOKEN_TTL_MS;
  if (fresh) return cachedToken;
  if (staticToken) {
    cachedToken = staticToken;
    tokenFetchedAt = Date.now();
    return cachedToken;
  }
  return login();
}

/**
 * Run an authenticated request, retrying once with a fresh token on 401.
 * @param {(token: string) => Promise<any>} run
 */
export async function withTifawtToken(run) {
  try {
    return await run(await getTifawtToken());
  } catch (err) {
    if (err?.response?.status === 401) {
      return run(await getTifawtToken({ force: true }));
    }
    throw err;
  }
}
