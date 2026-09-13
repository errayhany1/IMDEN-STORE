/**
 * Telegram Mini App helpers for pages opened via the bot OPEN button.
 */

export function getTelegramWebApp() {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp || null;
}

export function isTelegramWebApp() {
  const tg = getTelegramWebApp();
  if (!tg) return false;
  return Boolean(tg.initData || tg.initDataUnsafe?.user);
}

/** Expand the Mini App and apply Telegram theme colors when available. */
export function initTelegramWebApp() {
  const tg = getTelegramWebApp();
  if (!tg) return null;
  try {
    tg.ready();
    tg.expand();
    tg.requestFullscreen?.();
    tg.disableVerticalSwipes?.();
    tg.setHeaderColor?.(tg.themeParams?.bg_color || '#142038');
    tg.setBackgroundColor?.(tg.themeParams?.bg_color || '#142038');
    document.documentElement.classList.add('tg-webapp');
    document.body.classList.add('tg-webapp');
    if (tg.themeParams?.bg_color) {
      document.documentElement.style.setProperty('--tg-bg', tg.themeParams.bg_color);
    }
  } catch (e) {
    console.warn('Telegram WebApp init failed:', e);
  }
  return tg;
}

export function adminTabFromQuery() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  if (!tab) return null;
  const allowed = new Set([
    'dashboard',
    'orders',
    'tifawt-orders',
    'jumia-orders',
    'products',
    'inventory-sync',
    'social-publish',
    'telegram-catalog',
    'dropship',
    'returns',
    'bot-settings',
    'settings',
  ]);
  return allowed.has(tab) ? tab : null;
}
