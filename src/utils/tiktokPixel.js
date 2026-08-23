/**
 * TikTok Pixel for errayhany.com → Ads Manager "Errayhany Grossiste_adv".
 * Pixel: Errayhany VIP
 */
export const TIKTOK_PIXEL_ID = 'DA55GDRC77U0QGTKI120';

export function trackTikTok(event, params) {
  if (typeof window === 'undefined' || !window.ttq || typeof window.ttq.track !== 'function') return;
  if (params) window.ttq.track(event, params);
  else window.ttq.track(event);
}
