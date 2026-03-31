

# خطة إصلاح: تقرير الأرباح، عزل البيانات، قواعد أرباح مدير القسم

## المشاكل المكتشفة

### 1. تقرير الأرباح والخسائر — المشتريات مُضمنة دائماً بدون خيار
الصفحة `EmployeeFinancialCenterPage.jsx` تخصم المشتريات دائماً من صافي الربح (سطر 258). الـ `ProfitLossDialog` لا يعرض صف المشتريات ولا يدعم التبديل. المطلوب: تبويب صغير "مع المشتريات / بدون المشتريات" في تقرير الأرباح والخسائر.

### 2. كارت "تحليل أرباح المنتجات" يعرض 263 طلب (بيانات النظام)
في `EmployeeFinancialCenterPage.jsx` سطر 354: `myOrders.filter(...)` — `myOrders` يُفلتر بـ `created_by === userId`. **لكن** `userId = currentUser?.id || currentUser?.user_id`. إذا `currentUser.id` لا يطابق `created_by` (الذي يستخدم `auth.uid()`), فيجب المقارنة بكلا القيمتين. الأغلب أن `myOrders` يعمل بشكل صحيح، والمشكلة أن الكارت يعرض عدداً من `orders` بدون فلترة. **التصحيح:** التأكد من أن الفلترة تتحقق من كلا `user.id` و `user.user_id`.

### 3. متابعة الموظفين — أرقام النظام (الأرشيف + المرتجعات)
- **`returnedOrdersCount`** (سطر 969): يفلتر فقط بـ `created_by !== ADMIN_ID` بدون فلترة `supervisedEmployeeIds` لمدير القسم
- **`settledOrdersCount`** (سطر 937): يفلتر بـ `supervisedEmployeeIds` لكن يقبل أي شيء إذا `supervisedEmployeeIds.length === 0` (لا يوجد guard كافٍ)

### 4. قواعد أرباح مدير القسم — `rule_type: 'global'` خطأ
في `DepartmentManagerSettingsPage.jsx` سطر 129: `rule_type: newRule.product_id ? 'product' : 'global'`. القيمة `'global'` تنتهك constraint الـ DB (المسموح: `product`, `category`, `department`, `default`, `variant`, `product_type`). يجب تغييرها إلى `'default'`.

### 5. مدير القسم يحتاج إدارة صلاحيات المنتجات للموظفين
الصفحة الحالية (`DepartmentManagerSettingsPage`) تعرض فقط: الموظفين + قواعد الأرباح + الإحصائيات. ينقصها: التحكم بصلاحيات المنتجات (إظهار/إخفاء أقسام ومنتجات عن موظفين معينين).

### 6. الحذف التلقائي — تم تعطيل المسار الأخطر ✅
`syncOrderByTracking` سطر 4129 معطّل بالفعل (تم في الخطة السابقة). المسارات الأخرى (`syncVisibleOrdersBatch` و `syncOrderByQRGeneric`) تستخدم فحوصات متعددة.

### 7. المزامنة والتوكن بالخلفية
- `refresh-delivery-partner-tokens` (cron كل 6 ساعات) — يعمل مستقلاً عن المتصفح ✅
- `smart-invoice-sync` (cron صباح/مساء) — يعمل مستقلاً ✅

---

## التنفيذ

### المرحلة 1: إصلاح `ProfitLossDialog` — تبويب مع/بدون المشتريات
**ملف: `src/components/accounting/ProfitLossDialog.jsx`**
- إضافة state `includePurchases` مع toggle/tabs صغير
- إضافة صف "المشتريات" عند التفعيل
- تعديل عرض صافي الربح: `netProfit - (includePurchases ? totalPurchases : 0)`
- إضافة `totalPurchases` إلى `summary` prop

### المرحلة 2: إصلاح عدد "تحليل أرباح المنتجات" في المركز المالي
**ملف: `src/pages/EmployeeFinancialCenterPage.jsx`**
- تعديل `myOrders` filter ليتحقق من `o.created_by === userId || o.created_by === currentUser?.user_id || o.created_by === currentUser?.id`

### المرحلة 3: إصلاح `returnedOrdersCount` في متابعة الموظفين
**ملف: `src/pages/EmployeeFollowUpPage.jsx`**
- إضافة فلترة `supervisedEmployeeIds` لـ `returnedOrdersCount` (سطر 969):
```js
const returnedOrdersCount = orders?.filter(o => {
  if (o.delivery_status !== '17') return false;
  if (o.created_by === ADMIN_ID) return false;
  if (isDepartmentManager && !isAdmin) {
    if (supervisedEmployeeIds.length === 0) return false;
    if (!supervisedEmployeeIds.includes(o.created_by)) return false;
  }
  return true;
}).length || 0;
```

### المرحلة 4: إصلاح `rule_type` في إعدادات القسم
**ملف: `src/pages/DepartmentManagerSettingsPage.jsx`**
- تغيير `'global'` → `'default'` في سطر 129

### المرحلة 5: إضافة تبويب "صلاحيات المنتجات" لإعدادات القسم
**ملف: `src/pages/DepartmentManagerSettingsPage.jsx`**
- إضافة تبويب رابع "صلاحيات المنتجات" في `TabsList` (4 أعمدة بدل 3)
- واجهة تسمح لمدير القسم بـ:
  - اختيار موظف من قائمة الموظفين المشرف عليهم
  - تحديد المنتجات/الأقسام/الأنواع المسموحة لهذا الموظف
  - حفظ في `product_permissions` أو جدول مناسب
- جلب المنتجات الخاصة بمدير القسم (`owner_user_id = userId`) + منتجات النظام
- إمكانية تفعيل/تعطيل منتج معين أو قسم كامل لموظف

### المرحلة 6: تمرير `totalPurchases` لـ `ProfitLossDialog` من المركز المالي
**ملف: `src/pages/EmployeeFinancialCenterPage.jsx`**
- تأكيد أن `unifiedProfitData` يتضمن `totalPurchases` (موجود بالفعل عبر `...financialStats`)

---

## الملفات المتأثرة

| الملف | التعديل |
|-------|---------|
| `ProfitLossDialog.jsx` | تبويب مع/بدون مشتريات + صف المشتريات |
| `EmployeeFinancialCenterPage.jsx` | إصلاح فلترة myOrders بالـ UUID |
| `EmployeeFollowUpPage.jsx` | إصلاح returnedOrdersCount + settledOrdersCount |
| `DepartmentManagerSettingsPage.jsx` | إصلاح rule_type + إضافة تبويب صلاحيات |

