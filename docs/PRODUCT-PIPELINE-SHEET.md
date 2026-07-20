# جدول المنتجات (N8N AI1) + بوت الذكاء الاصطناعي

Sheet: https://docs.google.com/spreadsheets/d/1zuRmrjaMjTsvN7j822b5w6v3NR3Dh_TclhFyFKXx5h4

## تدفق البوت (بدون N8N)

Telegram → OpenRouter (نصوص AR/FR + 4 صور) → NocoDB → Sheet webhook → رابط `/p/ERY-...`

ترتيب الصور: Image1 نظيفة · Image2–4 عروض · Image5 الصورة الحقيقية

## Env على EasyPanel → imden-bot

**مهم (إصلاح tar/EOF):** اضبط Root Directory = `bot` و Dockerfile = `bot/Dockerfile`
حتى لا يفشل تنزيل أرشيف المستودع الكبير. انظر `bot/README.md`.

```env
TELEGRAM_BOT_TOKEN=
VITE_NOCODB_URL=
VITE_NOCODB_API_TOKEN=
VITE_NOCODB_TABLE_PRODUCTS=
OPENROUTER_API_KEY=sk-or-v1-...
PRODUCT_AI_ENRICHMENT=true
PRODUCT_SHEET_ID=1zuRmrjaMjTsvN7j822b5w6v3NR3Dh_TclhFyFKXx5h4
PRODUCT_SHEET_WEBHOOK_URL=
PUBLIC_SITE_URL=https://errayhany.com
```

للتفعيل Sheet: انشر `docs/sheets-webhook.gs` كـ Web App والصق الرابط في `PRODUCT_SHEET_WEBHOOK_URL`.

## الموديلات

- نص: `google/gemini-2.5-flash`
- صور: `google/gemini-3.1-flash-image` (أو `OPENROUTER_IMAGE_MODEL`)
