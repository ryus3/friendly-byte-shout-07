
## التشخيص

- **الاستضافة الفعلية: Vercel** (ملف `vercel.json` موجود). كل دومين يجب أن يشير إلى Vercel.
- `pos.ryusbrand.com` ← Vercel = النظام/POS.
- `ryus.lovable.app` ← معاينة Lovable فقط، ليست الإنتاج.
- الآن `ryusbrand.com` مربوط في Vercel ويصل للموقع، لكن الكود لا يميّزه كمتجر فيعرض النظام.

### سببان للمشكلة في الكود

1. **`verify-custom-domain` يفحص قيم Lovable القديمة** (`pos.ryusbrand.com` كـ CNAME أو `185.158.133.1` كـ A). الواقع على Vercel: CNAME = `cname.vercel-dns.com` / `*.vercel-dns-NNN.com`، و A = `76.76.21.21`. لذا أي تحقق سيفشل.
2. **`StorefrontHostGate.jsx` يبحث في `employee_storefront_settings.custom_domain`** فقط بعد التحقق. لكن صفحة "الدومين" تضيف الدومين في جدول مختلف (`storefront_custom_domains`) ولا تكتبه أبداً في `employee_storefront_settings.custom_domain`. النتيجة: حتى لو تحقق الدومين، الـ Gate لن يجده.

---

## الخطة

### 1) تحديث `supabase/functions/verify-custom-domain/index.ts`
- `CNAME_TARGETS = ['cname.vercel-dns.com']` + قبول أي قيمة تنتهي بـ `.vercel-dns.com` أو `.vercel-dns-NNN.com`.
- `A_TARGETS = ['76.76.21.21']`.
- إرجاع `verified: true` عند تطابق أي منهما.

### 2) تحديث `src/pages/employee-storefront/StorefrontDomainPage.jsx`
- `CNAME_TARGET = 'cname.vercel-dns.com'`
- `A_RECORD_TARGET = '76.76.21.21'`
- إعادة كتابة دليل الإعداد ليصبح Vercel-first بخطوات مرقمة (سبدومين / دومين رئيسي).
- **عند التحقق الناجح**: بالإضافة لتحديث `storefront_custom_domains.status='verified'`، نُحدّث أيضاً `employee_storefront_settings.custom_domain = <domain>` و `custom_domain_verified = true` لنفس الموظف. هكذا يربط الـ Gate الدومين بالمتجر فوراً.
- زر "اجعله الدومين الافتراضي لمتجري" يدوياً لو كان عند الموظف أكثر من دومين موثّق.

### 3) `StorefrontHostGate.jsx`
- لا تغيير منطقي، فقط التأكد أن الـ apex `ryusbrand.com` و `www.ryusbrand.com` لا يقعان في `MAIN_HOSTS` (وهو الوضع الحالي ✅) — سيمرّان لاستعلام `custom_domain`.

### 4) خطوات يدوية للمدير (بعد نشر الكود)

#### أ) لربط `ryusbrand.com` + `www.ryusbrand.com` بمتجر المدير العام:

**في Vercel (تم بالفعل ✅):** `ryusbrand.com` ظاهر بحالة Valid Configuration.
أضف أيضاً `www.ryusbrand.com` في نفس قائمة Domains في Vercel (Add → www.ryusbrand.com → Production).

**في Cloudflare:** Vercel أضاف السجلات تلقائياً (CNAME + TXT). لا شيء إضافي.

**في النظام (متجري → الدومين):**
1. يسجّل المدير العام دخوله.
2. يفتح "متجري → الدومين".
3. في قسم "دومين مخصص" يضيف: `ryusbrand.com` → Add → Recheck → سيُحفظ تلقائياً في إعدادات متجره.
4. يكرّر لـ `www.ryusbrand.com`.

#### ب) لربط `alshmry.ryusbrand.com` بمتجر أحمد:

**في Cloudflare (لمرة واحدة لكل السبدومينات):**
```
Type: CNAME   Name: *   Target: cname.vercel-dns.com   Proxy: DNS only   TTL: Auto
```

**في Vercel:** Add Domain → `alshmry.ryusbrand.com` → Production (SSL تلقائي).

**في النظام (متجر أحمد):**
1. أحمد يدخل "متجري → الدومين".
2. يضع السلاج: `alshmry`.
3. يضيف دومين مخصص: `alshmry.ryusbrand.com` → Recheck.

---

## ملاحظات

- لا حاجة لخطة Enterprise: نضيف كل سبدومين منفرداً في Vercel (Pro كافية).
- `pos.ryusbrand.com` يبقى للنظام/POS كما هو.
- بعد هذه التغييرات، لن يحدث أي ربط متجر بدون تحقق DNS ناجح ضد أهداف Vercel الفعلية.
