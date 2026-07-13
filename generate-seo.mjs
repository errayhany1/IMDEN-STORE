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
const BRAND = 'Errayhany Grossiste';
const BRAND_SHORT = 'Errayhany Store';

const categoryMapping = {
    1: 'شواحن', 2: 'سماعات', 3: 'ساعات ذكية', 4: 'ألعاب',
    5: 'ماوس وكيبورد', 6: 'تخزين', 7: 'شواحن حواسيب', 8: 'ستاندات',
    9: 'إضاءة', 10: 'كاميرات', 11: 'شبكات', 12: 'عام',
    13: 'ميكروفونات', 14: 'بطاريات', 15: 'نفد من المخزون'
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getWithRetry(url, config, maxRetries = 3) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await axios.get(url, config);
        } catch (err) {
            const isRateLimit = err.response && err.response.status === 429;
            if (isRateLimit && attempt < maxRetries) {
                const waitTime = Math.pow(2, attempt + 1) * 1000;
                console.warn(`[SEO Gen] Rate limited (429). Retrying in ${waitTime / 1000}s...`);
                await delay(waitTime);
            } else {
                throw err;
            }
        }
    }
}

async function fetchAllProducts() {
    let all = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        try {
            const res = await getWithRetry(`${API_URL}/api/v2/tables/${TABLE_ID}/records`, {
                headers: { 'xc-token': API_TOKEN },
                params: { limit: 100, offset, sort: '-Id' }
            });
            const list = res.data.list || [];
            const visible = list.filter(r => r.POSTEBL === 'POSTEBL');
            all = [...all, ...visible];
            if (list.length < 100) {
                hasMore = false;
            } else {
                offset += 100;
                await delay(300);
            }
        } catch (e) {
            console.error('Error fetching products:', e.message);
            hasMore = false;
        }
    }
    return all;
}

/**
 * Prefer permanent `url` over short-lived `signedUrl` so Google Image Search
 * and sitemap crawlers do not hit expired links.
 */
function getImageUrl(record) {
    const img = record.Image1 && record.Image1[0];
    if (!img) return null;
    const url = img.url || img.signedUrl;
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

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function generate() {
    console.log('🔍 Fetching products from NocoDB...');
    const products = await fetchAllProducts();
    console.log(`✅ Found ${products.length} products`);

    const today = new Date().toISOString().split('T')[0];

    // ── 1. sitemap.xml (pages + image sitemap) ──
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
      <image:title>${escapeXml(BRAND)} - إلكترونيات وإكسسوارات هواتف بالجملة المغرب</image:title>
      <image:caption>${escapeXml(`${BRAND} / ${BRAND_SHORT} - Wholesale electronics Casablanca Morocco`)}</image:caption>
    </image:image>
    <image:image>
      <image:loc>${SITE_URL}/logo.png</image:loc>
      <image:title>${escapeXml(BRAND_SHORT)} logo</image:title>
    </image:image>
    <image:image>
      <image:loc>${SITE_URL}/logo-dark.png</image:loc>
      <image:title>${escapeXml(BRAND)} dark logo</image:title>
    </image:image>
`;

    let imageCount = 3;
    products.forEach(p => {
        const imgUrl = getImageUrl(p);
        if (imgUrl && imageCount < 1000) {
            const title = escapeXml(p.Title || p.SKU || '');
            const catId = p.Category_ID || p.category_id || 12;
            const catName = categoryMapping[catId] || 'إلكترونيات';
            const caption = escapeXml(
                `${p.Title || ''} - ${p.SKU || ''} - ${p.price || ''} DH - ${catName} بالجملة - ${BRAND} الدار البيضاء المغرب`
            );
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
  <url>
    <loc>${SITE_URL}/products.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${SITE_URL}/privacy-policy.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${SITE_URL}/llms.txt</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>`;

    fs.writeFileSync(path.join(__dirname, 'public', 'sitemap.xml'), sitemap);
    console.log(`📄 sitemap.xml generated with ${imageCount} images`);

    // ── 2. products-jsonld.json ──
    const productJsonLd = products.slice(0, 100).map(p => {
        const imgUrl = getImageUrl(p);
        const catId = p.Category_ID || p.category_id || 12;
        const catName = categoryMapping[catId] || 'إلكترونيات';
        return {
            "@type": "Product",
            "name": p.Title || p.SKU || 'منتج',
            "image": imgUrl || `${SITE_URL}/logo-512.png`,
            "description": `${p.Title || ''} - ${catName} بالجملة من ${BRAND} في الدار البيضاء والمغرب`,
            "sku": p.SKU || '',
            "category": catName,
            "brand": { "@type": "Brand", "name": BRAND_SHORT },
            "offers": {
                "@type": "Offer",
                "url": `${SITE_URL}/?search=${encodeURIComponent(p.SKU || p.Title || '')}`,
                "price": p.price || 0,
                "priceCurrency": "MAD",
                "availability": "https://schema.org/InStock",
                "itemCondition": "https://schema.org/NewCondition",
                "seller": {
                    "@type": "Organization",
                    "name": BRAND,
                    "url": SITE_URL
                }
            }
        };
    });

    fs.writeFileSync(
        path.join(__dirname, 'public', 'products-jsonld.json'),
        JSON.stringify(productJsonLd, null, 2)
    );
    console.log(`🏷️  products-jsonld.json generated with ${productJsonLd.length} products`);

    // ── 3. Static products.html for crawlers / AI / image SEO ──
    let seoHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>منتجات ${escapeHtml(BRAND)} - إلكترونيات وإكسسوارات هواتف بالجملة المغرب</title>
  <meta name="description" content="تصفح ${products.length} منتج من ${escapeHtml(BRAND_SHORT)}: شواحن، سماعات، ساعات ذكية، باوربانك، كاميرات، إضاءة وشبكات بأسعار الجملة في الدار البيضاء والمغرب.">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="keywords" content="إلكترونيات بالجملة, إكسسوارات هواتف, ${escapeHtml(BRAND)}, Casablanca, Maroc, gros électronique">
  <link rel="canonical" href="${SITE_URL}/products.html">
  <meta property="og:title" content="كتالوج منتجات ${escapeHtml(BRAND)}">
  <meta property="og:url" content="${SITE_URL}/products.html">
  <meta property="og:image" content="${SITE_URL}/logo-512.png">
  <link rel="llms-txt" href="/llms.txt">
  <script type="application/ld+json">
  ${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": `كتالوج منتجات ${BRAND}`,
        "url": `${SITE_URL}/products.html`,
        "isPartOf": { "@id": `${SITE_URL}/#website` },
        "about": { "@id": `${SITE_URL}/#store` },
        "numberOfItems": products.length
    })}
  </script>
  <style>
    body{font-family:system-ui,sans-serif;direction:rtl;padding:20px;background:#f8fafc;color:#0f172a}
    h1{font-size:1.5rem;margin-bottom:8px}
    .intro{color:#475569;margin-bottom:20px;max-width:720px}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
    .card{background:#fff;border-radius:12px;padding:12px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
    .card img{width:100%;height:200px;object-fit:contain;border-radius:8px;background:#f1f5f9}
    .name{font-weight:700;margin:8px 0 4px;font-size:14px}
    .price{color:#16a34a;font-weight:700}
    .ref{color:#94a3b8;font-size:12px}
    .cat{color:#64748b;font-size:12px;margin-top:4px}
    a{color:#1d4ed8}
  </style>
</head>
<body>
  <h1>منتجات ${escapeHtml(BRAND)} - إلكترونيات بالجملة في المغرب</h1>
  <p class="intro">
    ${escapeHtml(BRAND_SHORT)} / ${escapeHtml(BRAND)} كتالوج جملة للتجار في الدار البيضاء والمغرب.
    شواحن، سماعات، ساعات ذكية، باوربانك، كاميرات، إضاءة، شبكات والمزيد.
    واتساب: <a href="https://wa.me/212664630566">+212 664-630-566</a> ·
    <a href="${SITE_URL}/">المتجر الرئيسي</a> ·
    <a href="${SITE_URL}/llms.txt">llms.txt</a>
  </p>
  <p><strong>${products.length}</strong> منتج متوفر حالياً.</p>
  <div class="grid">
`;

    products.forEach(p => {
        const imgUrl = getImageUrl(p);
        const title = escapeHtml(p.Title || p.SKU || 'منتج');
        const catId = p.Category_ID || p.category_id || 12;
        const catName = categoryMapping[catId] || 'إلكترونيات';
        const alt = escapeHtml(`${p.Title || p.SKU || ''} - ${catName} بالجملة ${BRAND} المغرب`);
        seoHtml += `    <article class="card" itemscope itemtype="https://schema.org/Product">
      ${imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="${alt}" itemprop="image" loading="lazy" width="200" height="200">` : ''}
      <div class="name" itemprop="name">${title}</div>
      <div class="ref">REF: <span itemprop="sku">${escapeHtml(p.SKU || '')}</span></div>
      <div class="cat" itemprop="category">${escapeHtml(catName)}</div>
      <div class="price" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
        <span itemprop="price">${p.price || 0}</span>
        <meta itemprop="priceCurrency" content="MAD"> MAD
        <link itemprop="availability" href="https://schema.org/InStock">
      </div>
      <meta itemprop="brand" content="${escapeHtml(BRAND_SHORT)}">
    </article>
`;
    });

    seoHtml += `  </div>
  <p style="margin-top:24px"><a href="${SITE_URL}/">العودة إلى ${escapeHtml(BRAND_SHORT)}</a></p>
</body>
</html>`;

    fs.writeFileSync(path.join(__dirname, 'public', 'products.html'), seoHtml);
    console.log(`🌐 products.html generated with ${products.length} products`);

    console.log('\n🎉 SEO generation complete!');
}

generate().catch(console.error);
