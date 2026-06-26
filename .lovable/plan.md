## تم تنفيذه فعلياً (قاعدة البيانات)

- ✅ **Trigger حماية order_type**: منع تحويل `return/exchange/replacement` إلى `partial_delivery` أو أي نوع آخر على مستوى DB (طبقة أمان أخيرة مهما حدث في الكود).
- ✅ **Trigger أرشفة تلقائية**: أي طلب `delivery_status='17'` + `receipt_received=true` يُؤرشَف فوراً (مع تصفير ربح الموظف إذا كان الطلب مرتجعاً كلياً).
- ✅ **إصلاح الطلبات الأربعة**: 144260128 / 125092578 / 144908817 / 144908511 — كلها الآن `isarchived=true`.
- ✅ **تثبيت 149776372**: `order_type='return'` و `total_amount=-20000` و `sales_amount=-25000`.

## المتبقّي (تعديلات واجهة فقط)

### 1) إعادة تلوين `EmployeeReservationsDialog.jsx` بالوردي/البنفسجي

تغيير ألوان الرأس والأزرار والـ blobs من `primary/accent` العام إلى تدرّج `pink-500 → fuchsia-500 → purple-600` المطابق لنافذة "تقرير أرباح الفواتير":

- **الرأس**: خلفية `from-pink-500/15 via-fuchsia-500/10 to-purple-600/15`، أيقونة القفل بتدرّج وردي/بنفسجي، العنوان بـ `bg-clip-text` متدرّج.
- **القوائم المنسدلة** (الموظفين/المنتجات): إطار `fuchsia-500/40` و `pink-500/40` عند الـ hover.
- **جدول المتغيرات**: شريط أعلى `from-pink-500/15 via-fuchsia-500/10 to-purple-600/15`.
- **زر "حجز الكل"**: `bg-gradient-to-l from-pink-500 via-fuchsia-500 to-purple-600`.
- إبقاء البنية الزجاجية الداكنة وكل قرارات السكرول السابقة (تفتح القوائم فوق النافذة بشكل صحيح، لا تغيير).

### 2) تحصين ظهور زر "حجز كميات للموظفين" في `ManageProductsPage.jsx`

السبب الأرجح لعدم رؤيته لأحمد: مقارنة `owner_user_id === uid` تفشل أحياناً بسبب اختلاف نوع/تمثيل UUID أو `user_id` غير معبأ لحظياً. الإصلاح الجذري:

- مطابقة نصية صارمة `String(p.owner_user_id) === String(uid)`.
- التقاط استثناءات `hasPermission` (إن لم يكن مُهيّأ بعد).
- بقاء الاعتماد على `products` الخام من `useInventory` (لا تمر عبر `useFilteredProducts`).

```jsx
const uid = user?.user_id || user?.id;
const uidStr = uid ? String(uid) : null;
const isOwnerOrAdmin = useMemo(() => {
  if (isAdmin || isDepartmentManager) return true;
  try { if (hasPermission && hasPermission("manage_products")) return true; } catch {}
  if (!Array.isArray(products) || !uidStr) return false;
  return products.some(p => p?.owner_user_id && String(p.owner_user_id) === uidStr);
}, [isAdmin, isDepartmentManager, hasPermission, products, uidStr]);
```

### 3) ملاحظة سياسية مؤكَّدة

- **أرباح الموظف من التسليم الجزئي**: تُحسب فقط على القطع **المباعة فعلاً**، لا على المرتجع (السلوك الحالي صحيح ولن يُمَس).
- **تغيّر السعر في طلب الإرجاع**: مسموح بمزامنته من شركة التوصيل، لكن `order_type` محمي مطلقاً (DB trigger الآن يفرض ذلك مهما حصل).

### بعد التطبيق

- بناء وفحص الواجهة، ثم التقاط لقطة لصفحة "إدارة المنتجات" بحساب أحمد للتأكد من ظهور الزر الوردي/البنفسجي.

ملفّان فقط متأثّران:
- `src/components/manage-employees/EmployeeReservationsDialog.jsx`
- `src/pages/ManageProductsPage.jsx`