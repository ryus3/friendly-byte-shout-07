

# خطة إصلاح شاملة: المنتجات، المشتريات، القاصة، الإشعارات

## المشاكل المكتشفة

### 1. خطأ المشتريات: `null value in column "last_updated_by"`
في `updateInventory()` بملف `useImprovedPurchases.js` (سطر 467-496)، عند إنشاء سجل مخزون جديد (insert) لا يتم تمرير `last_updated_by`. الحقل مطلوب (NOT NULL) في جدول `inventory`.

### 2. المشتريات تعرض كل مصادر النقد
`AddPurchaseDialog` يستخدم `useCashSources()` الذي يجلب **جميع** القاصات النشطة بدون فلتر. الموظف يرى القاصة الرئيسية وقاصة الأعظمية.

### 3. صفحة منتجاتي ناقصة مقارنة بالمدير
- لا يوجد زر "إضافة منتج" يعمل (يوجه إلى `/products/add` العامة)
- لا يوجد "إدارة المتغيرات"
- لا يوجد QR/Barcode Scanner
- لا يوجد طباعة ملصقات
- لا يوجد تمييز بصري بين منتجات الموظف ومنتجات النظام
- لا يوجد تحديث الكاش (refresh)
- لا يوجد خيار إتاحة المنتج للنظام أو للموظفين تحت الإشراف

### 4. القاصة مصغرة وليست مثل المدير
`EmployeeCashManagementPage` مبسطة جداً — لا تحتوي على Tabs (مصادر النقد / حركات النقد / التحليلات) ولا CashSourceCard بالتصميم البرتقالي ولا إحصائيات فترية.

### 5. إشعارات النظام تظهر لسارة
`filterNotificationsByUser` يسمح بالإشعارات حيث `user_id === null` لمدراء الأقسام (`isDepartmentManager`). سارة كمديرة قسم ترى إشعارات عامة مثل طلبات التليغرام التي لا تخصها.

### 6. المصاريف مخصومة من رصيد النظام (ليس بحركة نقدية)
المصروف يظهر في إحصائيات النظام رغم أن الـ trigger يخصمه من قاصة سارة — مشكلة عرض وليست مشكلة مالية حقيقية (تم معالجتها سابقاً في AccountingPage).

---

## التنفيذ

### المرحلة 1: إصلاح خطأ المشتريات `last_updated_by`

**ملف: `src/hooks/useImprovedPurchases.js`** (سطر 486-496)
- إضافة `last_updated_by: userId` في insert الـ inventory
- تمرير `userId` إلى `updateInventory` في كل الحالات

### المرحلة 2: فلترة مصادر النقد في المشتريات

**ملف: `src/components/purchases/AddPurchaseDialog.jsx`**
- إضافة prop اختياري `employeeCashSourceId` أو `filterByOwner`
- عند فتحه من `EmployeePurchasesPage`، يتم تمرير userId للفلترة
- فلترة `cashSources` لعرض فقط القاصات التي `owner_user_id === userId`

**ملف: `src/pages/EmployeePurchasesPage.jsx`**
- تمرير `employeeUserId={userId}` إلى `AddPurchaseDialog`

### المرحلة 3: ترقية صفحة منتجاتي لتطابق المدير

**ملف: `src/pages/EmployeeProductsPage.jsx`** — إعادة بناء كاملة:
1. استخدام نفس `ManageProductsToolbar` مع كل الأزرار (إضافة، إدارة المتغيرات، QR، طباعة، عرض شبكة/قائمة)
2. زر "تحديث الكاش" (`refreshProducts`)
3. زر "إضافة منتج" يفتح نفس `/products/add` لكن المنتج يُنسب للموظف عبر `created_by`
4. إدارة المتغيرات تعمل (`/manage-variants`)
5. تمييز بصري: Badge "منتجي" (أخضر) vs "منتج النظام" (رمادي)
6. عرض منتجات الموظف + منتجات النظام المتاحة له (مع فلتر تبديل)
7. خيار "إتاحة للنظام" و"إتاحة لموظفيّ" عبر toggle في كل منتج
8. دعم Barcode Scanner، طباعة ملصقات، Select All، حذف جماعي
9. دعم `ManageProductListItem` و `ManageProductCard` بنفس التصميم

### المرحلة 4: ترقية القاصة لتطابق المدير حرفياً

**ملف: `src/pages/EmployeeCashManagementPage.jsx`** — إعادة بناء كاملة:
- نسخة مطابقة لـ `CashManagementPage` لكن مفلترة:
  - `cashSources` مفلترة بـ `owner_user_id === userId`
  - `cashMovements` مفلترة بنفس القاصات
- 3 Tabs: مصادر النقد | حركات النقد | التحليلات
- KPI cards: الرصيد الحالي، داخل اليوم، خارج اليوم، داخل الشهر، خارج الشهر
- `CashSourceCard` بالتصميم البرتقالي مع آخر الحركات وأزرار إضافة/سحب
- `CashMovementsList` كاملة مع فلاتر
- إمكانية إضافة مصدر نقد جديد (`AddCashSourceDialog`)
- التحليلات الفترية (يوم/أسبوع/شهر)
- توزيع الأرصدة حسب المصدر

### المرحلة 5: إصلاح الإشعارات

**ملف: `src/hooks/useUnifiedPermissionsSystem.jsx`** (سطر 173-192)
- الإشعارات حيث `user_id === null` (عامة) تظهر فقط للـ `isAdmin` وليس لمديري الأقسام
- مديرو الأقسام يرون فقط:
  - إشعاراتهم الشخصية
  - إشعارات الموظفين تحت إشرافهم (حسب `employee_supervisors`)

---

## الملفات المتأثرة

| الملف | التعديل |
|-------|---------|
| `useImprovedPurchases.js` | إصلاح `last_updated_by` NULL |
| `AddPurchaseDialog.jsx` | فلترة مصادر النقد بـ owner |
| `EmployeePurchasesPage.jsx` | تمرير userId للفلترة |
| `EmployeeProductsPage.jsx` | إعادة بناء كاملة مثل ManageProductsPage |
| `EmployeeCashManagementPage.jsx` | إعادة بناء كاملة مثل CashManagementPage |
| `useUnifiedPermissionsSystem.jsx` | تقييد الإشعارات العامة |

