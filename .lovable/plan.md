

# خطة إصلاح شاملة: المنتجات، حركات النقد، الإشعارات، القائمة الجانبية، متابعة الموظفين

## المشاكل الجذرية المكتشفة

### 1. حركات النقد فارغة في قاصة سارة — **مشكلة RLS**
- الحركات موجودة فعلاً في DB (مصروف 5000 + شراء 1000)
- RLS policy على `cash_movements` SELECT تتطلب `is_financial_admin()` — وهذه الدالة تسمح فقط لـ `admin`, `super_admin`, `financial_admin`, `deputy_admin`
- سارة كـ `department_manager` محجوبة تماماً عن رؤية حركاتها
- **الحل:** إضافة RLS policy جديدة تسمح لصاحب القاصة برؤية حركات قاصته

### 2. "منتج تجربة" يظهر كـ "منتج النظام" رغم أنه ملك سارة
- `owner_user_id` في DB = سارة ✅
- المشكلة: `isMyProduct` يقارن `product.owner_user_id === userId` حيث `userId = currentUser?.id || currentUser?.user_id`
- إذا `currentUser.id` ≠ `currentUser.user_id`، المقارنة تفشل
- **الحل:** مقارنة مع كلا القيمتين

### 3. "جميع المنتجات" تظهر فارغة
- الكود يتحقق `currentUser.productPermissions.length === 0` — لكن `productPermissions` هو **object** وليس **array** (لا يملك `.length`)
- `undefined === 0` → `false` → يحاول `.map()` على object → يفشل صامتاً
- **الحل:** استخدام `filterProductsByPermissions` من `useAuth()` مباشرة

### 4. القائمة الجانبية — تسمية وترتيب
- "منتجاتي" يجب أن يصبح "إدارة المنتجات" وينتقل ليكون بعد "المنتجات" مباشرة

### 5. متابعة الموظفين لمدير القسم — dependency خاطئ
- سطر 97: `user?.user_id` بدل `user?.id` في dependency الـ useEffect — قد لا يعمل

### 6. فواتير شركات التوصيل لصاحب المركز المالي
- سارة ترى فواتير موظفيها في `EmployeeFollowUpPage` + فواتيرها الشخصية
- الأرباح من منتجاتها تدخل في قاصتها تلقائياً عبر trigger `record_order_revenue_on_receipt`
- متابعة الموظفين تحت إشرافها تعمل بنفس آلية المدير

---

## التنفيذ

### المرحلة 1: Migration — إصلاح RLS لحركات النقد
```sql
CREATE POLICY "cash_source_owner_can_view_movements"
ON public.cash_movements FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.cash_sources cs
    WHERE cs.id = cash_movements.cash_source_id
    AND cs.owner_user_id = auth.uid()
  )
);
```
هذا يسمح لسارة (وأي صاحب مركز مالي) برؤية حركات قاصتها فقط.

### المرحلة 2: إصلاح "منتجاتي" — `EmployeeProductsPage.jsx`
1. **`isMyProduct`**: مقارنة مع `currentUser?.id` و `currentUser?.user_id`
2. **`myProducts`**: نفس الإصلاح في filter
3. **`displayProducts` (جميع المنتجات)**: استخدام `filterProductsByPermissions` من `useAuth()`:
```js
const { filterProductsByPermissions } = useAuth();
// "جميع المنتجات" = منتجاتي + المنتجات المصرح بها
const allAllowed = useMemo(() => {
  const systemProducts = (products || []).filter(p => !p.owner_user_id || (p.owner_user_id !== user?.id && p.owner_user_id !== user?.user_id));
  const filtered = filterProductsByPermissions ? filterProductsByPermissions(systemProducts) : [];
  return [...myProducts, ...filtered];
}, [products, myProducts, filterProductsByPermissions]);
```

### المرحلة 3: إصلاح القائمة الجانبية — `Layout.jsx`
- سطر 55: تغيير `label: 'منتجاتي'` → `label: 'إدارة المنتجات'`
- نقل العنصر ليكون بعد `/products` مباشرة (سطر 49 بعد المنتجات)

### المرحلة 4: إصلاح dependency في `EmployeeFollowUpPage.jsx`
- سطر 97: تغيير `user?.user_id` → `user?.id`
- إضافة guard: إذا `isDepartmentManager && !isAdmin && supervisedEmployeeIds.length === 0` → لا تحسب إحصائيات (تجنب عرض بيانات النظام أثناء التحميل)

### المرحلة 5: إصلاح الإشعارات — `NotificationsContext.jsx`
- سطر 58: مدير القسم يستخدم `.in('user_id', allAllowedIds)` فقط بدون أي `user_id.is.null` ✅ (هذا تم إصلاحه سابقاً)
- التأكد أن الإصلاح يعمل فعلاً — الكود الحالي في سطر 58 يستخدم `.in()` بدون null

---

## الملفات المتأثرة

| الملف | التعديل |
|-------|---------|
| Migration جديد | RLS policy لحركات النقد لصاحب القاصة |
| `EmployeeProductsPage.jsx` | إصلاح isMyProduct + displayProducts |
| `Layout.jsx` | تسمية + ترتيب |
| `EmployeeFollowUpPage.jsx` | dependency + guard |

## بخصوص أسئلتك عن المركز المالي

### فواتير شركة التوصيل
- فواتير منتجات سارة تظهر في `EmployeeFollowUpPage` لأنها مديرة قسم وترى فواتير فريقها
- عند استلام فاتورة لطلب يحتوي منتج `owner_user_id = سارة`، الربح يُحسب ويدخل قاصتها تلقائياً عبر trigger `record_order_revenue_on_receipt`

### محاسبة الموظفين تحت إشرافها
- صفحة "متابعة الموظفين" متاحة لمدير القسم (سطر 48 في Layout)
- يمكنها فلترة بموظف معين ورؤية طلباته ومستحقاته
- طلبات التحاسب تصلها فقط من موظفيها المشرف عليهم (تم إصلاحه في الخطة السابقة)
- عند تسوية مستحقات موظف → المبلغ يُخصم من قاصتها

### المنتج لأي موظف يعود
- النظام يتعرف عبر `owner_user_id` في جدول `products`
- عند البيع: إذا المنتج ملك سارة، طلب التحاسب يذهب إليها وليس للمدير العام
- الخصم يتم من قاصتها (`cash_source.owner_user_id = سارة`)

