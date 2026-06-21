
## المحاور الأربعة

### 1) توحيد أرقام "أرباحي من الموظفين" (الكرت = النافذة)

**المشكلة:** الكرت الخارجي يعرض 566,500 بينما النافذة تعرض 466,500. المستحقات المدفوعة مختلفة أيضاً. السبب: مصدران مختلفان للبيانات.

**الحل:**
- استخدام مصدر بيانات **واحد موحد** لكلا العرضين: استعلام مباشر من جدول `profits` + `orders` + `order_items` مفلتر حسب `products.owner_user_id = currentUser.id`.
- الصيغة الموحّدة (لكل مالك منتج):
  - **إجمالي أرباحي** = Σ (سعر بيع المنتج المملوك − تكلفة المنتج المملوك − ربح الموظف الفعلي للسطر) عبر كل order_items التي owner_user_id = أنا، فقط للطلبات المُسلَّمة (delivery_status='4').
  - **الأرباح المعلقة** = نفس الصيغة لكن للطلبات غير المُسلَّمة أو غير المُسوّاة.
  - **المستحقات المدفوعة** = Σ `settlement_invoices.total_amount` حيث `owner_user_id = أنا` AND status='completed'.
  - **هامش الربح** = إجمالي الأرباح / إجمالي إيراد المنتجات المملوكة (بدون توصيل).
- إنشاء دالة DB واحدة `get_manager_profits_summary(p_owner_id uuid, p_from, p_to)` ترجع كل الأرقام مرة واحدة، يستهلكها كل من الكرت الخارجي والنافذة.

### 2) عرض رقم التتبع بدل رقم الطلب المحلي

- في `ManagerProfitsDialog` تبويب "تفاصيل الطلبات": استبدال `order_number` (ORD001633) بـ `tracking_number` كعنوان رئيسي، مع `order_number` كنص ثانوي صغير.

### 3) تبويب "تفاصيل الموظفين" - تجميع كل الموظفين

- المشكلة: لا يظهر سوى موظف واحد بدون تمرير.
- إصلاح التجميع: `GROUP BY employee_id` على كل order_items لمنتجات المالك، عرض قائمة قابلة للتمرير (max-height + overflow-y-auto) لكل الموظفين الذين باعوا منتجات المالك، مع إجمالي ربح الموظف وعدد الطلبات لكل واحد.

### 4) خصوصية "تقرير أرباح الفواتير" للموظفين

- في `InvoiceProfitsTab.jsx` (وأي مكون مشابه): فحص صارم `isOwner = (product.owner_user_id === currentUser.id) || isAdmin`.
- إذا الموظف **ليس مالكاً ولا أدمن**: إخفاء كامل لـ:
  - تكلفة المنتج
  - ربح المالك / ربح النظام
  - صافي ربح المالك
  - أي عمود يحتوي cost/owner_profit/system_profit
- يظهر له فقط: رقم الفاتورة، رقم التتبع، عدد المنتجات، **ربحه الشخصي فقط**، التاريخ، الحالة.
- استخدام `<PermissionGate>` أو شرط ternary صريح لكل خلية حساسة.

### 5) إعادة تصميم نافذة "حجز كميات للموظفين" (Glass Liquid)

**التصميم:**
- خلفية: `backdrop-blur-2xl` + تدرج زجاجي `bg-gradient-to-br from-white/10 via-primary/5 to-secondary/10`
- حواف رفيعة ملوّنة متحركة: border gradient animation (conic-gradient rotating)
- Glassmorphism مع inner glow + shimmer effect
- ظلال ناعمة `shadow-[0_8px_32px_rgba(31,38,135,0.37)]`
- زر الحجز: gradient liquid مع hover ripple

**الوظائف الجديدة (Multi-Select):**
- اختيار **عدة موظفين** دفعة واحدة (multi-select chips)
- اختيار **عدة منتجات** دفعة واحدة (searchable multi-select)
- لكل منتج: تحديد **عدة ألوان وقياسات** مع كمية لكل توليفة
- جدول معاينة قبل التأكيد يعرض كل التركيبات (موظف × منتج × لون × قياس × كمية)
- زر "حجز الكل" يُنفذ كل العمليات في معاملة واحدة (DB transaction عبر RPC)

**الصلاحيات:**
- المشكلة الحالية: الزر يظهر فقط للمدير العام.
- الحل: الزر يظهر لـ:
  - المدير العام (يرى كل المنتجات + كل الموظفين)
  - **مالك المنتجات** (يرى فقط منتجاته + الموظفين تحت إشرافه)
- تحديث منطق الفلترة في `EmployeeReservationsDialog`:
  - المنتجات: `products.owner_user_id = currentUser.id` (للمالك) أو الكل (للأدمن)
  - الموظفين: من `employee_supervisors` حيث `supervisor_id = currentUser.id` (للمالك) أو الكل (للأدمن)
- تحديث شرط ظهور الزر في `ManageProductsPage` ليشمل أي مستخدم لديه منتجات يملكها.

---

## التفاصيل التقنية (للمراجعة)

**ملفات سيتم تعديلها:**
- `src/components/shared/ManagerProfitsCard.jsx` - استخدام المصدر الموحد
- `src/components/profits/ManagerProfitsDialog.jsx` - رقم التتبع + تمرير الموظفين + المصدر الموحد
- `src/components/profits/InvoiceProfitsTab.jsx` - إخفاء الحقول الحساسة للموظفين
- `src/components/manage-employees/EmployeeReservationsDialog.jsx` - إعادة تصميم كاملة + multi-select
- `src/pages/ManageProductsPage.jsx` - شرط ظهور الزر لمالكي المنتجات

**Migration جديدة:**
- `get_manager_profits_summary(uuid, date, date)` - دالة موحّدة ترجع: total_profit, pending_profit, paid_settlements, margin, employees_breakdown, orders_breakdown
- RPC `bulk_create_employee_reservations(jsonb)` - إنشاء عدة حجوزات في معاملة واحدة
- RLS على `employee_product_reservations` للسماح لمالك المنتج بإنشاء/قراءة حجوزات منتجاته

**التحقق بعد التنفيذ:**
1. كرت "أرباحي من الموظفين" = إجمالي النافذة (نفس الرقم بالضبط)
2. المستحقات المدفوعة في الكرت = في النافذة = `settlement_invoices` المفلترة بـ owner_user_id
3. تبويب الموظفين يعرض كل الموظفين الذين باعوا منتجات أحمد قابلين للتمرير
4. حساب حساب موظف عادي (مثل عبدالله) لتقرير أرباح الفواتير → لا يرى تكلفة ولا ربح مالك
5. تسجيل دخول كمالك منتج (أحمد) → زر "حجز كميات" يظهر ويفلتر منتجاته فقط
