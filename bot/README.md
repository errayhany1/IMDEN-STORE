# Errayhany / IMDEN Telegram Bot

خدمة مستقلة لرفع المنتجات من تيليجرام → NocoDB (+ AI اختياري).

## إصلاح فشل EasyPanel (`tar Unexpected EOF`)

الخطأ يحدث لأن أرشيف GitHub كان ثقيلاً (ملفات APK/EXE). تم إزالتها من Git.

في خدمة **imden-bot** على EasyPanel اضبط:

| الإعداد | القيمة |
|---------|--------|
| Root Directory | `bot` |
| Dockerfile Path | `Dockerfile` (داخل مجلد bot) |
| Port | `3000` |
| Start Command | اتركه فارغاً (يستخدم `CMD` في Dockerfile) أو `npm start` |

أو من جذر المستودع:

| Dockerfile Path | `Dockerfile.bot` |

## المتغيرات البيئية

```env
TELEGRAM_BOT_TOKEN=
VITE_NOCODB_URL=
VITE_NOCODB_API_TOKEN=
VITE_NOCODB_TABLE_PRODUCTS=
PUBLIC_SITE_URL=https://errayhany.com
OPENROUTER_API_KEY=
PRODUCT_AI_ENRICHMENT=true
PRODUCT_SHEET_WEBHOOK_URL=
PRODUCT_SHEET_ID=1zuRmrjaMjTsvN7j822b5w6v3NR3Dh_TclhFyFKXx5h4
```

## تشغيل محلي

```bash
cd bot
cp ../.env .env   # أو صدّر المتغيرات
npm install
npm start
```

فحص الصحة: `GET /health`

## السلوك بعد إعادة البناء

1. رفع صور تيليجرام الأصلية أولاً دائماً (لا يُنشأ منتج بدون صورة)
2. ثم محاولة نصوص/صور AI إن وُجد `OPENROUTER_API_KEY`
3. حفظ في NocoDB مع `POSTEBL=POSTEBL` ورابط `/p/ERY-...`
