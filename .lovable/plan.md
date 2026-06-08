
# الخطة الكاملة لإكمال "متجري"

## القسم 1: شرح الدومين والسبدومين (توثيق فقط - بدون كود)

### أ) السبدومين `alshmry.ryusbrand.com` - الخطوات الحقيقية:
الكود الحالي في `StorefrontHostGate.jsx` **يدعم السبدومين تلقائياً** (يقرأ أول جزء من الهوست ويحوّله إلى slug). لكن لكي يعمل فعلياً يحتاج 3 خطوات يدوية خارج التطبيق:

1. **DNS Wildcard في مسجّل ryusbrand.com:**
   - أضف سجل CNAME: `*` → `ryus.lovable.app`
   - أو سجل A: `*` → `185.158.133.1`
   
2. **تسجيل الـ wildcard في Lovable:**
   - افتح: Project Settings → Domains → Connect Domain
   - أدخل: `*.ryusbrand.com` (Lovable Business plan مطلوب للـ wildcard SSL)
   - بديل أرخص: تسجيل كل سبدومين يدوياً (`alshmry.ryusbrand.com`, `ahmed.ryusbrand.com`...)
   
3. **انتظار SSL** (حتى 24 ساعة) ثم يفتح تلقائياً.

### ب) دومين خاص للموظف (مثل `my-shop.com`):
1. الموظف يدخل صفحة "الدومين" في لوحة متجري ويضيف دومينه.
2. يذهب لمسجّل دومينه ويضيف CNAME: `@` → `ryus.lovable.app`
3. **خطوة ناقصة حالياً:** يجب على المسؤول (أنت) تسجيل الدومين في Lovable Domains لتفعيل SSL.
4. سأضيف **تنبيه واضح في الصفحة** يشرح هذه الخطوة + زر "نسخ تعليمات للمسؤول".

**ملاحظة مهمة:** زر "إعادة التحقق" حالياً وهمي - سأبني Edge Function `verify-custom-domain` يفحص DNS فعلياً عبر Google DNS API ويحدّث `status` تلقائياً.

---

## القسم 2: إصلاح "المتجر شاشة فارغة"
السبب: عند فتح `/storefront/demo-store` المعاينة فارغة. الأرجح:
- إما `StorefrontGate` يفشل في جلب الـ settings (slug غير موجود)
- أو `StorefrontPage` يعتمد على بيانات لم تُهيّأ بعد

**الإجراء:**
1. فحص شامل لـ `StorefrontPage.jsx` و `useStorefrontSettings`
2. ضمان عرض رسالة واضحة بدل الشاشة السوداء
3. إصلاح حالة "no products" بتصميم احترافي
4. إزالة الـ Splash الموجود في المتجر العام (يجب أن يفتح فوراً)

---

## القسم 3: فصل "الثيمات" عن "الإعدادات"

الوضع الحالي خاطئ: كارت الثيمات يفتح صفحة الإعدادات العامة.

**الهيكل الجديد المقترح للوحة متجري:**

| الكارت | المحتوى |
|---|---|
| 🎨 **الثيمات والتصميم** | اختيار قالب، ألوان، خطوط، أنماط البطاقات، الأنيميشن |
| ⚙️ **الإعدادات العامة** | اسم المتجر، الشعار، الوصف، معلومات الاتصال، العملة |
| 🌐 **الدومين** | السبدومين + الدومين المخصص (موجود) |
| 📜 **السياسات والصفحات** | الخصوصية، الإرجاع، الشروط، من نحن، اتصل بنا |
| 🔔 **الإشعارات والبكسلات** | Meta Pixel, Google Analytics, TikTok |
| 🚚 **الشحن والدفع** | طرق الشحن، طرق الدفع، المناطق |
| 🎁 **برنامج الولاء** | النقاط، المكافآت، المستويات |
| ⚡ **إعدادات متقدمة** | SEO، Robots، Sitemap، CSS مخصص، الحذف |

---

## القسم 4: إكمال صفحات إعدادات متجري (كاملة بتصميم زجاجي)

سأبني/أكمل بنفس تصميم Aurora Glassmorphism الموجود في الداشبورد:

### صفحات جديدة:
1. **`StorefrontThemesPage.jsx`** - معرض قوالب جاهزة (Minimal, Bold, Luxury, Vibrant) + محرر ألوان حي + معاينة فورية
2. **`StorefrontPoliciesPage.jsx`** - 5 تبويبات (خصوصية/إرجاع/شروط/من نحن/اتصل) مع محرر نصوص غني
3. **`StorefrontPixelsPage.jsx`** - إدارة Meta/Google/TikTok pixels (موجود `employee_marketing_pixels`)
4. **`StorefrontShippingPage.jsx`** - مناطق الشحن، أسعار، طرق الدفع
5. **`StorefrontLoyaltyPage.jsx`** - تفعيل/تعطيل النقاط، نسبة المكافأة، مستويات VIP
6. **`StorefrontSeoPage.jsx`** - title/description/og لكل صفحة + sitemap

### صفحات للتحديث:
- **`StorefrontSettingsPage.jsx`** - تقتصر على المعلومات الأساسية فقط
- **`AdvancedSettingsPage.jsx`** - إضافة CSS مخصص + خيار حذف المتجر
- **`StorefrontDashboardPage.jsx`** - تحديث الكروت لتعكس الهيكل الجديد + توجيه صحيح

### تحسينات عامة:
- إزالة Splash المتجر العام
- ضبط جميع الصفحات للموبايل (no horizontal scroll)
- نفس بطاقات Glass + Aurora في الخلفية
- Routes جديدة في `App.jsx`

---

## التفاصيل التقنية

### Migrations مطلوبة:
```sql
-- جدول السياسات
CREATE TABLE storefront_pages (
  id uuid PK, employee_id, page_type ('privacy'|'returns'|'terms'|'about'|'contact'),
  content jsonb, is_published, ...
);

-- جدول الشحن
CREATE TABLE storefront_shipping_zones (...);

-- إعدادات الثيم (إضافة أعمدة لـ employee_storefront_settings)
ALTER TABLE employee_storefront_settings 
  ADD theme_preset, theme_colors jsonb, theme_fonts jsonb, custom_css text;
```

### Edge Function:
- `verify-custom-domain`: يفحص CNAME عبر `https://dns.google/resolve` ويحدّث `storefront_custom_domains.status`

### ملفات ستُعدّل:
- `src/App.jsx` (routes جديدة)
- `src/pages/employee-storefront/StorefrontDashboardPage.jsx` (إعادة ترتيب الكروت)
- `src/pages/StorefrontPage.jsx` (إصلاح الشاشة الفارغة + إزالة Splash)
- `src/pages/employee-storefront/StorefrontDomainPage.jsx` (تعليمات أوضح + ربط الفحص الحقيقي)
- `src/pages/employee-storefront/AdvancedSettingsPage.jsx`
- `src/pages/employee-storefront/StorefrontSettingsPage.jsx`

### ملفات ستُنشأ:
- `StorefrontThemesPage.jsx`
- `StorefrontPoliciesPage.jsx`
- `StorefrontPixelsPage.jsx`
- `StorefrontShippingPage.jsx`
- `StorefrontLoyaltyPage.jsx`
- `StorefrontSeoPage.jsx`
- `supabase/functions/verify-custom-domain/index.ts`
- Migration للجداول الجديدة

---

## خطة التنفيذ بالترتيب

1. **المرحلة 1:** Migration + إصلاح المتجر الفارغ + إزالة Splash (الأولوية القصوى)
2. **المرحلة 2:** إعادة هيكلة كروت الداشبورد + فصل الثيمات عن الإعدادات
3. **المرحلة 3:** بناء `StorefrontThemesPage` و `StorefrontPoliciesPage`
4. **المرحلة 4:** بناء `StorefrontPixelsPage`, `StorefrontShippingPage`, `StorefrontLoyaltyPage`, `StorefrontSeoPage`
5. **المرحلة 5:** Edge Function للتحقق من الدومين + تحسين صفحة الدومين
6. **المرحلة 6:** فحص نهائي للموبايل لكل الصفحات

هل أبدأ التنفيذ الآن بهذا الترتيب الكامل بدون نقص؟
