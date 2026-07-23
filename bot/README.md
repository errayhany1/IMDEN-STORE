# Errayhany / IMDEN Telegram Bot

خدمة مستقلة لرفع المنتجات من تيليجرام → NocoDB (+ AI اختياري).

## تشخيص خطأ 405 على `/webhook` (مهم)

إذا رأيت في EasyPanel Logs:

```text
"POST /webhook HTTP/1.1" 405 150
```

فالخدمة **ليست** بوت Node — بل صورة **nginx للموقع** (الـ Dockerfile الجذري).
حجم الرد `150` هو صفحة nginx الافتراضية `405 Not Allowed`.

### الإصلاح في EasyPanel → `store-app` → `imden-bot` → Source

| الإعداد | القيمة الصحيحة |
|---------|----------------|
| Provider / Repo | `errayhany1/IMDEN-STORE` |
| Branch | `main` |
| **Root Directory** | `bot` |
| **Build method** | **Dockerfile** (ليس Nixpacks) |
| **Dockerfile Path** | `Dockerfile` (داخل مجلد `bot`) |
| Port | `3000` |
| Start Command | **فارغ** (يستخدم `CMD` في Dockerfile) |

ثم اضغط **Deploy** / Rebuild.

بديل من جذر المستودع:

| Root Directory | *(فارغ)* |
| Dockerfile Path | `Dockerfile.bot` |

### تحقق بعد النشر

- Memory يجب أن يصبح تقريباً **40–120 MB** (Node) وليس ~3 MB (nginx)
- `GET /health` يعيد JSON فيه `"service":"imden-bot"`
- في Logs يظهر: `🤖 Errayhany Bot server running` و `📡 Telegram long-polling` أو `🔗 Webhook set`
- أرسل في تيليجرام: `/ping`

## إصلاح فشل EasyPanel (`tar Unexpected EOF`)

الخطأ يحدث لأن أرشيف GitHub كان ثقيلاً. استخدم Root Directory = `bot` حتى يُبنى المجلد الصغير فقط.

## المتغيرات البيئية

```env
TELEGRAM_BOT_TOKEN=
VITE_NOCODB_URL=
VITE_NOCODB_API_TOKEN=
VITE_NOCODB_TABLE_PRODUCTS=
PUBLIC_SITE_URL=https://errayhany.com
OPENROUTER_API_KEY=
OPENAI_API_KEY=
PRODUCT_AI_ENRICHMENT=true
PRODUCT_SHEET_WEBHOOK_URL=
PRODUCT_SHEET_ID=1zuRmrjaMjTsvN7j822b5w6v3NR3Dh_TclhFyFKXx5h4
APIFY_TOKEN=
APIFY_AMAZON_ACT=junglee~free-amazon-product-scraper

# بدون WEBHOOK → long-polling تلقائياً (موصى به)
# TELEGRAM_MODE=polling
# TELEGRAM_WEBHOOK_URL=https://YOUR-BOT-PUBLIC-URL
# AI_ENRICH_TIMEOUT_MS=90000
# AI_ENRICH_TIMEOUT_MS_AMAZON=180000
# AI_IMAGE_COUNT=2
```

## صيغة رفع منتج (+ أمازون اختياري)

أرسل صورة حقيقية مع كابشن:

```text
55
Clavier flexible K87
K87
https://www.amazon.com/dp/...
```

- بدون رابط أمازون: السلوك السابق (صور تيليجرام + AI).
- مع رابط: كشط Apify → نصوص OpenAI من بيانات أمازون → معرض = AI ثم Amazon ثم **الصورة الحقيقية آخر صورة**.
- يُرسل أيضاً إلى Google Sheet عبر `PRODUCT_SHEET_WEBHOOK_URL`.

## تشغيل محلي

```bash
cd bot
cp ../.env .env
npm install
npm start
```

فحص الصحة: `GET /health`

## السلوك بعد إعادة البناء

1. رفع الصورة الحقيقية ببادئة `real-`
2. إن وُجد رابط أمازون: كشط + رفع `amazon-` ثم صور `ai-`
3. ترتيب المعرض: AI → Amazon → real في الآخر
4. حفظ في NocoDB مع `POSTEBL=POSTEBL` ورابط `/p/ERY-...` (+ `Amazon_URL` إن وُجد العمود)
