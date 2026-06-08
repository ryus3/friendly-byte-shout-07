## الخطة

### 1) إعادة تصميم كرت الطلب (OrderCard) — بدون أي مساس بالمنطق

الهدف: كرت مدمج، أنيق، لا سطور إضافية، اسم حساب التوصيل في الأعلى بالمنتصف بشكل متحرك إذا طال.

التغييرات (UI فقط في `src/components/orders/OrderCard.jsx`):

- الصف العلوي يصبح ثلاثة عناصر: 
  - يسار: شارة الحالة (قيد التجهيز…)
  - وسط: شارة `@RYUSIQ` (اسم حساب التوصيل) — `ScrollingText` مع `max-w-[140px]` ضمن حاوية مركزية لا تتمدد، فلا تدفع رقم التتبع خارج الكرت.
  - يمين: رقم التتبع + Checkbox بجانبه مباشرة (بدون عمود تحتها لحساب التوصيل بعد الآن).
- إزالة كتلة `delivery_account_used` من تحت رقم التتبع (التي كانت تخلق سطر ثاني).
- صف المعلومات (date/actions/customer) يُختصر:
  - عمود اسم الزبون: السطر الأول `User icon` + اسم الزبون + بجانبه مباشرة `Calendar` + التاريخ (سطر واحد، responsive: ينقل التاريخ تحت إذا ضاق فقط)؛ السطر الثاني: الهاتف؛ السطر الثالث: العنوان.
  - إزالة شارة `created_by_name` المنفصلة بـ padding كبير، واستبدالها بـ chip صغير inline بجانب الاسم بدون `px-3 py-1.5` (تخفيض إلى `px-2 py-0.5` وإزالة الفراغ تحت).
  - تقليل الـ gap بين أيقونة المستخدم والاسم من `gap-2` إلى `gap-1` وحذف أي `space-y` فائض.
- بطاقة `AL WASEET` تبقى أسفل التاريخ كما هي (المنطق سليم) لكن مع `min-w-0` ودون عمود إضافي.
- نتيجة بصرية: ارتفاع الكرت يقل ~25%، رقم التتبع داخل الكرت دائماً، حساب التوصيل ظاهر وسط الأعلى، التاريخ والاسم في صف منطقي واحد.

### 2) كرت "متابعة الموظفين" لمدير القسم

في `src/pages/Dashboard.jsx` السطر 780:
- تغيير شرط الظهور من `canViewAllData &&` إلى `(canViewAllData || isDepartmentManager) &&` لكي يظهر الكرت لمديري الأقسام ويفتح `/employee-follow-up`.
- صفحة `EmployeeFollowUpPage` تعمل أصلاً لمدير القسم (تم سابقاً).

### 3) ثورة كاملة لصفحة "متجري" (Glass / Premium)

نقطة الدخول: `src/pages/employee-storefront/StorefrontDashboardPage.jsx` + صفحات فرعية.

#### A. تصميم زجاجي (Glassmorphism) للوحة التحكم
- خلفية متدرجة داكنة (`from-slate-950 via-purple-950/40 to-slate-950`) مع `Aurora`/`Meteors` خفيفة من MagicUI (lazy).
- كل البطاقات: `backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]`.
- Header: اسم المتجر بخط ضخم gradient، شريط حالة المتجر (مفعل/متوقف، رابط، عدد الزوار اليوم).

#### B. شريط الرابط والدومين (حقيقي)
- بطاقة Glass تعرض: 
  - الرابط الافتراضي `ryus.lovable.app/storefront/{slug}` + نسخ + فتح.
  - **اختيار سَب-دومين** (تعديل `slug`) بمدخل live-validation عبر `employee_storefront_settings.slug` (تحقق فريد).
  - **دومين مخصص**: إدخال `custom_domain`، حفظ في DB، عرض تعليمات DNS (CNAME → `ryus.lovable.app`) مع زر نسخ، وحالة التحقق (pending/verified) من خلال جدول جديد `storefront_custom_domains` (domain, status, verified_at).
- يتم الحفظ مباشرة عبر Supabase (تحديث `employee_storefront_settings`).

#### C. شبكة تحكم شاملة (Real Controls)
استبدال grid الحالي بـ 12 بطاقة زجاجية كل واحدة تفتح صفحة وظيفية حقيقية:

1. **المنتجات** — `StorefrontProductsManagePage` (موجود — تفعيل ميزة "مميز/Featured"، "ترتيب يدوي drag&drop"، وصف مخصص لكل منتج).
2. **الأقسام والفئات** — صفحة جديدة `StorefrontCategoriesPage`:
   - يختار الموظف أي categories/departments تظهر في متجره وترتيبها وصورها الدائرية (مثل صورة `IMG_2832`).
   - جدول `employee_storefront_categories` (employee_id, category_id, display_order, custom_image_url, is_visible).
3. **البنرات الإعلانية** — صفحة موجودة + دعم سلايدر بنرات الهيدر (مثل `IMG_2831`) مع روابط/CTA.
4. **الخصومات والعروض** — `StorefrontPromotionsPage` (موجود — توسعة: كوبونات، خصم على فئة، Flash Deal بتوقيت).
5. **الثيمات** — تعديل `StorefrontSettingsPage` لاستخدام `STOREFRONT_THEMES` ال8 مع معاينة حية.
6. **التصميم المتقدم** — ألوان مخصصة، فونت، شكل الكرت (zalej/cards).
7. **الهيدر/الفوتر** — تخصيص لوغو، اسم تجاري، روابط، أيقونات سوشيال.
8. **الطلبات** — `StorefrontOrdersPage` + Badge للطلبات الجديدة.
9. **العملاء** — قائمة عملاء متجري + إحصائياتهم.
10. **التحليلات** — visitors, sales, conversion (موجود توسعته).
11. **الدومين** — نفس بطاقة B (اختصار).
12. **الإعدادات العامة** — حالة المتجر (تفعيل/إيقاف صيانة)، طرق الدفع/الشحن.

#### D. الواجهة العامة للمتجر (Public)
- `StorefrontLayout` + `StorefrontPage`: تصميم Glass حسب الثيم المختار مع:
  - Hero/Banner Slider يقرأ من جدول `storefront_banners`.
  - شريط أقسام/فئات دائرية أفقي قابل للتمرير.
  - قسم "عروض ساخنة" يقرأ من `storefront_promotions`.
  - قسم "منتجات مميزة" (`employee_product_descriptions.is_featured`).
  - شبكة منتجات متجاوبة.
  - Bottom Tab Bar (السلة/البحث/الفئات/الرئيسية/حسابي).

#### E. قاعدة البيانات (Migration واحدة)

```sql
-- 1) دومين مخصص
CREATE TABLE public.storefront_custom_domains (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references auth.users(id) on delete cascade,
  domain text not null unique,
  status text not null default 'pending' check (status in ('pending','verified','failed')),
  verified_at timestamptz,
  created_at timestamptz default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storefront_custom_domains TO authenticated;
GRANT ALL ON public.storefront_custom_domains TO service_role;
ALTER TABLE public.storefront_custom_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_domain ON public.storefront_custom_domains
  FOR ALL TO authenticated USING (employee_id = auth.uid()) WITH CHECK (employee_id = auth.uid());

-- 2) فئات/أقسام مخصصة لمتجر الموظف
CREATE TABLE public.employee_storefront_categories (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null,
  category_id uuid,
  department_id uuid,
  display_order int default 0,
  custom_image_url text,
  is_visible boolean default true,
  created_at timestamptz default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_storefront_categories TO authenticated;
GRANT SELECT ON public.employee_storefront_categories TO anon;
GRANT ALL ON public.employee_storefront_categories TO service_role;
ALTER TABLE public.employee_storefront_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_cats ON public.employee_storefront_categories
  FOR ALL TO authenticated USING (employee_id = auth.uid()) WITH CHECK (employee_id = auth.uid());
CREATE POLICY public_read_cats ON public.employee_storefront_categories
  FOR SELECT TO anon USING (is_visible = true);

-- 3) منتج مميز + ترتيب يدوي
ALTER TABLE public.employee_product_descriptions
  ADD COLUMN IF NOT EXISTS is_featured boolean default false,
  ADD COLUMN IF NOT EXISTS display_order int default 0;
```

### تفاصيل تقنية

- لا أي تعديل على: `reserved_quantity`, triggers, partial delivery, returns, exchanges, settlement logic.
- ملفات معدّلة:
  - `src/components/orders/OrderCard.jsx` (UI فقط)
  - `src/pages/Dashboard.jsx` (شرط واحد)
  - `src/pages/employee-storefront/StorefrontDashboardPage.jsx` (إعادة كتابة كاملة Glass)
  - `src/pages/employee-storefront/StorefrontSettingsPage.jsx` (دومين + ثيمات حية)
  - `src/pages/StorefrontPage.jsx` و `StorefrontLayout` (تصميم Glass + بنرات + أقسام)
  - صفحة جديدة `src/pages/employee-storefront/StorefrontCategoriesPage.jsx`
  - صفحة جديدة `src/pages/employee-storefront/StorefrontDomainPage.jsx`
  - مهاجرة SQL واحدة بالأعلى.
- استخدام MagicUI: `Meteors`, `BorderBeam`, `ShimmerButton`, `BentoGrid` (lazy import).

### بعد التنفيذ
- فحص بصري للكرت على الموبايل (لا قص، لا سطرين).
- اختبار: مدير قسم يرى الكرت، يدخل المتجر، يربط دومين، ينشئ بنر/خصم/فئة، ويظهر فوراً في الصفحة العامة.
