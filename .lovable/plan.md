## الخطة الشاملة

### 1. ربط السبدومين `Alshmry.ryusbrand.com` (شرح + تنفيذ)

**في Cloudflare (تعمله مرة واحدة فقط لكل المتاجر):**
- DNS → Add record
- Type: `CNAME` | Name: `*` | Target: `ryus.lovable.app` | Proxy: **DNS only (رمادي)** | TTL: Auto
- (اختياري لـ Alshmry فقط بدل wildcard): Name: `alshmry` | Target: `ryus.lovable.app`

**في Lovable (مرة واحدة):**
- Project Settings → Domains → Connect Domain → `*.ryusbrand.com` (يتطلب Business plan لـ wildcard SSL)
- أو أضف كل سبدومين منفرداً: `alshmry.ryusbrand.com`
- انتظر 5 دقائق – 24 ساعة لإصدار SSL

**في صفحة "متجري" (تنفيذ برمجي):**
- في `StorefrontDomainPage.jsx` سأضيف:
  - حقل "السبدومين المطلوب" (مثل alshmry)
  - زر "تفعيل" → يحفظ في `employee_storefront_settings.slug`
  - يعرض تعليمات مرئية: "رابطك الجاهز: alshmry.ryusbrand.com"
  - مؤشر حالة DNS (✅ نشط / ⏳ بانتظار البروباغيشن) عبر edge function

### 2. ربط دومين كامل خاص (مثل `ryusbrand.com` لمتجر معين)

**صفحة "متجري → الدومين → دومين مخصص":**
- يدخل المستخدم: `mystore.com`
- النظام يعطيه DNS records:
  - `A` @ → `185.158.133.1`
  - `A` www → `185.158.133.1`
  - `TXT` _lovable → `lovable_verify=XXX`
- زر "تحقق الآن" يستدعي `verify-custom-domain` edge function (موجود)
- بعد التحقق: يجب إضافته في **Project Settings → Domains** في Lovable للحصول على SSL

### 3. إصلاح بطء وعدم فتح المتجر `/storefront/Alshmry`

السبب المتوقع (سيتم التحقق):
- استعلام `slug` حساس لحالة الأحرف (Alshmry ≠ alshmry)
- `StorefrontGate` يحمّل بطء بسبب استعلامات متعددة متسلسلة
- المنتجات لا تظهر لأن `employee_product_descriptions.is_in_storefront` فارغ
- التصميم القديم بسبب كاش Service Worker (`public/sw.js`)

**الإصلاحات:**
- جعل البحث عن slug **case-insensitive** (`.ilike()` بدل `.eq()`)
- توحيد slug عند الحفظ → lowercase دائماً
- إضافة Skeleton فوري بدل شاشة سوداء
- زيادة `staleTime` في useStorefrontSettings
- تعديل `sw.js` لاستثناء مسارات `/storefront/*` من الكاش
- زر "مزامنة المنتجات" يعمل تلقائياً عند فتح المتجر لأول مرة إذا كان فارغاً

### 4. أخطاء الموافقة على الطلب الذكي (نفس حساب الوسيط لمستخدمين)

**التشخيص:** عند وجود token مشترك بين موظفين، الطلبات المتزامنة تسبب:
- تضارب في `delivery_partner_tokens` (آخر تحديث يطغى)
- خطأ "Token expired" عشوائياً
- فشل create_order في الوسيط (rate limit / session conflict)

**الإصلاح:**
- إضافة قفل متفائل (`optimistic lock`) على token عند الاستخدام
- إعادة محاولة تلقائية (3 مرات) مع backoff عند فشل الوسيط
- طابور (queue) لطلبات نفس الحساب تمنع التزامن
- رسالة خطأ واضحة للمستخدم بدل الخطأ الخام
- لوغ مفصل في `auto_sync_log` لكل محاولة موافقة

---

## ملفات سيتم تعديلها
- `src/pages/employee-storefront/StorefrontDomainPage.jsx` — واجهة كاملة للسبدومين والدومين المخصص
- `src/components/storefront/StorefrontHostGate.jsx` — case-insensitive
- `src/pages/StorefrontPage.jsx` — Skeleton + auto-sync
- `src/hooks/storefront/useStorefrontSettings.js` — `.ilike()` + caching
- `public/sw.js` — استثناء storefront من الكاش
- `src/contexts/AlWaseetUnifiedOrderCreator.jsx` — retry + queue + lock
- migration: lowercase trigger على `slug` + index

## الملفات الجديدة
- `supabase/functions/check-storefront-dns/index.ts` — فحص DNS مباشر للسبدومين

## أسئلة قبل التنفيذ
1. هل تريد تفعيل wildcard `*.ryusbrand.com` (يتطلب Business plan في Lovable) أم تضيف كل سبدومين يدوياً؟
2. الدومين `ryusbrand.com` نفسه — هل تريده يفتح متجر معين (أي متجر؟) أم يبقى للوحة التحكم الرئيسية كما هو الآن؟
