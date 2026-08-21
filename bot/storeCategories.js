/**
 * Store category taxonomy — mirrors src/data/categories.js for the bot runtime.
 * Category_ID values match NocoDB Number field Category_ID.
 */

export const STORE_CATEGORY_BY_ID = {
  1: 'Chargers',
  2: 'Audio',
  3: 'Smart Watches',
  4: 'Gaming',
  5: 'Mouse & Keyboard',
  6: 'Storage',
  7: 'Laptop Chargers',
  8: 'Stands',
  9: 'Lighting',
  10: 'Cameras',
  11: 'Network',
  12: 'General',
  13: 'Microphones',
  14: 'Batteries & Power Banks',
  15: 'Out of Stock',
  16: 'Cables',
  17: 'Car Accessories',
  18: 'Adapters & Hubs',
  19: 'TV Boxes',
  20: 'Cooling',
  21: 'Phones',
};

/** French names recommended when creating categories in Tifawt ERP */
export const TIFAWT_CATEGORY_NAME_FR = {
  1: 'Chargeurs',
  2: 'Audio',
  3: 'Montres connectées',
  4: 'Gaming',
  5: 'Souris et claviers',
  6: 'Stockage',
  7: 'Chargeurs PC portable',
  8: 'Supports',
  9: 'Éclairage',
  10: 'Caméras',
  11: 'Réseau',
  12: 'Général',
  13: 'Microphones',
  14: 'Batteries et power banks',
  15: 'Rupture de stock',
  16: 'Câbles',
  17: 'Accessoires auto',
  18: 'Adaptateurs et hubs',
  19: 'Box TV',
  20: 'Refroidissement',
  21: 'Téléphones',
};

export const STORE_CATEGORY_LABEL_AR = {
  1: 'شواحن جوال',
  2: 'سماعات',
  3: 'ساعات ذكية',
  4: 'ألعاب',
  5: 'ماوس وكيبورد',
  6: 'تخزين',
  7: 'شواحن حواسيب',
  8: 'حوامل',
  9: 'إضاءة',
  10: 'كاميرات',
  11: 'شبكات',
  12: 'عام',
  13: 'ميكروفونات',
  14: 'بطاريات وباوربانك',
  15: 'نفد من المخزون',
  16: 'كابلات',
  17: 'إكسسوارات السيارة',
  18: 'محولات وHUB',
  19: 'أجهزة بث',
  20: 'تبريد',
  21: 'هواتف',
};

/** Telegram inline keyboard labels (with emoji) */
export const STORE_CATEGORY_LABEL_BOT = {
  1: '🔌 شواحن',
  2: '🎧 سماعات',
  3: '⌚ ساعات ذكية',
  4: '🎮 ألعاب',
  5: '🖱️ ماوس وكيبورد',
  6: '💾 تخزين',
  7: '💻 شواحن حواسيب',
  8: '📐 ستاندات',
  9: '💡 إضاءة',
  10: '📷 كاميرات',
  11: '📡 شبكات',
  12: '📦 عام',
  13: '🎙️ ميكروفونات',
  14: '🔋 بطاريات وباوربانk',
  16: '🔗 كابلات',
  17: '🚗 إكسسوارات السيارة',
  18: '🔌 محولات وHUB',
  19: '📺 أجهزة بث',
  20: '❄️ تبريد',
  21: '📱 هواتف',
};

/** IDs shown in the Telegram category picker (excludes Out of Stock) */
export const PICKER_CATEGORY_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21];

export function getStoreCategoryName(id) {
  return STORE_CATEGORY_BY_ID[id] || 'General';
}
