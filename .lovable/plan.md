# خطة التنفيذ: متاجر عالمية + تثبيت دقة المخزون

## القرارات المعتمدة
- **السب دومين**: `{slug}.ryusbrand.com` (مثل `alshmry.ryusbrand.com`) عبر wildcard DNS.
- **دومين مخصص**: يدعمه الموظف (مثل `alshmry.com`) عبر CNAME + تحقق.
- **الثيمات**: نبدأ بـ 4 ثيمات احترافية: Glass Luxury, Glass Noir, Glass Aurora, Glass Minimal.
- **المخزون**: نُكمل التحقق الجذري بدون كسر أي بيانات + نسخة احتياطية كاملة.

---

## الجزء 1: تشخيص دقة المخزون (47 vs 37)

### السبب المحتمل للفرق الذي تراه
- **47** = `inventory.reserved_quantity` المُجمَّع عبر كل المتغيرات (الإجمالي في كرت "محجوز للطلبات").
- **37** = عدد القطع داخل الطلبات المحجوزة الحالية (30 طلب × قطع متعددة من مقاسات/منتجات مختلفة).
- **الفرق 10**: على الأرجح طلبات `delivery_status=4` (مُسلَّم) أو `17` (مُرجَع للتاجر) لم يُحرَّر حجزها من `inventory` رغم أن trigger التوحيد طُبِّق في migration السابق.

### خطوات التحقق قبل أي تعديل (SELECT فقط)
1. استعلام: `SELECT variant_id, reserved_quantity FROM inventory WHERE reserved_quantity > 0;`
2. مقارنة كل variant بناتج `calc_reserved_for_variant(variant_id)` المُنشَأة سابقًا.
3. عرض قائمة الفروقات الفعلية (variant, db_value, expected, الطلبات المسببة).
4. **عرض النتائج عليك قبل أي UPDATE**.

### الإصلاح (بعد موافقتك على النتائج)
- إنشاء جدول نسخة احتياطية: `inventory_reserved_backup_20260608` يحتوي صورة كاملة من `inventory` قبل التعديل.
- تشغيل `calc_reserved_for_variant` لكل صف وكتابة القيمة الصحيحة.
- إعادة الفحص — يجب أن يصبح **صفر فروقات دائمًا** بعد ذلك (لأن trigger التوحيد يحرس).

### الجواب المباشر على سؤالك
- **الصحيح** = ناتج `calc_reserved_for_variant` (يطابق منطق الواجهة بالحرف).
- بعد الإصلاح: زر "اصلاح تلقائي" لن يظهر له شيء ليصلحه أبدًا.

---

## الجزء 2: ثورة المتاجر (4 ثيمات + دومين + منتجات)

### أ) إصلاح "المتجر يعرض القديم ولا منتجات"
- `StorefrontPage.jsx`: قراءة `theme_name` من `employee_storefront_settings` وتطبيق tokens من `storefront-themes.js` على `<html>` فورًا.
- **Fallback للمنتجات**: إن كان `employee_storefront_products` فارغًا → عرض كل منتجات الموظف من `user_product_permissions` تلقائيًا.
- زر "مزامنة منتجاتي" في dashboard المتجر يملأ الجدول من الصلاحيات.

### ب) Wizard إنشاء المتجر — إعادة بناء (5 خطوات)
1. **الهوية**: اسم، slug (يتولّد تلقائيًا بالـ latin)، **رفع شعار**، بانر، وصف.
2. **اختيار الثيم**: 4 معاينات حية مع مؤشرات (Glass Luxury / Noir / Aurora / Minimal).
3. **الألوان والخطوط**: ضبط ناعم فوق الثيم.
4. **الدومين**:
   - افتراضي: `{slug}.ryusbrand.com` (يحفظ تلقائيًا، لا يحتاج إعداد منك).
   - حقل اختياري: "دومين خاص بي" → يحفظ في `custom_domain` + تعليمات CNAME → `cname.ryusbrand.com`.
5. **المنتجات + المعاينة**: زر "استيراد كل منتجاتي" + معاينة iframe.

### ج) Routing السب دومين والدومين المخصص
- `StorefrontPage` يقرأ `window.location.hostname`:
  - ينتهي بـ `.ryusbrand.com` → استخراج `slug` من الجزء الأول.
  - دومين مخصص → استعلام `employee_storefront_settings WHERE custom_domain = host AND custom_domain_verified = true`.
  - fallback: `ryus.lovable.app/storefront/{slug}`.
- يتطلب منك إضافة سجل DNS واحد فقط: `*.ryusbrand.com → CNAME → ryus.lovable.app` (سأعطيك الإرشاد بعد التنفيذ).

### د) 4 ثيمات زجاجية كاملة التطبيق
موجودة بالفعل في `src/lib/storefront-themes.js`. سنطبّقها على:
- `StorefrontHeader`, `StorefrontFooter`, `ProductCard`, `HeroSlider`, `MobileBottomNav`, `CategoryCircles`, زر "اشتر الآن".
- كل ثيم: `backdrop-blur` + حدود زجاجية + توهج خفيف (مطابق لصورك).

### هـ) خصائص عالمية (مرحلة لاحقة بعد التثبيت)
- **Reels والشراء منها**: عمود `product_reels` (جدول جديد) + مشغل Stories full-screen + زر "Shop the Look".
- **تجربة واقعية**: دعم `model_3d_url` لكل منتج + viewer عبر `<model-viewer>` (إن وُجد).
- **تتبع تفاعلي بخريطة**: استخدام `TrackingMap.jsx` الموجود + ربطه بصفحة `My Orders` داخل المتجر مع نقطة GPS حية من تحديث الوسيط.

> هذه المرحلة الأخيرة (Reels/3D/Map) أنفّذها بعد ثبات الثيمات والدومين، حتى لا نخلط الأهداف.

---

## ترتيب التنفيذ المقترح
1. **تشخيص المخزون** (SELECT فقط) — أعرض لك الفروقات.
2. **إصلاح المخزون** بعد موافقتك (مع نسخة احتياطية كاملة).
3. **Routing سب دومين + custom domain**.
4. **إصلاح المتجر**: تطبيق الثيم + ظهور المنتجات.
5. **Wizard جديد** بـ 5 خطوات + رفع شعار.
6. **مرحلة لاحقة**: Reels + 3D + خريطة تتبع.

---

## الملفات المتأثرة
- Migration: نسخة احتياطية + إصلاح `reserved_quantity` + عمود `custom_domain_verified`.
- `src/pages/StorefrontPage.jsx` — routing + theme + fallback منتجات.
- `src/pages/employee-storefront/StorefrontSetupWizard.jsx` — إعادة بناء كاملة.
- `src/components/storefront/StorefrontHeader.jsx`, `StorefrontFooter.jsx`, `ProductCard.jsx` — variants لكل ثيم.
- `src/pages/employee-storefront/StorefrontDashboardPage.jsx` — زر مزامنة منتجات + إعدادات الدومين.

هل أبدأ بـ **الخطوة 1 (تشخيص المخزون فقط)** لأعرض لك الفروقات قبل أي تعديل؟
