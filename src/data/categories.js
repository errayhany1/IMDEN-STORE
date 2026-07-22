/**
 * Canonical product category taxonomy for the storefront, bot, and SEO scripts.
 * Category_ID values match NocoDB Number field Category_ID.
 */
export const CATEGORY_BY_ID = {
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

export const CATEGORY_ID_BY_NAME = Object.fromEntries(
    Object.entries(CATEGORY_BY_ID).map(([id, name]) => [name, Number(id)])
);

/** Arabic labels shown in the storefront rail and filters */
export const CATEGORY_LABEL_AR = {
    All: 'الكل',
    Chargers: 'شواحن جوال',
    Audio: 'سماعات',
    'Smart Watches': 'ساعات ذكية',
    Gaming: 'ألعاب',
    'Mouse & Keyboard': 'ماوس وكيبورد',
    Storage: 'تخزين',
    'Laptop Chargers': 'شواحن حواسيب',
    Stands: 'حوامل',
    Lighting: 'إضاءة',
    Cameras: 'كاميرات',
    Network: 'شبكات',
    Microphones: 'ميكروفونات',
    'Batteries & Power Banks': 'بطاريات وباوربانك',
    Cables: 'كابلات',
    'Car Accessories': 'إكسسوارات السيارة',
    'Adapters & Hubs': 'محولات وHUB',
    'TV Boxes': 'أجهزة بث',
    Cooling: 'تبريد',
    Phones: 'هواتف',
    General: 'أخرى',
    'Out of Stock': 'نفد من المخزون',
};

/** Short Arabic labels (SEO / legacy) */
export const CATEGORY_LABEL_AR_SHORT = {
    1: 'شواحن',
    2: 'سماعات',
    3: 'ساعات ذكية',
    4: 'ألعاب',
    5: 'ماوس وكيبورد',
    6: 'تخزين',
    7: 'شواحن حواسيب',
    8: 'ستاندات',
    9: 'إضاءة',
    10: 'كاميرات',
    11: 'شبكات',
    12: 'عام',
    13: 'ميكروفونات',
    14: 'بطاريات',
    15: 'نفد من المخزون',
    16: 'كابلات',
    17: 'إكسسوارات السيارة',
    18: 'محولات وHUB',
    19: 'أجهزة بث',
    20: 'تبريد',
    21: 'هواتف',
};

/** Telegram bot labels with emoji */
export const CATEGORY_LABEL_BOT = {
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
    14: '🔋 بطاريات وباوربانك',
    16: '🔗 كابلات',
    17: '🚗 إكسسوارات السيارة',
    18: '🔌 محولات وHUB',
    19: '📺 أجهزة بث',
    20: '❄️ تبريد',
    21: '📱 هواتف',
};

/** Order shown in the category rail (excludes Out of Stock) */
export const STOREFRONT_CATEGORY_ORDER = [
    'All',
    'Chargers',
    'Audio',
    'Smart Watches',
    'Gaming',
    'Mouse & Keyboard',
    'Storage',
    'Laptop Chargers',
    'Stands',
    'Lighting',
    'Cameras',
    'Network',
    'Microphones',
    'Batteries & Power Banks',
    'Cables',
    'Car Accessories',
    'Adapters & Hubs',
    'TV Boxes',
    'Cooling',
    'Phones',
    'General',
    'Out of Stock',
];

export const getCategoryName = (id) => CATEGORY_BY_ID[id] || 'General';

/** Local Template-2 category artwork under /public/category-images */
export const LOCAL_CATEGORY_IMAGES = {
    Chargers: '/category-images/chargers.png',
    Audio: '/category-images/audio.png',
    'Smart Watches': '/category-images/smart-watches.png',
    Gaming: '/category-images/gaming.png',
    'Mouse & Keyboard': '/category-images/mouse-keyboard.png',
    Storage: '/category-images/storage.png',
    'Laptop Chargers': '/category-images/laptop-chargers.png',
    Stands: '/category-images/stands.png',
    Lighting: '/category-images/lighting.png',
    Cameras: '/category-images/cameras.png',
    Network: '/category-images/network.png',
    Microphones: '/category-images/microphones.png',
    'Batteries & Power Banks': '/category-images/batteries-power-banks.png',
    Cables: '/category-images/cables.png',
    'Car Accessories': '/category-images/car-accessories.png',
    'Adapters & Hubs': '/category-images/adapters-hubs.png',
    'TV Boxes': '/category-images/tv-boxes.png',
    Cooling: '/category-images/cooling.png',
    Phones: '/category-images/phones.png',
    General: '/category-images/general.png',
};

export const getCategoryImage = (categoryName, remoteMap = {}) =>
    remoteMap?.[categoryName] || LOCAL_CATEGORY_IMAGES[categoryName] || null;
