# مزامنة طلبات المتجر مع Tifawt

## المسار

`Checkout` → `NocoDB Orders` → `POST /bot-api/api/orders/sync` → `Tifawt Lead Source`.

يُنشئ المتجر معرفاً ثابتاً بصيغة `WEB-...` ويضيفه إلى كل عنصر داخل حقل
`Order Metadata`. هذا المعرف يمنع تكرار إنشاء العميل للطلب نفسه إذا وصل طلب
المتصفح وWebhook NocoDB في الوقت ذاته.

## مسار الطلبات متعددة المنتجات

واجهة Lead Source العامة تنشئ **lead منفصلاً لكل منتج** في المصفوفة.
لذلك المزامنة تستخدم `POST /api/v1/leads` بمصادقة البريد/كلمة المرور وتضع كل
أسطر الطلب في lead واحد (`externalOrderId` = معرف المتجر).

يتطلب على خدمة المتجر (`imden`):

```env
TIFAWT_EMAIL=...
TIFAWT_PASSWORD=...
TIFAWT_API_BASE=https://errayhany.tifawt.ma/api/v1
TIFAWT_BUSINESS_ID=1
```

لا تضف `VITE_TIFAWT_LEAD_URL` إلى إعدادات الواجهة؛ أي متغير يبدأ بـ `VITE_`
يصل إلى المتصفح ويكشف رابط الربط.

## Webhook NocoDB الاحتياطي

أنشئ Webhook عند إضافة سجل في جدول Orders:

- **Method:** `POST`
- **URL:** `https://errayhany.com/bot-api/api/orders/sync`
- فعّل إعادة المحاولة عند حالة `5xx` إن كان الخيار متاحاً.

Webhook لا يعيد إنشاء lead تم إرساله بنجاح؛ بوابة المتجر تحتفظ بمعرّف الطلب
لمدة 24 ساعة. يجب ألا تعتبر الحالة `200` دليلاً على فشل الطلب في المتجر، بل
دليلاً فقط على اكتمال مزامنة ERP.
