/**
 * Meta Pixel for the storefront (errayhany.com) → Ad account RR only.
 * Dataset: "errayhany gro" — do NOT swap for RH.01 pixels used by other sites.
 */
export const META_PIXEL_ID = '27623899353918795';

export function trackMeta(event, params) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  if (params) window.fbq('track', event, params);
  else window.fbq('track', event);
}

export function trackMetaCustom(event, params) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  if (params) window.fbq('trackCustom', event, params);
  else window.fbq('trackCustom', event);
}
