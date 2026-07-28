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

## 7) اختبار سريع

بعد نشر env:

```bash
curl -s https://errayhany.com/bot-api/health
# {"ok":true,"jumia":true,...}

curl -s -X POST https://errayhany.com/bot-api/api/jumia/sync \
  -H 'Content-Type: application/json' \
  -d '{}'
```

الطلبات القديمة لا تُنقل تلقائياً؛ مرّر `createdAfter` أقدم إن احتجت مزامنة لمرة واحدة.
