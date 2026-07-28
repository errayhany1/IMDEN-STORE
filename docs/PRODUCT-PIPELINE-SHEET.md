# جدول المنتجات (N8N AI1) + بوت الذكاء الاصطناعي

Sheet: https://docs.google.com/spreadsheets/d/1zuRmrjaMjTsvN7j822b5w6v3NR3Dh_TclhFyFKXx5h4

## تدفق البوت (بدون N8N)

Telegram (+ رابط أمازون اختياري) → Apify scrape → OpenAI نصوص → OpenRouter صور AI → NocoDB → Sheet webhook → رابط `/p/ERY-...`

ترتيب الصور: AI (`ai-…`) → Amazon (`amazon-…`) → الصورة الحقيقية آخر عنصر دائماً (`real-…`)

## Env على EasyPanel → imden-bot

**مهم (إصلاح tar/EOF):** اضبط Root Directory = `bot` و Dockerfile = `bot/Dockerfile`
حتى لا يفشل تنزيل أرشيف المستودع الكبير. انظر `bot/README.md`.

```env
TELEGRAM_BOT_TOKEN=
VITE_NOCODB_URL=
VITE_NOCODB_API_TOKEN=
VITE_NOCODB_TABLE_PRODUCTS=
OPENROUTER_API_KEY=sk-or-v1-...
OPENAI_API_KEY=
APIFY_TOKEN=
APIFY_AMAZON_ACT=junglee~free-amazon-product-scraper
PRODUCT_AI_ENRICHMENT=true
PRODUCT_SHEET_ID=1zuRmrjaMjTsvN7j822b5w6v3NR3Dh_TclhFyFKXx5h4
PRODUCT_SHEET_WEBHOOK_URL=
PUBLIC_SITE_URL=https://errayhany.com
# اختياري: اتركه فارغاً لاستخدام long-polling (أثبت عند توقف الردود)
# TELEGRAM_MODE=polling
# TELEGRAM_WEBHOOK_URL=https://YOUR-BOT-HOST
```

بعد إضافة `APIFY_TOKEN` / `OPENAI_API_KEY`: Rebuild لـ `imden-bot` على EasyPanel. أعد إنشاء أي توكن Apify ظهر في ملفات JSON.

للتفعيل Sheet: انشر `docs/sheets-webhook.gs` كـ Web App والصق الرابط في `PRODUCT_SHEET_WEBHOOK_URL`.

بعد اكتمال توليد AI يُضاف الصف تلقائياً إلى:
- **Sheet1** (أرشيف داخلي)
- **Upload Template** (الصيغة التي يقبلها Jumia)
- **Jumia PIM API** مباشرة (`POST /api/product-set`) إن وُجدت مفاتيح Jumia على `imden-bot`

القيم الافتراضية (من ملف N8N AI1 الناجح):

```env
JUMIA_DEFAULT_BRAND=1045133 - Generic
JUMIA_DEFAULT_CATEGORY=1000040 - Electronics / Accessories / Gadgets
JUMIA_CLIENT_ID=
JUMIA_REFRESH_TOKEN=
JUMIA_SHOP_ID=a74ac8a0-03f7-490b-8e45-cf9433b75d2c
```

> ملاحظة: Refresh Token يتغيّر عند التجديد. لا تستخدم نفس التطبيق على `imden` (طلبات) و`imden-bot` (منتجات) معاً — أنشئ تطبيق Self Auth ثانٍ للمنتجات.

## الموديلات

- نص: `google/gemini-2.5-flash`
- صور: `google/gemini-2.5-flash-image`
