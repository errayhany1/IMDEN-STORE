/**
 * Local product-copy templates. Facts are extracted once by a vision model,
 * then rendered without additional paid text calls.
 */
const clean = (value, max = 160) => String(value || '').replace(/<[^>]*>/g, '').trim().slice(0, max);

const list = (value, max = 6) => (Array.isArray(value) ? value : [])
  .map((item) => clean(item, 120))
  .filter(Boolean)
  .slice(0, max);

function bullets(items, lang) {
  const values = list(items, 6);
  if (!values.length) return '';
  return `<ul>${values.map((item) => `<li>${item}</li>`).join('')}</ul>`;
}

/**
 * Convert a strict visual-facts object into the legacy copy shape consumed by
 * the catalog, Jumia payload, and Telegram approval flow.
 */
export function factsToProductCopy(facts = {}, { name = '', price = '', ref = '' } = {}) {
  const brand = clean(facts.brand, 80) || 'Generic';
  const model = clean(facts.model, 100);
  const color = clean(facts.color, 80) || 'Multicolore';
  const titleFr = clean(facts.title_fr || [brand !== 'Generic' ? brand : '', model, clean(name, 90)].filter(Boolean).join(' '), 120) || clean(name, 120);
  const titleAr = clean(facts.title_ar || facts.arabic_name || name, 120) || titleFr;
  const specs = list(facts.packaging_specs || facts.specs, 6);
  const usesFr = list(facts.uses_fr || facts.bullets_fr || specs, 5);
  const usesAr = list(facts.uses_ar || facts.bullets_ar || specs, 5);
  const shortFr = bullets(usesFr, 'fr');
  const shortAr = bullets(usesAr, 'ar');
  const factsFr = specs.length ? `Caractéristiques: ${specs.join(' • ')}.` : '';
  const factsAr = specs.length ? `المواصفات: ${specs.join(' • ')}.` : '';

  return {
    french_title: titleFr,
    arabic_title: titleAr,
    woo_title: clean(facts.woo_title || titleFr, 80),
    short_description_fr: shortFr,
    short_description_ar: shortAr,
    description_french: `<p>${clean(facts.description_fr || `${titleFr} مناسب للمحلات والموزعين.` , 700)}</p>${shortFr}${factsFr ? `<p>${factsFr}</p>` : ''}`,
    description_arabic: `<p>${clean(facts.description_ar || `${titleAr} مناسب للمحلات والموزعين.` , 700)}</p>${shortAr}${factsAr ? `<p>${factsAr}</p>` : ''}`,
    meta_title: clean(facts.meta_title || titleFr, 60),
    meta_description: clean(facts.meta_description || `${titleFr} بالجملة في المغرب.`, 155),
    brand,
    color,
    color_variants: list(facts.color_variants, 8),
    barcode: clean(facts.barcode, 64).replace(/[^a-zA-Z0-9-]/g, ''),
    packaging_specs: specs,
    facts_ref: clean(ref, 100),
    facts_price: price,
  };
}
