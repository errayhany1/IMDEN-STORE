/**
 * Related-product ranking: prefer close use-case affinity over "same category only".
 *
 * Example: a laptop charger should surface mice, cooling pads and stands
 * (desk ecosystem) ahead of yet another random charger when those are available.
 */

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'pack', 'pcs', 'piece', 'pieces',
  'original', 'generic', 'nouveau', 'nouvelle', 'pour', 'avec', 'sans',
  'نوع', 'جودة', 'أصلي', 'أصلى', 'قطعة', 'قطع', 'منتج', 'جهاز',
  'cable', 'câble', 'كابل', 'usb', 'type', 'led',
]);

/** Complementary categories — not identical, but often bought / used together. */
const CATEGORY_AFFINITY = {
  Chargers: {
    Cables: 8,
    'Batteries & Power Banks': 7,
    'Adapters & Hubs': 6,
    Phones: 6,
    'Car Accessories': 5,
    'Smart Watches': 4,
  },
  Audio: {
    Microphones: 7,
    Gaming: 6,
    Phones: 5,
    'Smart Watches': 4,
    'TV Boxes': 4,
    'Car Accessories': 3,
  },
  'Smart Watches': {
    Phones: 8,
    Chargers: 6,
    'Batteries & Power Banks': 5,
    Cables: 4,
    Audio: 4,
  },
  Gaming: {
    'Mouse & Keyboard': 8,
    Cooling: 7,
    Audio: 6,
    Microphones: 5,
    Lighting: 5,
    Stands: 3,
  },
  'Mouse & Keyboard': {
    'Laptop Chargers': 8,
    Cooling: 7,
    Stands: 6,
    Gaming: 6,
    Storage: 5,
    'Adapters & Hubs': 5,
    Cables: 4,
  },
  Storage: {
    'Adapters & Hubs': 7,
    'Laptop Chargers': 5,
    'Mouse & Keyboard': 4,
    Network: 4,
    Cameras: 3,
  },
  'Laptop Chargers': {
    'Mouse & Keyboard': 9,
    Cooling: 8,
    Stands: 7,
    Storage: 6,
    'Adapters & Hubs': 6,
    Cables: 5,
    Gaming: 4,
  },
  Stands: {
    'Laptop Chargers': 7,
    Cooling: 6,
    'Mouse & Keyboard': 5,
    Phones: 5,
    Cameras: 4,
    Lighting: 3,
  },
  Lighting: {
    Gaming: 6,
    Cameras: 6,
    Microphones: 5,
    Stands: 4,
  },
  Cameras: {
    Lighting: 7,
    Stands: 6,
    Storage: 5,
    Microphones: 5,
    Network: 3,
  },
  Network: {
    'TV Boxes': 7,
    Storage: 5,
    'Adapters & Hubs': 5,
    Cables: 4,
  },
  Microphones: {
    Audio: 7,
    Gaming: 6,
    Lighting: 5,
    Cameras: 5,
  },
  'Batteries & Power Banks': {
    Chargers: 8,
    Cables: 7,
    Phones: 6,
    'Car Accessories': 5,
    'Smart Watches': 4,
  },
  Cables: {
    Chargers: 8,
    'Laptop Chargers': 6,
    'Adapters & Hubs': 7,
    'Batteries & Power Banks': 5,
    Phones: 5,
    Network: 3,
  },
  'Car Accessories': {
    Chargers: 7,
    'Batteries & Power Banks': 6,
    Phones: 5,
    Cables: 5,
    Audio: 4,
  },
  'Adapters & Hubs': {
    Cables: 8,
    'Laptop Chargers': 6,
    Storage: 6,
    Network: 5,
    'Mouse & Keyboard': 4,
  },
  'TV Boxes': {
    Network: 8,
    Audio: 5,
    Cables: 4,
    Remotes: 3,
  },
  Cooling: {
    'Laptop Chargers': 8,
    'Mouse & Keyboard': 7,
    Gaming: 6,
    Stands: 5,
  },
  Phones: {
    Chargers: 8,
    'Batteries & Power Banks': 7,
    'Smart Watches': 6,
    Cables: 6,
    Audio: 5,
    'Car Accessories': 4,
  },
};

/**
 * Shared device / use-case ecosystems detected from titles.
 * When two products share an ecosystem, they score even across categories.
 */
const ECOSYSTEMS = [
  {
    id: 'laptop',
    weight: 10,
    tokens: [
      'laptop', 'notebook', 'ordinateur', 'pc', 'macbook', 'chromebook',
      'لابتوب', 'حاسوب', 'كمبيوتر', 'نوتبوك',
    ],
    preferCategories: [
      'Laptop Chargers', 'Mouse & Keyboard', 'Cooling', 'Stands',
      'Storage', 'Adapters & Hubs', 'Cables',
    ],
  },
  {
    id: 'phone',
    weight: 10,
    tokens: [
      'phone', 'iphone', 'samsung', 'xiaomi', 'redmi', 'huawei', 'oppo',
      'android', 'smartphone', 'mobile',
      'هاتف', 'جوال', 'موبايل', 'ايفون', 'سامسونج',
    ],
    preferCategories: [
      'Phones', 'Chargers', 'Batteries & Power Banks', 'Cables',
      'Smart Watches', 'Audio', 'Car Accessories',
    ],
  },
  {
    id: 'car',
    weight: 9,
    tokens: ['car', 'auto', 'voiture', 'vehicle', 'سيارة', 'سيارات', 'سيارة'],
    preferCategories: [
      'Car Accessories', 'Chargers', 'Batteries & Power Banks', 'Audio', 'Cables',
    ],
  },
  {
    id: 'gaming',
    weight: 9,
    tokens: [
      'gaming', 'gamer', 'ps4', 'ps5', 'xbox', 'nintendo', 'joystick', 'manette',
      'ألعاب', 'جيمينغ', 'بلايستيشن', 'قيمنق',
    ],
    preferCategories: [
      'Gaming', 'Mouse & Keyboard', 'Audio', 'Cooling', 'Microphones', 'Lighting',
    ],
  },
  {
    id: 'audio',
    weight: 7,
    tokens: [
      'headset', 'earphone', 'earbuds', 'speaker', 'bluetooth', 'casque',
      'écouteur', 'سماعة', 'سماعات', 'بلوتوث',
    ],
    preferCategories: ['Audio', 'Microphones', 'Phones', 'Gaming'],
  },
  {
    id: 'watch',
    weight: 8,
    tokens: ['watch', 'montre', 'bracelet', 'ساعة', 'ساعات', 'سوار'],
    preferCategories: ['Smart Watches', 'Phones', 'Chargers', 'Batteries & Power Banks'],
  },
  {
    id: 'camera',
    weight: 7,
    tokens: ['camera', 'webcam', 'caméra', 'كاميرا', 'كاميرات'],
    preferCategories: ['Cameras', 'Lighting', 'Stands', 'Storage', 'Microphones'],
  },
];

const normalizeWords = (value = '') => (
  String(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
);

const productText = (product) => {
  const od = product?.originalData || {};
  return [
    product?.name,
    product?.ref,
    od.Arabic_Title,
    od.French_Title,
    od.Woo_Title,
    od.Title,
    product?.baseCategory,
    product?.category,
  ].filter(Boolean).join(' ');
};

const categoryOf = (product) => product?.baseCategory || product?.category || 'General';

export function detectEcosystems(product) {
  const text = productText(product).toLowerCase();
  const words = new Set(normalizeWords(text));
  return ECOSYSTEMS.filter((eco) => (
    eco.tokens.some((token) => text.includes(token) || words.has(token))
  ));
}

function affinityBetweenCategories(a, b) {
  if (!a || !b || a === b) return 0;
  return CATEGORY_AFFINITY[a]?.[b] || CATEGORY_AFFINITY[b]?.[a] || 0;
}

/**
 * Score how related `candidate` is to `product`. Higher = closer relationship.
 */
export function scoreRelatedProduct(product, candidate) {
  if (!product || !candidate) return 0;
  if (String(candidate.id) === String(product.id)) return 0;
  if (candidate.category === 'Out of Stock' || candidate.isAvailable === false) return 0;

  const sourceCat = categoryOf(product);
  const candidateCat = categoryOf(candidate);
  const sourceEcos = detectEcosystems(product);
  const candidateEcos = detectEcosystems(candidate);
  const sourceEcoIds = new Set(sourceEcos.map((e) => e.id));
  const sharedEcos = candidateEcos.filter((e) => sourceEcoIds.has(e.id));

  let score = 0;

  // Complementary categories beat identical category when the shopper
  // is looking for "what goes with this", not "more of the same".
  const complement = affinityBetweenCategories(sourceCat, candidateCat);
  if (complement) {
    score += complement;
  } else if (sourceCat === candidateCat && sourceCat !== 'General') {
    score += 3; // mild same-category boost, never dominant
  }

  // Shared device ecosystem (laptop ↔ mouse, phone ↔ power bank, …)
  for (const eco of sharedEcos) {
    score += eco.weight;
  }

  // Candidate sits in a category preferred by the source ecosystem
  // even if the candidate title doesn't repeat the keyword.
  if (sourceEcos.length && !sharedEcos.length) {
    for (const eco of sourceEcos) {
      if (eco.preferCategories.includes(candidateCat)) {
        score += Math.round(eco.weight * 0.55);
        break;
      }
    }
  }

  // Meaningful shared title tokens (brand, model family, connector type…)
  const sourceWords = new Set(normalizeWords(productText(product)));
  const sharedWords = normalizeWords(productText(candidate))
    .filter((word) => sourceWords.has(word));
  score += Math.min(sharedWords.length, 4) * 2.5;

  // Soft price proximity — accessories near the same budget feel natural
  const sourcePrice = Number(product.price) || 0;
  const candidatePrice = Number(candidate.price) || 0;
  if (sourcePrice > 0 && candidatePrice > 0) {
    const ratio = Math.abs(candidatePrice - sourcePrice) / sourcePrice;
    if (ratio <= 0.35) score += 2;
    else if (ratio <= 0.8) score += 1;
  }

  return score;
}

/**
 * Rank products by relationship strength and return the top matches.
 * Caps how many items may come from the source category so the strip
 * stays a complementary assortment, not "more of the same".
 * @param {object} product
 * @param {object[]} catalog
 * @param {{ limit?: number, minScore?: number, maxSameCategory?: number }} [options]
 */
export function findRelatedProducts(product, catalog = [], options = {}) {
  const limit = options.limit ?? 8;
  const minScore = options.minScore ?? 4;
  const maxSameCategory = options.maxSameCategory ?? 1;

  if (!product || !Array.isArray(catalog) || !catalog.length) return [];

  const sourceCat = categoryOf(product);
  const ranked = catalog
    .map((candidate) => ({
      candidate,
      score: scoreRelatedProduct(product, candidate),
      cat: categoryOf(candidate),
    }))
    .filter(({ score }) => score >= minScore)
    .sort((a, b) => b.score - a.score || Number(a.candidate.price || 0) - Number(b.candidate.price || 0));

  const picked = [];
  let sameCatCount = 0;
  for (const row of ranked) {
    if (picked.length >= limit) break;
    const isSame = row.cat === sourceCat && sourceCat !== 'General';
    if (isSame && sameCatCount >= maxSameCategory) continue;
    picked.push(row.candidate);
    if (isSame) sameCatCount += 1;
  }

  // If diversity filtered too aggressively, backfill from the remainder.
  if (picked.length < limit) {
    const pickedIds = new Set(picked.map((p) => String(p.id || p.ref)));
    for (const row of ranked) {
      if (picked.length >= limit) break;
      const id = String(row.candidate.id || row.candidate.ref);
      if (pickedIds.has(id)) continue;
      picked.push(row.candidate);
      pickedIds.add(id);
    }
  }

  return picked;
}
