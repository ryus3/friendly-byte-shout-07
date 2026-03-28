

# خطة إصلاح شاملة: الإشعارات، المنتجات، القاصات، العزل المالي

## المشاكل المكتشفة

### 1. إشعارات النظام تصل لمدير القسم (سارة)
**السبب:** في `NotificationsContext.jsx` سطر 58، مدير القسم يستقبل إشعارات `user_id = null` باستثناء قائمة محددة. لكن أنواع مثل `new_ai_order` و `alwaseet_status_change` غير مشمولة في قائمة الاستثناء، فتمر إليه.
كذلك في الـ realtime handler (سطر 141-143): نفس المشكلة — الأنواع غير المدرجة في `adminOnlyGlobalTypes` تظهر للموظفين.

**الحل:** مدير القسم لا يرى أي إشعار عام (`user_id = null`). يرى فقط إشعاراته الشخصية + إشعارات موظفيه المشرف عليهم.

### 2. منتجاتي تظهر فارغة رغم وجود منتج "تجربة"
**السبب:** المنتج "تجربة" `created_by = المدير العام` وليس سارة. لا يوجد حقل `owner_user_id` في جدول `products` لتمييز المالك المالي عن المنشئ.

**الحل:** 
- إضافة عمود `owner_user_id` لجدول `products` (migration)
- تحديث منتج "تجربة" ليكون `owner_user_id = f10d8ed9...` (سارة)
- تغيير فلتر `EmployeeProductsPage` ليستخدم `owner_user_id` بدل `created_by`
- إضافة `owner_user_id` عند إنشاء منتج من صفحة الموظف

### 3. الرصيد النقدي للنظام يشمل قاصة سارة
**السبب:** `useCashSources.js` → `fetchCashSources` يجلب جميع القاصات النشطة بدون استثناء. `getTotalAllSourcesBalance` يجمعها كلها. فقاصة سارة (84f08ada...) تُحسب ضمن رصيد النظام.

**الحل:** فلترة القاصات في `useCashSources.js` لاستثناء القاصات التي `owner_user_id` ينتمي لمستخدم `has_financial_center = true`. أو الأفضل: استثناء القاصات التي لها `owner_user_id` مختلف عن المدير العام (أي القاصات الخاصة بالموظفين).

### 4. حركات النقد لا تظهر في قاصة سارة
**السبب محتمل:** الحركات موجودة فعلاً في قاعدة البيانات (تحققت: مصروف 5000 + شراء 1000). المشكلة في `EmployeeCashManagementPage` — الفلترة تبدو صحيحة. يجب فحص ما إذا كان `CashMovementsList` يتطلب join مع `cash_sources` أو حقول إضافية.

### 5. "جميع المنتجات" تعرض كل منتجات النظام
**الحل:** عند اختيار "جميع المنتجات"، يعرض فقط المنتجات المصرح بها عبر `productPermissions` من نظام الصلاحيات + منتجات الموظف. وليس حرفياً كل المنتجات.

### 6. المنتجات غير معلّمة بمالكها
**الحل:** إضافة badge يوضح لمن يعود المنتج (اسم المالك) في كل صفحات المنتجات (لدى المدير والموظف).

---

## التنفيذ

### المرحلة 1: Migration — إضافة `owner_user_id` للمنتجات
```sql
ALTER TABLE products ADD COLUMN owner_user_id UUID REFERENCES auth.users(id);
-- المنتجات الحالية تبقى NULL = تعود للنظام
-- تحديث منتج "تجربة" ليكون ملك سارة
UPDATE products SET owner_user_id = 'f10d8ed9-24d3-45d6-a310-d45db5a747a0' 
WHERE id = '73ab3f2a-04b6-4b9d-a728-c37fdff479ab';
```

### المرحلة 2: عزل الرصيد النقدي للنظام

**ملف: `src/hooks/useCashSources.js`**
- `fetchCashSources`: إضافة فلتر `.is.null('owner_user_id')` أو فلترة بعد الجلب لاستثناء القاصات المملوكة لموظفين (حيث `owner_user_id` ليس المدير العام ويوجد `owner_user_id`)
- `getTotalAllSourcesBalance` و `getTotalSourcesBalance`: تعمل على القاصات المفلترة تلقائياً

### المرحلة 3: إصلاح إشعارات مدير القسم

**ملف: `src/contexts/NotificationsContext.jsx`**
- سطر 58: مدير القسم يرى فقط `user_id.in.(supervisedIds + own id)` بدون أي `user_id.is.null`
- سطر 141-143 (realtime): إذا ليس admin، الإشعارات العامة (`user_id = null`) لا تظهر أبداً

### المرحلة 4: إصلاح صفحة منتجاتي

**ملف: `src/pages/EmployeeProductsPage.jsx`**
- `myProducts`: فلتر `p.owner_user_id === userId` (بدل `created_by`)
- "جميع المنتجات" → `filterProductsByPermissions(products)` من نظام الصلاحيات
- Badge يعرض اسم المالك على كل منتج
- عند إضافة منتج: تمرير `owner_user_id = userId`

### المرحلة 5: إصلاح حركات النقد في قاصة سارة

**ملف: `src/pages/EmployeeCashManagementPage.jsx`**
- التأكد من أن `CashMovementsList` يستقبل البيانات بالشكل الصحيح
- إضافة join مع `cash_sources` في query الحركات إذا كان المكون يتطلبه

### المرحلة 6: تمييز المنتجات بمالكها في صفحات المدير

**ملف: `ManageProductListItem.jsx` / `ManageProductCard.jsx`**
- إذا `owner_user_id` موجود وليس null، عرض Badge باسم المالك

---

## الملفات المتأثرة

| الملف | التعديل |
|-------|---------|
| Migration جديد | إضافة `owner_user_id` لجدول products |
| `useCashSources.js` | استثناء قاصات الموظفين من حسابات النظام |
| `NotificationsContext.jsx` | منع إشعارات النظام العامة لمدير القسم |
| `EmployeeProductsPage.jsx` | استخدام `owner_user_id` + صلاحيات المنتجات |
| `EmployeeCashManagementPage.jsx` | إصلاح عرض حركات النقد |
| `ManageProductListItem.jsx` | Badge مالك المنتج |
| `ManageProductCard.jsx` | Badge مالك المنتج |

