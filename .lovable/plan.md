
# الخطة: مخزون بدون فروقات + متاجر بمستوى عالمي

تنقسم لجزئين مستقلين قابلين للتنفيذ بالتوازي.

---

## الجزء الأول: دقة المخزون — حل جذري (صفر فروقات)

### لماذا تظهر فروقات كل مرة؟
السبب الجذري: **عدم تطابق منطق الحجز** بين 3 طبقات:

```text
┌─ Frontend (unifiedReservationSystem.js) ─┐
│ يحجز: pending,shipped,delivery,returned, │
│       partial_delivery, cancelled        │
│ يستثني: item_status='delivered'          │
└──────────────────────────────────────────┘
                ≠ (مصدر الفروقات)
┌─ DB Trigger (order_reservation_status) ──┐
│ يحجز/يحرر فقط عند تغيير orders.status    │
│ لا يستجيب لتغير order_items.item_status  │
│ (التسليم الجزئي 21، الإرجاع الجزئي)      │
└──────────────────────────────────────────┘
                ≠
┌─ inventory.reserved_quantity ────────────┐
│ يتراكم عبر الزمن من triggers قديمة       │
│ + تحديثات يدوية سابقة بدون stock_movements│
└──────────────────────────────────────────┘
```

النتيجة: مكسيك XXXL يظهر "4 محجوز" في DB والصحيح 2 (لأن 2 سُلِّمت جزئيًا والـ trigger لم يحرّرها).

### الحل الجذري (3 خطوات)

**1) توحيد منطق الحجز في دالة واحدة في DB** (مصدر حقيقة وحيد):
- `public.calculate_reserved_for_variant(variant_id)` — دالة SQL تعيد الحجز الصحيح من الطلبات النشطة فقط، بنفس قواعد الـ frontend بالحرف:
  - تحجز عند `status ∈ (pending,shipped,delivery,returned,partial_delivery,cancelled)` و `delivery_status ∉ (4,17)`
  - تستثني `item_status ∈ (delivered, returned_in_stock, returned)` و `item_direction='incoming'` و `order_type='return'`

**2) Trigger موحّد على كل التغييرات المؤثرة** (يحل التسليم الجزئي):
- Trigger واحد `sync_reserved_quantity_unified` يعمل على:
  - `orders` AFTER INSERT/UPDATE/DELETE (status, delivery_status)
  - `order_items` AFTER INSERT/UPDATE/DELETE (item_status, item_direction, quantity)
- في كل مرة: يستدعي `calculate_reserved_for_variant` للمتغيرات المتأثرة ويكتب القيمة الصحيحة في `inventory.reserved_quantity` مباشرة. **لا حسابات تراكمية (±) بعد اليوم** — فقط استبدال بالقيمة الحقيقية.
- حذف الـ triggers القديمة المتراكمة لمنع الازدواج.

**3) إصلاح تاريخي مرة واحدة + قفل**:
- Migration يعيد بناء `reserved_quantity` لكل صفوف `inventory` من الواقع.
- `RAISE EXCEPTION` على أي `UPDATE` مباشر لـ `inventory.reserved_quantity` من خارج الدالة (متغير `app.allow_reserved_write`).
- بعد ذلك: زر "فحص دقة المخزون" سيُظهر **صفر فروقات دائمًا**، ولن تحتاج "إصلاح تلقائي".

> ملاحظة: لن نلمس منطق `quantity` (المتاح الفعلي) — هو يتحدث عبر `stock_movements` كما هو.

---

## الجزء الثاني: ثورة المتاجر الإلكترونية

### المشاكل المكتشفة
1. **خطأ إنشاء المتجر** (الصورة الأولى):
   - DB constraint: `theme_name IN ('modern','classic','minimal','luxury')`
   - Wizard يرسل: `luxury-fashion`, `vibrant-street-style`, `natural-organic`, `modern-minimalist` → كلها مرفوضة.

2. **المنتجات لا تظهر** — `StorefrontPage` يقرأ من `employee_storefront_products` التي تكون فارغة افتراضيًا بعد الإنشاء (لا يوجد seed تلقائي بصلاحيات الموظف).

3. **لا يوجد محرر ثيم كامل** ولا اختيار قالب جاهز ولا دومين مخصص في الـ wizard.

### الحل: نظام Themes احترافي + Wizard جديد

**أ) إصلاح فوري لـ check constraint**:
- Migration: توسيع `theme_name` ليقبل 8 ثيمات جديدة:
  `glass-luxury`, `glass-noir`, `glass-aurora`, `glass-minimal`, `neon-cyber`, `editorial-soft`, `vibrant-pop`, `nature-calm`.
- إزالة الـ CHECK القديم واستبدال بقائمة محدّثة + DEFAULT `glass-luxury`.

**ب) 8 ثيمات زجاجية كاملة (Glassmorphism)** مستوحاة من الصور المرفقة:

| الثيم | الطابع | الاستخدام |
|---|---|---|
| Glass Luxury | بيج/ذهبي زجاجي ناعم (صورة الطقم) | أزياء راقية |
| Glass Noir | أسود/نيون أزرق-بنفسجي (صورة الفستان) | فاخر/ليلي |
| Glass Aurora | تدرج بنفسجي-أزرق زجاجي (صورة الحذاء) | عصري شبابي |
| Glass Minimal | أبيض/أزرق فاتح زجاجي (صورة السلة) | أنيق نظيف |
| Neon Cyber | أسود + نيون سماوي | تكنولوجيا/ألعاب |
| Editorial Soft | بيج/كريمي مجلة | بوتيك |
| Vibrant Pop | برتقالي/وردي | شباب/موضة سريعة |
| Nature Calm | أخضر/زيتي | عضوي/طبيعي |

كل ثيم = ملف tokens (CSS variables) + variant خاص بـ:
- `StorefrontHeader`, `StorefrontFooter`, `ProductCard`, `HeroSlider`, `MobileBottomNav`, `CategoryCircles`, زر "اشتر الآن".

البطاقات والـ overlays كلها `backdrop-blur` + `border` شفاف + توهج خفيف، مطابقة لمراجعك.

**ج) Wizard إنشاء المتجر — إعادة بناء (5 خطوات)**:
1. **الهوية**: اسم المتجر، slug، شعار، بانر، وصف.
2. **اختيار الثيم**: شبكة 8 معاينات حية (mini preview) قابلة للتدوير.
3. **الألوان والخطوط**: ضبط ناعم (3 ألوان + خط عربي).
4. **الدومين**: 
   - الافتراضي: `ryus.lovable.app/storefront/{slug}`
   - حقل "دومين مخصص" يحفظ في عمود جديد `custom_domain` + تعليمات DNS (CNAME).
5. **المنتجات الأولية + المعاينة**: 
   - زر "استيراد كل منتجاتي المسموح بها" يملأ `employee_storefront_products` تلقائيًا من `product_permissions`.
   - معاينة حية بالـ iframe قبل التفعيل.

**د) إصلاح ظهور المنتجات**:
- تعديل `StorefrontPage` ليعرض fallback من `product_permissions` عند فراغ `employee_storefront_products`.
- زر "مزامنة منتجاتي" في dashboard المتجر يعيد ملء الجدول من الصلاحيات الحالية.

**هـ) دومين مخصص (لاحقًا قابل للتنفيذ)**:
- إضافة `custom_domain TEXT` + `custom_domain_verified BOOLEAN` على `employee_storefront_settings`.
- middleware في `StorefrontPage` يطابق `window.location.host` مع `custom_domain` ويوجّه للمتجر الصحيح.

---

## الملفات المتأثرة (تقريبًا)

**Migrations جديدة**:
- `fix_inventory_reserved_unified.sql` (دالة + trigger موحّد + إعادة بناء + قفل)
- `expand_storefront_themes.sql` (CHECK constraint + custom_domain + indexes)

**Frontend**:
- `src/pages/employee-storefront/StorefrontSetupWizard.jsx` (إعادة بناء)
- `src/components/employee-storefront/ThemeCustomizer.jsx` (8 ثيمات)
- `src/components/storefront/themes/` (مجلد جديد: tokens + variants لكل ثيم)
- `src/components/storefront/StorefrontLayout.jsx` (تطبيق الثيم النشط)
- `src/pages/StorefrontPage.jsx` (fallback للمنتجات + دعم custom_domain)
- `src/pages/employee-storefront/StorefrontDashboardPage.jsx` (زر "مزامنة المنتجات" + إعدادات الدومين)

---

## أسئلة قبل البدء

1. هل تريد تنفيذ **الجزئين معًا** أم نبدأ بدقة المخزون أولًا (يحتاج migration حساس على inventory)؟
2. للدومين المخصص: هل تملك حق إضافة CNAME على دومينك (مثل `shop.ryusbrand.com`) أم نكتفي الآن بالـ slug تحت `ryus.lovable.app`؟
3. الثيمات الـ 8 — هل تريدها كلها الآن أم نبدأ بـ 4 (Glass Luxury, Glass Noir, Glass Aurora, Glass Minimal) ونوسّع لاحقًا؟
