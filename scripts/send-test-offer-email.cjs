/**
 * Send a one-off test offer email via Brevo transactional API.
 * Includes product images + links from public/products-jsonld.json.
 *
 * Usage:
 *   node scripts/send-test-offer-email.cjs [to@email.com]
 *
 * Or add BREVO_API_KEY to .env
 */
require('dotenv').config({ quiet: true, override: true });
const fs = require('fs');
const path = require('path');
const https = require('https');

const TO = process.argv[2] || 'errayhany.com@gmail.com';
const API_KEY = process.env.BREVO_API_KEY || process.env.SIB_API_KEY;
const ROOT = path.join(__dirname, '..');
const SITE = 'https://errayhany.com';
const PHONE_DISPLAY = '+212 664-630566';
const WA = 'https://wa.me/212664630566';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pickProducts(limit = 6) {
  const all = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'public', 'products-jsonld.json'), 'utf8')
  );
  return all
    .filter((p) => p.image && p.offers?.url && p.offers?.price != null)
    .slice(0, limit);
}

function productCell(p) {
  if (!p) {
    return '<td width="50%" style="padding:8px;"></td>';
  }
  return `
    <td width="50%" valign="top" style="padding:8px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
        <tr>
          <td style="padding:14px 14px 0;text-align:center;background:#f8fafc;">
            <a href="${esc(p.offers.url)}" style="text-decoration:none;">
              <img src="${esc(p.image)}" alt="${esc(p.name)}" width="200"
                style="display:block;margin:0 auto;width:100%;max-width:200px;height:auto;border:0;" />
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 14px 16px;text-align:center;">
            <a href="${esc(p.offers.url)}" style="text-decoration:none;color:#0b2a5b;">
              <div style="font-size:13px;font-weight:700;line-height:1.45;min-height:38px;">${esc(p.name)}</div>
              <div style="margin:8px 0 12px;font-size:18px;font-weight:800;color:#0b2a5b;">${esc(p.offers.price)} درهم</div>
            </a>
            <a href="${esc(p.offers.url)}" style="display:inline-block;background:#0b2a5b;color:#ffffff;text-decoration:none;font-size:12px;font-weight:700;padding:10px 14px;border-radius:8px;">
              عرض المنتج 🛒
            </a>
          </td>
        </tr>
      </table>
    </td>`;
}

function trustCell(emoji, title, sub) {
  return `
    <td width="25%" valign="top" style="padding:6px;text-align:center;">
      <div style="font-size:22px;line-height:1;">${emoji}</div>
      <div style="margin-top:8px;font-size:12px;font-weight:800;color:#0b2a5b;line-height:1.35;">${title}</div>
      <div style="margin-top:2px;font-size:11px;color:#64748b;line-height:1.35;">${sub}</div>
    </td>`;
}

function buildHtml(products, { greetingHtml } = {}) {
  const rows = [];
  for (let i = 0; i < products.length; i += 2) {
    rows.push(`<tr>${productCell(products[i])}${productCell(products[i + 1])}</tr>`);
  }

  const greeting = greetingHtml
    || 'مرحباً، هذه رسالة تجريبية تضم منتجات حقيقية من الكتالوج.';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>عروض Errayhany Store</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Tahoma,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f7;padding:20px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dbe3ef;">

          <!-- Header -->
          <tr>
            <td style="background:#0b2a5b;padding:18px 22px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="right" valign="middle">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td valign="middle" style="padding-left:12px;">
                          <img src="${SITE}/logo-email-avatar.png" alt="Errayhany" width="44" height="44"
                            style="display:block;width:44px;height:44px;border-radius:50%;border:2px solid rgba(255,255,255,0.35);background:#ffffff;object-fit:cover;" />
                        </td>
                        <td valign="middle" style="text-align:right;">
                          <div style="font-size:18px;font-weight:800;color:#ffffff;line-height:1.2;">Errayhany Store</div>
                          <div style="margin-top:3px;font-size:12px;color:#b7c7e3;">جملة الإلكترونيات والإكسسوارات</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="left" valign="middle" style="text-align:left;">
                    <div style="font-size:18px;line-height:1;">🛍️</div>
                    <div style="margin-top:4px;font-size:11px;color:#d7e3f7;font-weight:700;line-height:1.35;">أفضل المنتجات<br/>بأفضل الأسعار</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="background:linear-gradient(180deg,#e8f1ff 0%,#ffffff 100%);padding:28px 22px 18px;text-align:center;">
              <div style="display:inline-block;background:#d9e8ff;color:#0b2a5b;font-size:12px;font-weight:800;padding:7px 14px;border-radius:999px;margin-bottom:14px;">
                ٪ عروض حصرية
              </div>
              <h1 style="margin:0 0 10px;font-size:26px;line-height:1.35;color:#0b2a5b;font-weight:800;">
                منتجات مختارة من الكتالوج
              </h1>
              <p style="margin:0 auto 18px;max-width:420px;font-size:14px;line-height:1.8;color:#475569;">
                ${greeting}
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" align="center">
                <tr>
                  <td style="background:#0b2a5b;border-radius:10px;">
                    <a href="${SITE}" style="display:inline-block;padding:13px 22px;font-size:14px;font-weight:800;color:#ffffff;text-decoration:none;">
                      تصفح الكتالوج كاملاً ←
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Products -->
          <tr>
            <td style="padding:8px 14px 6px;background:#ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                ${rows.join('\n')}
              </table>
            </td>
          </tr>

          <!-- Trust row -->
          <tr>
            <td style="padding:10px 14px 6px;background:#ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f8fc;border-radius:14px;">
                <tr>
                  ${trustCell('🛡️', 'منتجات أصلية', 'جودة مضمونة')}
                  ${trustCell('🚚', 'توصيل سريع', 'لكافة المدن')}
                  ${trustCell('💵', 'الدفع عند الاستلام', 'ادفع عند وصول الطلب')}
                  ${trustCell('🎧', 'خدمة عملاء', 'دعم سريع')}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Secondary CTA -->
          <tr>
            <td style="padding:18px 22px 24px;text-align:center;background:#ffffff;">
              <table role="presentation" cellspacing="0" cellpadding="0" align="center" width="100%">
                <tr>
                  <td style="background:#0b2a5b;border-radius:12px;text-align:center;">
                    <a href="${SITE}" style="display:block;padding:15px 22px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;">
                      تصفح الكتالوج كاملاً ←
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0b2a5b;padding:22px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="right" valign="top" style="color:#d7e3f7;font-size:13px;line-height:1.8;">
                    <div style="font-weight:700;color:#ffffff;margin-bottom:6px;">تواصل معنا</div>
                    <div>📞 <a href="tel:+212664630566" style="color:#d7e3f7;text-decoration:none;">${PHONE_DISPLAY}</a></div>
                    <div>✉️ <a href="mailto:contact@errayhany.com" style="color:#d7e3f7;text-decoration:none;">contact@errayhany.com</a></div>
                  </td>
                  <td align="left" valign="top" style="text-align:left;color:#d7e3f7;font-size:13px;">
                    <div style="font-weight:700;color:#ffffff;margin-bottom:8px;">تابعنا على</div>
                    <a href="${WA}" style="display:inline-block;margin-left:8px;background:#ffffff;color:#0b2a5b;text-decoration:none;font-size:12px;font-weight:800;padding:8px 10px;border-radius:8px;">WhatsApp</a>
                    <a href="${SITE}" style="display:inline-block;background:rgba(255,255,255,0.12);color:#ffffff;text-decoration:none;font-size:12px;font-weight:800;padding:8px 10px;border-radius:8px;">الموقع</a>
                  </td>
                </tr>
              </table>
              <div style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.15);text-align:center;font-size:11px;color:#9db0d1;line-height:1.6;">
                Errayhany Store — الدار البيضاء، المغرب
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function postJson(pathname, body) {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.brevo.com',
        path: pathname,
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'api-key': API_KEY,
          'content-length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let parsed = data;
          try {
            parsed = JSON.parse(data);
          } catch (_) {}
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  const products = pickProducts(6);
  const campaignGreeting =
    'مرحباً {{ contact.FIRSTNAME | default: "عزيزي الزبون" }}، جهّزنا لك منتجات مختارة بأسعار الجملة. اضغط على أي منتج لفتحه في الموقع.';
  const testGreeting =
    'مرحباً، هذه رسالة تجريبية تضم منتجات حقيقية من الكتالوج. اضغط على أي منتج لفتحه في الموقع.';

  const htmlTest = buildHtml(products, { greetingHtml: testGreeting });
  const htmlCampaign = buildHtml(products, { greetingHtml: campaignGreeting });

  fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'tmp', 'test-offer-with-products.html'), htmlTest, 'utf8');
  fs.writeFileSync(
    path.join(ROOT, 'docs', 'templates', 'offer-campaign.html'),
    htmlCampaign,
    'utf8'
  );

  console.log('Products:');
  for (const p of products) {
    console.log(` - ${p.name} (${p.offers.price} MAD)`);
  }
  console.log('HTML written to tmp/test-offer-with-products.html and docs/templates/offer-campaign.html');

  if (!API_KEY) {
    console.error('MISSING_API_KEY');
    process.exit(2);
  }

  const result = await postJson('/v3/smtp/email', {
    sender: { name: 'Errayhany Store', email: 'offers@errayhany.com' },
    to: [{ email: TO, name: 'Test' }],
    subject: 'عروض حصرية — منتجات مختارة من Errayhany Store',
    htmlContent: htmlTest,
  });

  console.log('STATUS', result.status);
  console.log('BODY', JSON.stringify(result.body));
  if (result.status < 200 || result.status >= 300) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
