import { frenchProductTitle } from './productText';
import {
    Battery,
    Crosshair,
    Palette,
    Sparkles,
    Wifi,
} from 'lucide-react';

export function productDiscount(product) {
    const price = Number(product?.price) || 0;
    const oldPrice = Number(
        product?.originalData?.old_price
        || product?.originalData?.Old_Price
        || product?.oldPrice
        || 0,
    );
    if (!(oldPrice > price) || price <= 0) {
        return { price, oldPrice: 0, percent: 0 };
    }
    return {
        price,
        oldPrice,
        percent: Math.max(1, Math.round((1 - price / oldPrice) * 100)),
    };
}

export function productBrand(product) {
    const od = product?.originalData || {};
    return String(od.brand || od.Brand || od.Marque || '').trim();
}

const CATEGORY_CHIP = {
    Chargers: { icon: 'battery', fr: 'Chargeurs', ar: 'شواحن جوال' },
    Audio: { icon: 'headphones', fr: 'Audio', ar: 'سماعات' },
    'Smart Watches': { icon: 'watch', fr: 'Montres', ar: 'ساعات ذكية' },
    Gaming: { icon: 'gamepad', fr: 'Gaming', ar: 'ألعاب' },
    'Mouse & Keyboard': { icon: 'mouse', fr: 'Souris & Clavier', ar: 'ماوس وكيبورد' },
    Storage: { icon: 'storage', fr: 'Stockage', ar: 'تخزين' },
    'Laptop Chargers': { icon: 'battery', fr: 'Chargeurs PC', ar: 'شواحن حواسيب' },
    Stands: { icon: 'stand', fr: 'Supports', ar: 'حوامل' },
    Lighting: { icon: 'light', fr: 'Éclairage', ar: 'إضاءة' },
    Cameras: { icon: 'camera', fr: 'Caméras', ar: 'كاميرات' },
    Network: { icon: 'wifi', fr: 'Réseaux', ar: 'شبكات' },
    Microphones: { icon: 'mic', fr: 'Micros', ar: 'ميكروفونات' },
    'Batteries & Power Banks': { icon: 'battery', fr: 'Batteries', ar: 'بطاريات' },
    Cables: { icon: 'cable', fr: 'Câbles', ar: 'كابلات' },
    'Car Accessories': { icon: 'car', fr: 'Auto', ar: 'إكسسوارات السيارة' },
    'Adapters & Hubs': { icon: 'hub', fr: 'Hubs', ar: 'محولات' },
    'TV Boxes': { icon: 'tv', fr: 'TV Box', ar: 'أجهزة بث' },
    Cooling: { icon: 'fan', fr: 'Refroidissement', ar: 'تبريد' },
    Phones: { icon: 'phone', fr: 'Téléphones', ar: 'هواتف' },
    General: { icon: 'tag', fr: 'Accessoires', ar: 'أخرى' },
};

const TYPE_RULES = [
    { re: /souris|mouse|ماوس/i, icon: 'mouse', fr: 'Souris', ar: 'ماوس', gamingFr: 'Souris Gaming', gamingAr: 'ماوس ألعاب' },
    { re: /casque|headset|headphone|écouteur|ecouteur|سماعة/i, icon: 'headphones', fr: 'Casque', ar: 'سماعة', gamingFr: 'Casque Gaming', gamingAr: 'سماعة ألعاب' },
    { re: /clavier|keyboard|كيبورد/i, icon: 'keyboard', fr: 'Clavier', ar: 'كيبورد', gamingFr: 'Clavier Gaming', gamingAr: 'كيبورد ألعاب' },
    { re: /cooler|cooling|مبرد|مروحة|ventilateur|refroidiss/i, icon: 'fan', fr: 'Refroidissement', ar: 'تبريد' },
];

export function productTypeChip(product, isFr = false) {
    const od = product?.originalData || {};
    const hay = [
        frenchProductTitle(product),
        product?.name,
        product?.ref,
        od.French_Title,
        od.Woo_Title,
        od.Arabic_Title,
        od.Title,
    ].filter(Boolean).join(' ');
    const gaming = /gaming|attaque|attack|ألعاب|tri-?mode/i.test(hay)
        || product?.category === 'Gaming';

    for (const rule of TYPE_RULES) {
        if (!rule.re.test(hay)) continue;
        const label = gaming && rule.gamingFr
            ? (isFr ? rule.gamingFr : rule.gamingAr)
            : (isFr ? rule.fr : rule.ar);
        return { icon: rule.icon, label };
    }

    const cat = product?.baseCategory && product.baseCategory !== 'Out of Stock'
        ? product.baseCategory
        : product?.category;
    const fallback = CATEGORY_CHIP[cat] || CATEGORY_CHIP.General;
    return { icon: fallback.icon, label: isFr ? fallback.fr : fallback.ar };
}

const FEATURE_RULES = [
    {
        re: /sans[\s-]?fil|wireless|bluetooth|wifi|لاسلك|بلوتوث/i,
        icon: Wifi,
        fr: 'Sans fil / Filaire',
        ar: 'لاسلكي / سلكي',
    },
    {
        re: /souris|mouse|ماوس|clavier|keyboard|كيبورد|gaming|ألعاب|attaque|attack/i,
        icon: Crosshair,
        fr: 'Haute précision',
        ar: 'دقة عالية',
    },
    {
        re: /rgb|eclairage|éclairage|led|إضاءة/i,
        icon: Palette,
        fr: 'Éclairage RGB',
        ar: 'إضاءة RGB',
    },
    {
        re: /batterie|autonomie|battery|بطارية/i,
        icon: Battery,
        fr: 'Longue autonomie',
        ar: 'بطارية تدوم',
    },
];

export function productFeatureChips(text, isFr, fallbackBullets = [], category = '') {
    const hay = `${text || ''} ${category || ''}`;
    const found = FEATURE_RULES.filter((rule) => rule.re.test(hay)).map((rule) => ({
        icon: rule.icon,
        label: isFr ? rule.fr : rule.ar,
    }));
    if (found.length) return found.slice(0, 4);
    return fallbackBullets.slice(0, 4).map((label) => ({
        icon: Sparkles,
        label: String(label).slice(0, 32),
    }));
}
