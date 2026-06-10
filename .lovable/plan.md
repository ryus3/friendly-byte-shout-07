
# الخطة الكاملة بعد التشخيص الفعلي

## 🔍 ما اكتشفته فعلياً (تشخيص حقيقي من قاعدة البيانات)

### المشكلة الأساسية في دفع المستحقات
- **توجد نسختان (overloads)** من `pay_employee_dues_with_invoice` في القاعدة → خطر تعارض/غموض في الاستدعاء.
- الفاتورة الأخيرة **RY-OZOY7V (105,000 د.ع)** بتاريخ 2026-06-09:
  - ✅ تم إنشاء `settlement_invoices`
  - ✅ تم إنشاء `expenses`
  - ✅ تم تسوية `profits`
  - ❌ **لم تُنشأ `cash_movements` نهائياً** ← هذه هي المشكلة
- السبب الجذري: الدالة تستخدم `PERFORM update_cash_source_balance(...)` و`update_cash_source_balance` تحتوي على `EXCEPTION WHEN OTHERS` يبتلع أي خطأ صامتاً ويُرجع `{success:false}` دون أن يُلاحظ. فأي فشل داخلي (trigger، NOT NULL، RLS، إلخ) يضيع بدون أثر.
- نتيجة: رصيد القاصة لم يُخصم، الاستحقاق ظهر مدفوعاً بدون أثر نقدي.
- **حساب الزيادة/الخصم للموظف بقواعد الربح يعمل بشكل صحيح أصلاً** ✅ (تأكدت من جداول `profits` و`employee_profit_rules`) — لا حاجة لتغييره.

---

## المرحلة 1 — الإصلاحات المالية الحرجة

### 1.1 إصلاح دفع المستحقات (بدون دوال جديدة، فقط إصلاح الموجود)

**أ. حذف الـ overload المكرر وإبقاء نسخة واحدة موحّدة:**
```sql
DROP FUNCTION public.pay_employee_dues_with_invoice(uuid, numeric, text, uuid, uuid[], uuid[]);
-- يبقى التوقيع: (p_employee_id, p_amount, p_order_ids, p_profit_ids, p_description, p_paid_by, p_owner_user_id)
```

**ب. تعديل نص الدالة الباقية لتصبح موثوقة:**
- تستبدل `PERFORM update_cash_source_balance(...)` بـ `SELECT ... INTO v_result` ثم `IF NOT (v_result->>'success')::boolean THEN RAISE EXCEPTION '...'`.
- تحديد `v_cash_source_id` تلقائياً من **مالك المنتجات الفعلي** المرتبط بالطلبات في `p_order_ids` (وليس "القاصة الرئيسية" دائماً):
  ```sql
  -- إذا كل الطلبات لمالك واحد → قاصة ذلك المالك
  -- إذا متعدد المالكين → إنشاء cash_movement واحد لكل مالك بحصته (لكل طلباته)
  ```
- في حالتنا: عبدالله بائع، المالك الفعلي للمنتجات هو **أحمد** → الخصم من قاصة أحمد إلى عبدالله (تأكيد لمعمارية revenue routing الموجودة).

**ج. إصلاح `update_cash_source_balance`:**
- استبدال `EXCEPTION WHEN OTHERS` بترك الخطأ يتفجّر بصراحة `RAISE EXCEPTION` (أو على الأقل تسجيله في `inventory_operations_log` كـ audit) — هذا يقضي على فئة كاملة من الأخطاء الصامتة في النظام كلّه، ليس فقط هنا.

**د. تعديل واجهة `PayEmployeeDuesDialog.jsx`:**
- تمرير `p_order_ids` و`p_profit_ids` الفعلية (حالياً تُرسل `'{}'`) بناءً على الطلبات/الأرباح المحددة من قائمة المستحقات المعلّقة.
- تمرير `p_owner_user_id` (مالك المنتجات في تلك الطلبات) كي تختار الدالة قاصة المالك الصحيحة.

**هـ. Back-fill للفاتورة RY-OZOY7V:**
- إنشاء `cash_movement` يدوي مفقود (105,000 د.ع، out، reference_type='settlement_invoice', reference_id=invoice_id, created_by=مدير) وتحديث رصيد قاصة أحمد ليتطابق. (عبر `supabase--insert` بعد موافقتك).

**و. تحسين عرض فاتورة المستحقات (`SettlementInvoiceDialog`):**
- عمود **رقم التتبع** بدل رقم الطلب الداخلي.
- لكل طلب سطر يوضح: `الربح الأساسي + الزيادة − الخصم = ربح الموظف` مع شارة 🟢 "الزيادة محسوبة للموظف (قاعدة ربح نشطة)".
- تذييل: "تم الدفع من قاصة [اسم مالك المنتجات] إلى [الموظف]".

### 1.2 إيراد الفاتورة الفردية (نافذة الطلب 3497476) — تصحيح حسابي
- في `OrderInvoiceDialog` / `useUnifiedProfitCalculator`:
  - **إيراد المنتجات** = `SUM(base_price × qty)` فقط — يدخل إحصاءات المالك (ثابت ومستقل عن الزيادات).
  - **زيادات الموظف** = سطر منفصل (للعلم، يُحوَّل لاحقاً كمستحقات).
  - **خصومات** = سطر منفصل.
  - **إجمالي الفاتورة** = المجموع الثلاثي.
- هذا يحل ظهور `−17` في الإحصاءات (الزيادة كانت تُخصم من إيراد المالك بالخطأ).

### 1.3 فاتورة AlWaseet رقم 3507663 (مستلمة بالخطأ)
- AlWaseet قسّمت endpoint إلى **محفظة (معلّق)** + **فواتير مسلَّمة**.
- تعديل `smart-invoice-sync` / `alwaseet-proxy` بحيث:
  - فقط الفواتير من endpoint **الفواتير المسلَّمة** تأخذ `received=true, received_at=now()`.
  - الفواتير من **المحفظة** تبقى `received=false, status='pending'`.
- إعادة ضبط فاتورة 3507663 وأي مشابه عبر `supabase--insert` (إرجاع `received=false, received_at=NULL, status='pending'`).

### 1.4 فحص دقة المخزون — فروق المباع
- مراجعة دالة الفحص: `expected_sold` يُحسب فقط من الطلبات بـ `delivery_status='4'`.
- استبعاد الطلبات بـ `delivery_status='17'` (مرتجعة) من احتساب المباع.
- زر **"إصلاح تلقائي"** في صفحة الجرد يستدعي إعادة حساب `product_variants.sold_quantity` من المصدر.

---

## المرحلة 2 — توجيه `ryusbrand.com` لمتجر المدير العام

- **migration:**
  ```sql
  ALTER TABLE employee_storefront_settings 
    ADD COLUMN is_root_default boolean DEFAULT false;
  CREATE UNIQUE INDEX uniq_root_default 
    ON employee_storefront_settings (is_root_default) WHERE is_root_default = true;
  ```
- في `StorefrontDomainPage`: زر "تعيين متجري كافتراضي للجذر" (للمدير العام فقط).
- في `App.jsx`/Router:
  - `hostname === 'ryusbrand.com'` && `pathname === '/'` → جلب الـ slug الافتراضي → `<Navigate to="/store/{slug}" replace />`.
  - `pos.ryusbrand.com` → النظام كالمعتاد.
- **localStorage cache (1h)** للـ slug → فتح فوري بدون round-trip.

---

## المرحلة 3 — ثورة الصفحة الرئيسية للمتجر + لوحة «متجري»

### 3.1 إعادة بناء `StorefrontPage.jsx` (mobile-first زجاجي عالمي)
ترتيب الأقسام من أعلى لأسفل:
1. **Header زجاجي sticky** — اللوغو + اسم المتجر | بحث + سلة + ☰. البحث drawer قابل للتوسعة مع اقتراحات حية.
2. **Hero Slider** (1–10 سلايد) — صور فخمة، autoplay 5s، swipe، parallax خفيف، كل سلايد له هدف (منتج/فئة/رابط).
3. **شريط ثقة** — دفع عند الاستلام، إرجاع 10 أيام، استرداد كاش.
4. **بنرات قابلة للتخصيص** من `employee_banners` الموجود.
5. **شريط الفئات (Orbs)** — دوائر زجاجية بحدود نيون، scroll-snap أفقي.
6. **تسوّق حسب الفئة** — bento grid 2×N.
7. **عروض مميزة** — تذاكر خصم بتصميم قسائم.
8. **المنتجات المميزة** — 3D tilt cards + Quick View + Add to Cart فوري.
9. **الأكثر مبيعاً** — مرتبة حسب `sold_quantity`.
10. **خصومات وتخفيضات** — `discount_price IS NOT NULL`.
11. **Footer زجاجي** — سياسات + سوشيال.

### 3.2 العناصر العائمة
- **Sticky Mini-Cart** أسفل يسار (يظهر عند وجود عناصر).
- **زر WhatsApp عائم** أسفل يمين → `wa.me/{whatsapp_number}` من إعدادات المتجر، مع رسالة مسبقة.
- **Bottom Nav زجاجي** 5 أزرار (الرئيسية/الفئات/البحث/السلة/حسابي).

### 3.3 السرعة (متطلب "سرعة الطلقة")
- `React.lazy` لكل سكشن بعد الهيرو.
- **استعلام جامع واحد** (RPC جديد إذا لزم — مع موافقتك فقط، وإلا نستخدم استعلامات متوازية مدمجة).
- Skeleton فوري + صور الهيدر `loading="eager"` والباقي `lazy`.
- تخفيف `aurora.css` (استبدال blob/noise الثقيل بـ pure CSS gradient).

### 3.4 لوحة «متجري» — التخصيص الكامل
| الصفحة | الوظائف |
|---|---|
| **StorefrontHeroSlidesPage** (جديدة) | CRUD سلايدات الهيدر: رفع صورة + cropper + عنوان + CTA + هدف + drag-and-drop. |
| **StorefrontBannersPage** (تحسين) | cropper + معاينة حية + ترتيب. |
| **StorefrontCategoriesPage** (تحسين) | drag-and-drop + صور + toggle "إظهار في الرئيسية". |
| **StorefrontFeaturedPage** (جديدة) | اختيار المنتجات المميزة + ترتيبها + tabs (مميزة/خصومات/مبيعاً). |
| **StorefrontSettingsPage** (تحسين) | حقل WhatsApp + اللوغو + اسم المتجر المخصّص + toggle لكل سكشن. |

كل تعديل يُحفظ في DB → real-time → ينعكس فوراً.

### 3.5 Migrations مطلوبة للمرحلة 3
```sql
CREATE TABLE employee_hero_slides (
  id uuid PK, employee_id uuid FK, image_url text, title text, subtitle text,
  cta_text text, target_type text, target_id text, sort_order int, is_active boolean
);
GRANT SELECT ON employee_hero_slides TO anon;
GRANT ALL ON employee_hero_slides TO authenticated, service_role;
-- RLS policies + updated_at trigger

ALTER TABLE employee_custom_products ADD COLUMN is_featured boolean DEFAULT false;
ALTER TABLE employee_storefront_settings 
  ADD COLUMN whatsapp_number text,
  ADD COLUMN custom_store_name text;
```

---

## ⛔ ما لن يُغيَّر
- **لا تعديل** على منطق حساب الزيادة/الخصم في `profits` (يعمل بشكل صحيح).
- **لا دوال جديدة** لدفع المستحقات — فقط إصلاح الموجود.
- **لا تعديل** على `alwaseet-proxy` core (إرسال الطلبات/الهيدر/IP الثابت).
- **لا تعديل** على بنية `cash_movements` أو triggers مالية موجودة تعمل.

---

## الترتيب التنفيذي
1. **المرحلة 1** كاملة (مالية حرجة) ثم اختبار بفاتورة مستحقات حقيقية صغيرة.
2. **المرحلة 2** (توجيه الدومين).
3. **المرحلة 3** (الثورة التصميمية + لوحة متجري).

**هل أبدأ التنفيذ بهذا الترتيب؟**
