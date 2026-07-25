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
# أعد إنشاء أي توكن ظهر في Git/JSON، ثم أضفه في EasyPanel → imden-bot → Env → Rebuild
APIFY_TOKEN=
APIFY_AMAZON_ACT=junglee~free-amazon-product-scraper
TIFAWT_LEAD_URL=https://errayhany.tifawt.ma/api/v1/lead-sources/api/0a4e5144-86c1-4fdf-b276-5b2f5bbcf149
TIFAWT_API_BASE=https://errayhany.tifawt.ma/api/v1
TIFAWT_EMAIL=admin@errayhany.ma
TIFAWT_PASSWORD=
TIFAWT_BUSINESS_ID=1

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

- بدون رابط أمازون: إنشاء صور استوديو احترافية من صور التيليجرام عبر OpenRouter (`ai-…`) ثم الصورة الحقيقية في الآخر.
- مع رابط: كشط Apify → نصوص OpenAI من بيانات أمازون → معرض = AI ثم Amazon ثم **الصورة الحقيقية آخر صورة**.
- يُحفظ في NocoDB، ويُرسل أيضاً إلى Google Sheet عبر `PRODUCT_SHEET_WEBHOOK_URL`.
- إن وُجدت `TIFAWT_EMAIL` + `TIFAWT_PASSWORD`: يُنشأ نفس المنتج في Tifawt (صورة + اسم + سعر + SKU).

## تشغيل محلي

```bash
cd bot
cp ../.env .env
npm install
npm start
```

فحص الصحة: `GET /health`

## EasyPanel بعد دمج أمازون

على `imden-bot` أضف ثم **Rebuild**:

- `APIFY_TOKEN` — توكن Apify جديد (لا تستخدم أي توكن ظهر في JSON/Git؛ أعد إنشاءه إن تسرّب)
- `APIFY_AMAZON_ACT=junglee~free-amazon-product-scraper` (اختياري؛ هذا الافتراضي)
- `OPENAI_API_KEY` — لنصوص الصفحة من بيانات أمازون
- `OPENROUTER_API_KEY` — لصور الاستوديو AI

تحقق من `/health` أن `"apify": true` و `"openai": true`.

## تتبع الطلبات من الموقع (Tifawt)

الموقع لا يملك مفاتيح Tifawt. صفحة `/tracking` تطلب رمز SMS من Firebase، ثم ترسل
`idToken` إلى البوت الذي:

1. يتحقق من التوكن عند Google ويستخرج رقم الهاتف المؤكَّد.
2. يبحث في Tifawt (`/orders` و `/leads`) بهذا الرقم فقط.
3. يُرجع الطلبات التي يطابق رقمها الرقم المؤكَّد تماماً، بحقول عامة فقط
   (بدون ملاحظات داخلية أو هاتف السائق أو مراجع الدفع).

صفحة **حسابي وطلباتي** (`/account`) تستخدم مساراً مختلفاً:

`POST /api/orders/account` — body: `{ "idToken": "<جلسة تسجيل الدخول>" }`

1. يتحقق من توكن الحساب (Google / البريد).
2. يجلب رقم الهاتف **الموثَّق والمربوط** بهذا الحساب فقط (من Firebase أو جدول Customers).
3. يعرض طلبات Tifawt لهذا الرقم — لا يمكن اختيار رقم هاتف حرّ.

لذلك: نعم، البريد/الحساب يُربَط برقم الهاتف بعد SMS، حتى لا تظهر طلبات زبناء آخرين.

`POST /api/orders/track` — body: `{ "idToken": "..." }`

### الربط بدون دومين جديد للبوت

الموقع ينادي `/bot-api/...` على نفس دومينه، و nginx يمرّرها داخلياً إلى خدمة
البوت. لا حاجة إلى دومين عام للبوت ولا إلى إعداد CORS.

على `imden-bot` أضف ثم **Rebuild**:

- `TIFAWT_EMAIL` / `TIFAWT_PASSWORD` (موجودان أصلاً لمزامنة المنتجات)
- `FIREBASE_WEB_API_KEY` (اختياري؛ الافتراضي مفتاح الويب العام للمشروع)

على `store-app`:

- `BOT_UPSTREAM=<اسم-خدمة-البوت-الداخلي>:3000` — في EasyPanel عادةً
  `store-app_imden-bot:3000` (اسم المشروع + `_` + اسم الخدمة). هذه القيمة هي
  الافتراضية في `Dockerfile` فإن تطابق الاسم فلا حاجة لإضافتها.

للتأكد بعد النشر: `https://errayhany.com/bot-api/health` يجب أن يعيد
`"service":"imden-bot"`.

إن فضّلت دومين عام للبوت بدل البروكسي، أضِف بدلها على `store-app`:
`VITE_TRACKING_API_URL=https://<رابط-البوت-العام>` مع
`STOREFRONT_ORIGINS` على البوت.

## السلوك بعد إعادة البناء

1. رفع الصورة الحقيقية ببادئة `real-`
2. إن وُجد رابط أمازون: كشط + رفع `amazon-` ثم صور `ai-`
3. ترتيب المعرض: AI → Amazon → real في الآخر
4. حفظ في NocoDB مع `POSTEBL=POSTEBL` ورابط `/p/ERY-...` (+ `Amazon_URL` إن وُجد العمود)
