/**
 * Product family taxonomy for the storefront hero slider.
 * Categories use the same English keys as Category_ID mapping in api.js.
 */
export const productFamilies = [
    {
        id: 'power',
        nameAr: 'طاقة وشواحن',
        nameEn: 'Power & Chargers',
        taglineAr: 'كل ما تحتاجه للطاقة والشحن',
        banner: '/banners/family-power.jpg',
        accent: '#156cb8',
        categories: ['Chargers', 'Laptop Chargers', 'Batteries & Power Banks'],
    },
    {
        id: 'audio',
        nameAr: 'صوت وترفيه',
        nameEn: 'Sound & Entertainment',
        taglineAr: 'استمتع بأفضل صوت وألعاب',
        banner: '/banners/family-audio.jpg',
        accent: '#7c3aed',
        categories: ['Audio', 'Microphones', 'Gaming'],
    },
    {
        id: 'devices',
        nameAr: 'أجهزة وإكسسوارات',
        nameEn: 'Devices & Accessories',
        taglineAr: 'كل ما تحتاجه لتجهيز أجهزتك',
        banner: '/banners/family-devices.jpg',
        accent: '#197fe6',
        categories: [
            'Smart Watches',
            'Mouse & Keyboard',
            'Storage',
            'Cameras',
            'Network',
            'Lighting',
            'Stands',
        ],
    },
];

export const getFamilyById = (id) =>
    productFamilies.find((family) => family.id === id) || null;

export const getFamilyForCategory = (category) =>
    productFamilies.find((family) => family.categories.includes(category)) || null;
