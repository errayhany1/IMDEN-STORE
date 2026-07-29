# ربط طلبات Jumia بـ Tifawt

عند إنشاء طلب جديد على Jumia Vendor Center يُجلب تفصيله عبر Jumia Vendor API
ثم يُرسل كـ lead إلى Tifawt بنفس مسار مزامنة طلبات الموقع (`orderId: JUMIA-{id}`).

## 1) إنشاء التطبيق في Jumia (مرة واحدة)

1. سجّل الدخول إلى [Vendor Center](https://vendorcenter.jumia.com) (المغرب).
2. **Settings → Applications → Create Application**.
3. الاسم مثلاً: `Errayhany Tifawt Sync`.
4. اختر **Self Authorization** (بدون تفاعل مستخدم).
5. بعد الإنشاء اضغط أيقونة القفل **lock** لعرض:
   - **Client ID**
   - **Refresh Token** (احفظه فوراً؛ يُعاد توليده عند الضغط مجدداً)

> واجهة Vendor Center الحالية تستخدم OAuth (Client ID + Refresh Token)
> وليس زوج UserID/API Key القديم من Seller Center القديم.

## 2) متغيرات EasyPanel

أضفها إلى خدمة الموقع/التتبع التي تخدم `/bot-api` (نفس خدمة `imden-tracking`):

```env
JUMIA_CLIENT_ID=<client-id-from-vendor-center>
JUMIA_REFRESH_TOKEN=<refresh-token-from-lock-dialog>
JUMIA_API_BASE=https://vendor-api.jumia.com
JUMIA_POLL_MS=120000
TIFAWT_LEAD_URL=https://errayhany.tifawt.ma/api/v1/lead-sources/api/<your-id>
# لقائمة طلبات Tifawt / تسجيل الإرجاع من لوحة الإدارة:
TIFAWT_EMAIL=<tifawt-login-email>
TIFAWT_PASSWORD=<tifawt-login-password>
ADMIN_PASSWORD=<same-as-VITE_ADMIN_PASSWORD>
```

أسماء بديلة مدعومة للتوافق مع الخطة القديمة:

- `JUMIA_USER_ID` → يُقرأ كـ Client ID إن لم يوجد `JUMIA_CLIENT_ID`
- `JUMIA_API_KEY` → يُقرأ كـ Refresh Token إن لم يوجد `JUMIA_REFRESH_TOKEN`

لا تضع الـ Refresh Token في Git أو في متغيرات `VITE_*`.

## 3) نقاط الـ API على المتجر

| Method | Path | الغرض |
|--------|------|--------|
| `POST` | `/bot-api/api/jumia/webhook` | استقبال `onOrderCreated` من Jumia |
| `POST` | `/bot-api/api/jumia/sync` | مزامنة يدوية للطلبات خلال آخر ساعة (أو `createdAfter` في الجسم) |
| `GET`  | `/bot-api/health` | يظهر `jumia: true` عند ضبط المفاتيح |

جسم الـ webhook المتوقع:

```json
{
  "event": "onOrderCreated",
  "payload": { "OrderId": 190 }
}
```

أحداث تغيير الحالة تُقبل بـ `200` دون إنشاء lead مكرر.

Poll تلقائي كل `JUMIA_POLL_MS` (افتراضي دقيقتان) يجلب طلبات آخر ساعة
ويمررها عبر نفس `syncOrderToTifawt` مع منع التكرار عبر `JUMIA-{id}`.

## 4) إعداد Webhook في Jumia

إن وُجدت شاشة Integration Management / Webhooks:

- **Callback URL:** `https://errayhany.com/bot-api/api/jumia/webhook`
- **Event:** Order Created (`onOrderCreated`)

حتى بدون webhook، الـ poll يغطي الطلبات الجديدة طالما المفاتيح مضبوطة.

## 5) Holiday Mode (مهم قبل الطلبات الحية)

المتجر لن يستقبل طلبات جديدة وهو في **Holiday Mode**.

1. Settings → **Holiday Mode** → أوقف الوضع.
2. تأكد من **Shop Activation** أن المتجر مفعّل وغير delisted.

## 6) تطابق SKU

يجب أن يطابق **Seller SKU** في Jumia نفس الـ SKU في Tifawt/NocoDB حتى تظهر
المنتجات صحيحة داخل الـ lead.

## 7) إشعار تيليجرام لطلبات Jumia

على خدمة **imden** (التتبع):

```env
TELEGRAM_NOTIFY_BOT_TOKEN=<bot-token>
TELEGRAM_NOTIFY_CHAT_ID=-1003868832013
```

أو استخدم `VITE_TELEGRAM_BOT_TOKEN` / `VITE_TELEGRAM_CHAT_ID` إن كانت مضبوطة كمتغيرات تشغيل.

عند مزامنة طلب جديد (غير مكرر) تُرسل رسالة للبوت/القناة.

## 8) تحديث حالة الطلب على Jumia

API على `/bot-api`:

| Method | Path | الغرض |
|--------|------|--------|
| `POST` | `/api/jumia/orders/:orderId/ship` | تعبئة + Ready To Ship |
| `POST` | `/api/jumia/orders/:orderId/cancel` | إلغاء عناصر الطلب |
| `POST` | `/api/jumia/orders/:orderId/labels` | ملصق الشحن |

من بوت التيليجرام (`imden-bot`): أزرار «تجهيز شحن Jumia» / «إلغاء طلب Jumia» / «ملصق شحن Jumia».

## 9) إيقاف / تفعيل منتج على Jumia

أزرار «إيقاف منتج» و«جعل المنتج متوفر» على البوت تحدّث NocoDB **و** حالة المنتج على Jumia (`ACTIVE` / `INACTIVE`) إن وُجد نفس الـ SKU.

## 10) لوحة الإدارة `/admin`

القائمة المبسّطة:

- طلبات الموقع · طلبات Tifawt · طلبات Jumia · مرتجعات الموقع · المنتجات · الإعدادات

| Method | Path | الغرض |
|--------|------|--------|
| `GET` | `/bot-api/api/admin/tifawt/orders` | قائمة طلبات Tifawt |
| `POST` | `/bot-api/api/admin/tifawt/orders/:id/return` | إرجاع عميل → `PENDING_RETURN` |
| `GET` | `/bot-api/api/admin/jumia/orders` | طلبات Jumia الأخيرة |
| `POST` | `/bot-api/api/admin/products/:sku/publish-jumia` | نشر منتج NocoDB على Jumia |

الهيدر: `X-Admin-Password` = `ADMIN_PASSWORD` / `VITE_ADMIN_PASSWORD`.

إعادة توليد الوصف/الصور من التيليجرام تنشر على Jumia تلقائياً (`syncJumia: true`).

## 11) اختبار سريع

بعد نشر env:

```bash
curl -s https://errayhany.com/bot-api/health
# {"ok":true,"jumia":true,...}

curl -s -X POST https://errayhany.com/bot-api/api/jumia/sync \
  -H 'Content-Type: application/json' \
  -d '{}'
```

الطلبات القديمة لا تُنقل تلقائياً؛ مرّر `createdAfter` أقدم إن احتجت مزامنة لمرة واحدة.

## 12) صور المنتجات الدائمة (لا تختفي بعد Redeploy)

Jumia لا يستقبل ملفات؛ يستقبل روابط HTTP. روابط NocoDB الموقّعة (`X-Amz-*`) تنتهي خلال ~ساعتين.
التخزين على قرص الحاوية فقط يُمسح عند كل Rebuild على EasyPanel → الصور تختفي من Jumia مجدداً.

**الحل الحالي (دائم):**

- الروابط التي تُرسل لـ Jumia:
  `https://errayhany.com/bot-api/public-images/p/{SKU}/{n}.jpg`
- عند كل طلب: الخدمة تعيد جلب صورة طازجة من NocoDB (`Image1…ImageN`) إن اختفى الكاش المحلي.
- لذلك يجب أن تحتوي خدمة المتجر (`imden`) على نفس `VITE_NOCODB_URL` / `VITE_NOCODB_API_TOKEN` / `VITE_NOCODB_TABLE_PRODUCTS`.

بعد نشر الكود: أعد نشر كل منتج متأثر من لوحة الإدارة → زر **Jumia** (أو أعد التوليد من التيليجرام).
Endpoint اختياري لتسخين الكاش فقط: `POST /bot-api/api/admin/products/:sku/rehost-images`.
