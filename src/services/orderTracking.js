/**
 * Self-service order tracking backed by Tifawt ERP.
 *
 * A visitor may only see their own orders: they prove ownership of the phone
 * number with a Firebase SMS code, and the resulting ID token is what the bot
 * server verifies before querying Tifawt. No phone number typed in the form is
 * ever trusted on its own.
 */
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { phoneVerificationAuth } from './firebase';
import { normalizeMoroccanPhone } from './customerAccount';

// Same-origin by default: nginx proxies /bot-api/* to the bot service, so no
// extra domain or CORS setup is needed. Override only when the bot is hosted
// somewhere else.
const TRACKING_API = (
  import.meta.env.VITE_TRACKING_API_URL
  || import.meta.env.VITE_BOT_URL
  || '/bot-api'
).replace(/\/$/, '');

export const isTrackingApiConfigured = Boolean(TRACKING_API);

export const trackingErrorMessage = (code) => ({
  missing_token: 'انتهت جلسة التحقق. أعد إرسال الرمز.',
  invalid_token: 'انتهت صلاحية التحقق. سجّل الدخول مجدداً.',
  phone_not_verified: 'لم يتم تأكيد رقم الهاتف. أعد المحاولة.',
  phone_not_linked: 'وثّق رقم هاتفك أولاً لربط طلباتك بحسابك.',
  phone_lookup_failed: 'تعذر التحقق من رقم الهاتف المرتبط بالحساب.',
  rate_limited: 'محاولات كثيرة. انتظر دقيقة ثم أعد المحاولة.',
  tifawt_not_configured: 'خدمة التتبع غير مفعّلة حالياً. تواصل معنا عبر واتساب.',
  tifawt_unavailable: 'تعذّر الاتصال بنظام الطلبات. حاول بعد قليل.',
  invalid_phone: 'رقم الهاتف غير صالح.',
}[code] || 'حدث خطأ أثناء جلب الطلبات. حاول مرة أخرى.');

/**
 * Account page: main Firebase session token → Tifawt orders for the phone
 * already linked + SMS-verified on that account.
 */
export async function fetchAccountOrders(idToken) {
  if (!TRACKING_API) {
    throw Object.assign(new Error(trackingErrorMessage('tifawt_not_configured')), {
      code: 'tifawt_not_configured',
    });
  }

  const response = await fetch(`${TRACKING_API}/api/orders/account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) {
    const err = new Error(trackingErrorMessage(data?.error));
    err.code = data?.error || 'unknown';
    err.requiresPhoneVerification = Boolean(data?.requiresPhoneVerification);
    throw err;
  }
  return {
    orders: Array.isArray(data.orders) ? data.orders : [],
    phone: data.phone || '',
  };
}

export function clearRecaptcha(containerId) {
  try {
    window.trackingRecaptchaVerifier?.clear();
  } catch {
    // Firebase may already have released the widget.
  }
  window.trackingRecaptchaVerifier = null;
  const container = document.getElementById(containerId);
  if (container) container.innerHTML = '';
}

/**
 * Send an SMS code to a Moroccan phone number.
 * @returns {Promise<{ confirmation: object, phone: string }>}
 */
export async function sendTrackingCode(phone, recaptchaContainerId) {
  const normalized = normalizeMoroccanPhone(phone);
  if (!normalized) {
    throw new Error('أدخل رقم هاتف مغربي صحيح يبدأ بـ 06 أو 07.');
  }

  clearRecaptcha(recaptchaContainerId);
  window.trackingRecaptchaVerifier = new RecaptchaVerifier(
    phoneVerificationAuth,
    recaptchaContainerId,
    { size: 'invisible' }
  );

  const confirmation = await signInWithPhoneNumber(
    phoneVerificationAuth,
    normalized,
    window.trackingRecaptchaVerifier
  );
  return { confirmation, phone: normalized };
}

/**
 * Confirm the SMS code and fetch the orders tied to that phone number.
 * The phone session is closed right after the token is issued.
 */
export async function confirmCodeAndFetchOrders(confirmation, code, recaptchaContainerId) {
  const credential = await confirmation.confirm(String(code).trim());
  const idToken = await credential.user.getIdToken();
  const verifiedPhone = credential.user.phoneNumber || '';

  try {
    await phoneVerificationAuth.signOut();
  } catch {
    // Signing out is best-effort; the token is already issued.
  }
  clearRecaptcha(recaptchaContainerId);

  const orders = await fetchMyOrders(idToken);
  return { orders, phone: verifiedPhone };
}

/**
 * @param {string} idToken Firebase ID token from the SMS sign-in
 * @returns {Promise<object[]>}
 */
export async function fetchMyOrders(idToken) {
  if (!TRACKING_API) {
    throw new Error(trackingErrorMessage('tifawt_not_configured'));
  }

  const response = await fetch(`${TRACKING_API}/api/orders/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) {
    throw new Error(trackingErrorMessage(data?.error));
  }
  return Array.isArray(data.orders) ? data.orders : [];
}
