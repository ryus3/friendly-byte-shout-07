
## الإصلاحات المطلوبة - 7 مشاكل مكتشفة

### 1. نقل ملكية منتجات "نسائي" إلى سارة (Migration)
المنتجات التي owner_user_id = NULL في تصنيف نسائي:
- ترانش طويل، سوت مايسترو، سوت شيك، سكارف، بلوز بقلاوه، سوت جنز

Migration SQL:
```sql
UPDATE products SET owner_user_id = 'f10d8ed9-24d3-45d6-a310-d45db5a747a0'
WHERE id IN (SELECT DISTINCT pc.product_id FROM product_categories pc 
  JOIN categories c ON c.id = pc.category_id WHERE c.name = 'نسائي')
AND owner_user_id IS NULL;
```

### 2. منسدلة "مصدر الأموال" لا تفتح لسارة
**السبب**: `useCashSources.js` سطر 17 يفلتر `.is('owner_user_id', null)` فلا تظهر قاصة سارة.
**الحل**: إزالة فلتر `owner_user_id IS NULL` من `fetchCashSources` وجلب كل القاصات النشطة. الفلترة تتم في الواجهة عبر `filterByOwnerUserId`.

### 3. مدير القسم يعطي دور "مدير عام" - كارثة أمنية
**السبب**: `UnifiedRoleManager.jsx` يعرض كل الأدوار بدون تقييد.
**الحل**:
- إضافة prop `maxAllowedLevel` لـ `UnifiedRoleManager`
- في `UnifiedEmployeeDialog` تمرير `maxAllowedLevel` بناءً على دور المتصل
- فلترة `availableRoles` في العرض: `availableRoles.filter(r => !maxAllowedLevel || r.hierarchy_level >= maxAllowedLevel)`
- مدير القسم (level 2) يرى فقط level >= 3 (sales, warehouse, cashier, delivery)

في `UnifiedEmployeeDialog.jsx`:
- استيراد `usePermissions` والحصول على `isDepartmentManager`
- تمرير `maxAllowedLevel={isDepartmentManager ? 3 : undefined}` لـ `UnifiedRoleManager`

### 4. قواعد الأرباح لا تُنشأ/تظهر لمدير القسم
**السبب**: جلب القواعد يستخدم `.or(created_by.eq....)` مما يحصر النتائج بالقواعد التي أنشأها المدير فقط.
**الحل** في `DepartmentManagerSettingsPage.jsx`:
- إزالة فلتر `.or(created_by...)` من سطري 173 و 245
- الإبقاء على `.in('employee_id', supervisedEmployeeIds)` فقط - كافٍ لضمان العزل
- إضافة console.error وتشخيص واضح عند فشل الإدراج

### 5. نقاط العملاء تظهر 0
**السبب**: النقاط تأتي من `customer_phone_loyalty` عبر `loyaltyMatch` لكن RLS يحصر بـ `created_by = auth.uid()`. إذا لم يوجد سجل ولاء، النقاط = 0.
**الحل** في `CustomersManagementPage.jsx`:
- حساب النقاط مباشرة من الطلبات: `Math.floor(spentNoDelivery / 1000)` (1 نقطة لكل 1000 د.ع)
- تغيير `total_points: loyaltyMatch?.total_points || 0` إلى `total_points: loyaltyMatch?.total_points || Math.floor(spentNoDelivery / 1000)`

### 6. صلاحيات المنتجات - تأكيد
نعم كلامك صحيح: الموظف يمكن أن يحصل على صلاحيات من مصدرين:
- من النظام (المدير العام)
- من مدير القسم
كلاهما يكتبان في `employee_allowed_products` ويتراكمان. هذا التصميم سليم.

### 7. أداة نقل ملكية المنتجات للمدير + تحديد مالك في المشتريات
- إضافة حوار "نقل الملكية" في صفحة إدارة المنتجات يسمح بتحديد منتجات ونقلها لمالك جديد
- إضافة حقل "المالك المالي" اختياري في `AddPurchaseDialog` للمدير

## ترتيب التنفيذ
1. Migration: نقل ملكية منتجات نسائي لسارة
2. إصلاح `useCashSources.js` (إزالة فلتر owner_user_id IS NULL)
3. تقييد أدوار `UnifiedRoleManager` (إضافة maxAllowedLevel)
4. إصلاح جلب قواعد الأرباح (إزالة فلتر created_by)
5. حساب نقاط العملاء من الطلبات
6. أداة نقل الملكية + تحديد المالك في المشتريات

### تفاصيل تقنية
- الملفات المتأثرة: `useCashSources.js`, `UnifiedRoleManager.jsx`, `UnifiedEmployeeDialog.jsx`, `DepartmentManagerSettingsPage.jsx`, `CustomersManagementPage.jsx`, `AddPurchaseDialog.jsx`
- Migration واحدة لنقل الملكية
- لا تغييرات في بنية الجداول - فقط تحديث بيانات وكود واجهة
