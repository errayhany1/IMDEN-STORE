import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// NocoDB Config
const API_URL = 'https://app.nocodb.com';
const API_TOKEN = 'cS08dEn6AOnGAyJKONkV_iX58WCeNN8YFDgAzVg1';
const TABLE_ID = 'mpdn1jwettle7mj';
const SITE_URL = 'https://imdenmanadger.online';

const categoryMapping = {
    1: 'شواحن', 2: 'سماعات', 3: 'ساعات ذكية', 4: 'ألعاب',
    5: 'ماوس وكيبورد', 6: 'تخزين', 7: 'شواحن حواسيب', 8: 'ستاندات',
    9: 'إضاءة', 10: 'كاميرات', 11: 'شبكات', 12: 'عام',
    13: 'ميكروفونات', 14: 'بطاريات', 15: 'نفد من المخزون'
};

async function fetchAllProducts() {
    let all = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        try {
            const res = await axios.get(`${API_URL}/api/v2/tables/${TABLE_ID}/records`, {
                headers: { 'xc-token': API_TOKEN },
                params: { limit: 200, offset, sort: '-Id' }
            });
            const list = res.data.list || [];
            const visible = list.filter(r => r.POSTEBL === 'POSTEBL');
            all = [...all, ...visible];
            if (list.length < 200) hasMore = false;
            else offset += 200;
        } catch (e) {
            console.error('Error fetching products:', e.message);
            hasMore = false;
        }
    }
    return all;
}

function getImageUrl(record) {
    const img = record.Image1 && record.Image1[0];
    if (!img) return null;
    const url = img.signedUrl || img.url;
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_URL}/${url}`;
}

function escapeXml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

async function generate() {
    console.log('🔍 Fetching products from NocoDB...');
    const products = await fetchAllProducts();
    console.log(`✅ Found ${products.length} products`);

    // ── 1. Generate sitemap.xml with image tags ──
    const today = new Date().toISOString().split('T')[0];
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <image:image>
      <image:loc>${SITE_URL}/logo-512.png</image:loc>
      <image:title>IMDEN TECHNOLOGY - متجر بيع الإلكترونيات بالجملة</image:title>
    </image:image>
`;

    // Add product images to the main URL sitemap entry
    let imageCount = 0;
    products.forEach(p => {
        const imgUrl = getImageUrl(p);
        if (imgUrl && imageCount < 1000) { // Google supports up to 1000 images per URL
            const title = escapeXml(p.Title || p.SKU || '');
            const caption = escapeXml(`${p.Title || ''} - ${p.SKU || ''} - ${p.price || ''} DH - IMDEN TECHNOLOGY`);
            sitemap += `    <image:image>
      <image:loc>${escapeXml(imgUrl)}</image:loc>
      <image:title>${title}</image:title>
      <image:caption>${caption}</image:caption>
    </image:image>
`;
            imageCount++;
        }
    });

    sitemap += `  </url>
</urlset>`;

    fs.writeFileSync(path.join(__dirname, 'public', 'sitemap.xml'), sitemap);
    console.log(`📄 sitemap.xml generated with ${imageCount} product images`);

    // ── 2. Generate JSON-LD Product data for index.html injection ──
    const productJsonLd = products.slice(0, 100).map(p => {
        const imgUrl = getImageUrl(p);
        const catId = p.Category_ID || p.category_id || 12;
        return {
            "@type": "Product",
            "name": p.Title || p.SKU || 'منتج',
            "image": imgUrl || `${SITE_URL}/logo-512.png`,
            "description": `${p.Title || ''} - ${categoryMapping[catId] || 'إلكترونيات'} بالجملة من IMDEN TECHNOLOGY`,
            "sku": p.SKU || '',
            "brand": { "@type": "Brand", "name": "IMDEN TECHNOLOGY" },
            "offers": {
                "@type": "Offer",
                "price": p.price || 0,
                "priceCurrency": "MAD",
                "availability": "https://schema.org/InStock",
                "seller": { "@type": "Organization", "name": "IMDEN TECHNOLOGY" }
            }
        };
    });

    const jsonLdFile = JSON.stringify(productJsonLd, null, 2);
    fs.writeFileSync(path.join(__dirname, 'public', 'products-jsonld.json'), jsonLdFile);
    console.log(`🏷️  products-jsonld.json generated with ${productJsonLd.length} products`);

    // ── 3. Generate static HTML for crawlers (noscript / SEO fallback) ──
    let seoHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>منتجات IMDEN TECHNOLOGY - إلكترونيات بالجملة</title>
  <meta name="description" content="تصفح جميع منتجات IMDEN TECHNOLOGY - إلكترونيات بالجملة في المغرب: شواحن، سماعات، كاميرات، إضاءة، والمزيد">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${SITE_URL}/products">
  <style>body{font-family:sans-serif;direction:rtl;padding:20px;background:#f8fafc}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
  .card{background:#fff;border-radius:12px;padding:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1)}
  .card img{width:100%;height:200px;object-fit:contain;border-radius:8px}
  .name{font-weight:bold;margin:8px 0 4px;font-size:14px}
  .price{color:#16a34a;font-weight:bold}
  .ref{color:#94a3b8;font-size:12px}</style>
</head>
<body>
  <h1>منتجات IMDEN TECHNOLOGY - إلكترونيات بالجملة</h1>
  <p>أفضل متجر لبيع المنتجات الإلكترونية بالجملة في المغرب. اكتشف ${products.length} منتج بأسعار الجملة.</p>
  <div class="grid">
`;

    products.forEach(p => {
        const imgUrl = getImageUrl(p);
        const title = (p.Title || p.SKU || 'منتج').replace(/"/g, '&quot;');
        const catId = p.Category_ID || 12;
        const catName = categoryMapping[catId] || 'إلكترونيات';
        seoHtml += `    <div class="card" itemscope itemtype="https://schema.org/Product">
      ${imgUrl ? `<img src="${imgUrl}" alt="${title} - ${catName} بالجملة IMDEN" itemprop="image" loading="lazy" width="200" height="200">` : ''}
      <div class="name" itemprop="name">${title}</div>
      <div class="ref">REF: ${p.SKU || ''}</div>
      <div class="price" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
        <span itemprop="price">${p.price || 0}</span> <span itemprop="priceCurrency">MAD</span>
      </div>
    </div>
`;
    });

    seoHtml += `  </div>
  <p><a href="${SITE_URL}/">العودة إلى المتجر الرئيسي</a></p>
</body>
</html>`;

    fs.writeFileSync(path.join(__dirname, 'public', 'products.html'), seoHtml);
    console.log(`🌐 products.html generated (static SEO page with ${products.length} products + images)`);

    console.log('\n🎉 SEO generation complete!');
}

generate().catch(console.error);
