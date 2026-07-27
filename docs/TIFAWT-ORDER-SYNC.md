# مزامنة طلبات المتجر مع Tifawt

## المسار

`Checkout` → `NocoDB Orders` → `POST /bot-api/api/orders/sync` → `Tifawt Lead Source`.

يُنشئ المتجر معرفاً ثابتاً بصيغة `WEB-...` ويضيفه إلى كل عنصر داخل حقل
`Order Metadata`. هذا المعرف يمنع تكرار إنشاء العميل للطلب نفسه إذا وصل طلب
المتصفح وWebhook NocoDB في الوقت ذاته.

## إعدادات النشر المطلوبة

في خدمة البوت في EasyPanel أضف:

```env
TIFAWT_LEAD_URL=https://errayhany.tifawt.ma/api/v1/lead-sources/api/...
STOREFRONT_ORIGINS=https://errayhany.com,https://www.errayhany.com
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
