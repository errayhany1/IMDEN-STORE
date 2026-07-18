# سجلات DNS لـ Brevo — errayhany.com

أضف هذه السجلات في Hostinger → **Domains** → **DNS** (أو استورد الملف `docs/brevo-zone-append.txt`).

**لا تحذف** سجلات MX الخاصة بـ Hostinger.

## سجلات جديدة (CNAME / TXT)

| النوع | الاسم (Host) | القيمة |
|------|--------------|--------|
| CNAME | `em` | `em-errayhany-com.brand.brevosend.com` |
| TXT | `@` | `brevo-code:da37c32fc914682d356bd8d40de58eac` |
| CNAME | `brevo1._domainkey` | `b1.errayhany-com.dkim.brevo.com` |
| CNAME | `brevo2._domainkey` | `b2.errayhany-com.dkim.brevo.com` |
| CNAME | `img.em` | `em-errayhany-com.img.brand.brevosend.com` |
| CNAME | `r.em` | `em-errayhany-com.r.brand.brevosend.com` |

## تعديل سجلات موجودة

### SPF (TXT على `@`)

**الحالي:**
```text
v=spf1 include:_spf.mail.hostinger.com ~all
```

**بعد التعديل (أبقِ Hostinger وأضف Brevo):**
```text
v=spf1 include:_spf.mail.hostinger.com include:spf.brevo.com ~all
```

### DMARC (TXT على `_dmarc`)

موجود حالياً `v=DMARC1; p=none`. يمكن تحديثه إلى:
```text
v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com
```

## بعد الإضافة

1. في Brevo → Domains → **Verify records** ثم **Authenticate domain**.
2. أضف المرسل: `Errayhany Store <offers@errayhany.com>`.
