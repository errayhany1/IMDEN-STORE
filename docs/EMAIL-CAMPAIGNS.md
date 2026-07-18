# حملات عروض الزبائن (Brevo)

إرسال عروض جماعية من بريد الدومين عبر **Brevo** (مجاني تقريباً 300 رسالة/يوم).

## العناوين

| العنوان | الدور |
|---------|--------|
| `offers@errayhany.com` | مرسل الحملات (اسم مستعار → `contact@`) |
| `contact@errayhany.com` | صندوق الاستقبال + الردود |
| `errayhany.com@gmail.com` | تحويل وارد من `contact@` (Gmail) |

دخول الحملات: [app.brevo.com](https://app.brevo.com) — سجّل بنفس Google المرتبط بـ `errayhany.com@gmail.com`.

## إعداد الدومين (مرة واحدة)

السجلات الجاهزة للنسخ موجودة في:
- [brevo-dns-records.md](./brevo-dns-records.md)
- [brevo-zone-append.txt](./brevo-zone-append.txt)

ملخص سريع في Hostinger → **Domains** → **DNS**:

1. أضف CNAME: `em` → `em-errayhany-com.brand.brevosend.com`
2. أضف CNAME: `brevo1._domainkey` و `brevo2._domainkey` (قيم Brevo)
3. أضف TXT على `@`: `brevo-code:da37c32fc914682d356bd8d40de58eac`
4. عدّل SPF إلى:

   ```text
   v=spf1 include:_spf.mail.hostinger.com include:spf.brevo.com ~all
   ```

5. في Brevo → Domains → **Verify records** ثم **Authenticate domain**.
6. أكّد المرسل `offers@errayhany.com` من رابط التحقق في البريد (يصل عبر التحويل إلى Gmail).

لا تحذف سجلات MX الخاصة بـ Hostinger — وإلا يتعطل استقبال البريد العادي.

## قائمة الزبائن

### المصدر الأفضل: Firebase (المسجّلون في الموقع)

كل من يسجّل / يدخل بحساب فيه بريد يُحفظ تلقائياً في:
- Firebase Auth
- Firestore `offersLeads/{uid}`
- Firestore `customerAccounts/{uid}.email` (+ `offersOptIn`)
- NocoDB Customers (إن كان الجدول مفعّلاً)

تصدير للإيميلات الحالية:

```bash
node scripts/export-firebase-emails-for-brevo.cjs
```

ينتج: `tmp/firebase-customers-brevo.csv` — استورده في Brevo قائمة `Wholesale customers`.

### تصدير من NocoDB (اختياري)

```bash
node scripts/export-customers-for-brevo.cjs
```

ينتج: `tmp/wholesale-customers-brevo.csv`

**ملاحظة:** جدول الطلبات قد لا يخزّن `Customer Email`. لملء القائمة من الطلبات:

1. أضف عمود `Customer Email` (وأيضاً `Customer UID` إن أمكن) في جدول Orders في NocoDB، **أو**
2. فعّل جدول العملاء وضبط `VITE_NOCODB_TABLE_CUSTOMERS` في `.env`.

التطبيق يحفظ البريد عند التسجيل/الدخول وعند الطلب الموثّق.

### استيراد في Brevo

1. Contacts → **Import contacts** → ارفع CSV.
2. أنشئ قائمة باسم `Wholesale customers`.
3. اربط عمود `EMAIL` (و`FIRSTNAME` إن وُجد).

لقائمة اختبار سريعة استخدم `tmp/brevo-test-list.csv` (بريدك فقط).

## إرسال عرض

1. Campaigns → **Email** → Create campaign.
2. اختر القائمة `Wholesale customers` (أو قائمة الاختبار أولاً).
3. المرسل: `offers@errayhany.com` / الاسم: `Errayhany Store`.
4. الصق قالب HTML من `docs/templates/offer-campaign.html` وعدّل النص والأسعار.
5. أرسل **اختباراً لنفسك**، ثم أرسل الحملة.

Brevo يضيف رابط إلغاء الاشتراك تلقائياً — لا تحذفه.

## حدود الخطة المجانية

- حوالي **300 رسالة/يوم**.
- للوصول لمئات الزبائن يومياً باستمرار، رقّ الخطة لاحقاً من داخل Brevo.

## أين تصل الردود؟

أي رد على العرض يصل إلى `offers@` → `contact@` → Gmail (`errayhany.com@gmail.com`).

## صورة المرسل (أفاتار في الصندوق الوارد)

Brevo لا يضبط صورة الملف الشخصي للصندوق الوارد. لظهور الشعار بجانب الاسم:

1. **داخل الرسالة (تم):** القالب يستخدم `https://errayhany.com/logo-512.png` في رأس الإيميل.
2. **Gravatar (تم):** شعار المتجر مربوط بـ `offers@errayhany.com` (ملف الشخصي: ERRAYHANY ABDFESLAM). يظهر غالباً في عملاء غير Gmail.
3. **Gmail:** يظهر الأفاتار غالباً عبر Google Workspace أو BIMI (يتطلب شهادة مدفوعة). التحويل عبر Hostinger لا يكفي وحده لصورة الملف في Gmail.

## حالة الإعداد (تم تحديثها)

| الخطوة | الحالة |
|--------|--------|
| Alias `offers@` → `contact@` | تم |
| حساب Brevo + قائمة `Wholesale customers` (اختبار: 2 جهات) | تم |
| مسودة حملة `عرض جملة Errayhany Store` + موضوع + قالب HTML | تم |
| سجلات DNS (SPF/DKIM/DMARC/Brevo) في Hostinger | تم |
| مصادقة الدومين `errayhany.com` + branding `em` | تم |
| تأكيد المرسل `offers@errayhany.com` | تم |
| مرسل الحملة = `offers@` | تم |
| Gravatar لـ `offers@` (شعار المتجر) | تم |
| إرسال حملة حقيقية للزبائن | عند جاهزية قائمة الإيميلات |

## تحديث العنوان القانوني في الحملات

عنوان الشركة الظاهر في تذييل الرسائل يُضبط من إعدادات حساب Brevo (Company address). حدّثه إلى عنوانك الحقيقي في الدار البيضاء عند الحاجة.
