

# خطة إصلاح جذرية شاملة

## المشاكل الجذرية المكتشفة بعد فحص الكود

### 1. مستحقات مدفوعة 587,000 (تسرب بيانات النظام)
**السبب الحقيقي:** في `EmployeeFollowUpPage.jsx` سطر 841، الشرط `isDepartmentManager && !isAdmin && supervisedEmployeeIds?.length > 0` يفشل أثناء التحميل لأن `supervisedEmployeeIds` تبدأ كمصفوفة فارغة `[]`. هذا يُسقط التنفيذ إلى فرع `else` (سطر 867) الذي يحسب المستحقات من `expenses` النظامية الكاملة. كذلك في فلتر `settlementInvoices` يُقارن `si.employee_id` مباشرة بينما الحقل الفعلي هو `si.data?.employee_id` (مخزن داخل JSON).

**الحل:**
- إضافة حالة تحميل `supervisedLoaded` منفصلة عن `supervisedEmployeeIds.length`
- عندما يكون مدير قسم: إرجاع `0` دائماً حتى يكتمل تحميل `supervisedEmployeeIds`
- تصحيح المقارنة من `si.employee_id` إلى `si.data?.employee_id`

### 2. تفاصيل العملاء (طلبات 0، مشتريات 0)
**السبب:** `ordersByPhone` مبني من `eligibleOrdersByUser` الذي يفلتر بـ `created_by` مقابل `authUser.id/user_id`. المشكلة أن الطلبات المكتملة ربما أُنشئت بواسطة موظف آخر (ليس المستخدم الحالي)، فتكون المطابقة فارغة. العميل لديه نقاط (من `customer_phone_loyalty` المفلتر بـ RLS) لكن طلباته أُنشئت بواسطة موظفين آخرين.

**الحل:**
- `ordersByPhone` يجب أن يُبنى من `eligibleOrders` (كل الطلبات المؤهلة) وليس `eligibleOrdersByUser`
- الفلترة تكون على مستوى العميل (أي عميل له طلبات في النظام) وليس على مستوى منشئ الطلب
- التصفية حسب المستخدم تبقى على مستوى **العملاء** (من أنشأ سجل العميل) وليس **الطلبات**

### 3. تحليل أرباح المنتجات (رقم النظام + موظفين خارج الإشراف)
**السبب الأول:** كارت "تحليل أرباح المنتجات" في `EmployeeFinancialCenterPage.jsx` يحسب من `myOrders` الذي يشمل طلبات أنشأها الموظف نفسه + طلبات تخص منتجاته. لكن `myOrders` يحسب على أساس `orders` من `useInventory()` الذي قد يجلب جميع الطلبات.

**السبب الثاني:** صفحة `AdvancedProfitsAnalysisPage.jsx` تعرض قائمة `employees` من `useAdvancedProfitsAnalysis` التي تجلب جميع الموظفين النشطين (سطر 64-68) بدون أي فلترة حسب الإشراف. فمدير القسم يرى كل الموظفين ويختار أي واحد.

**الحل:**
- `useAdvancedProfitsAnalysis`: عند وجود `filters.employee` من URL (مدير مركز)، فلترة قائمة الموظفين لتشمل فقط: المدير نفسه + موظفيه المشرف عليهم
- إضافة `supervisedEmployeeIds` كمدخل أو جلبه داخل الهوك
- الكارت في `EmployeeFinancialCenterPage` يعدّ فقط الطلبات التي تحتوي منتجات `owner_user_id` وليس كل `myOrders`

### 4. إدارة الأرباح - المنتجات لا تظهر في المنسدلة
**السبب:** في `DepartmentManagerSettingsPage.jsx` سطر 64-78، الجلب يحضر كل المنتجات النشطة ثم يفلتر بـ `owner_user_id`. لكن المقارنة `p.owner_user_id === userId` حيث `userId = user?.id || user?.user_id` قد لا تطابق إذا كان `owner_user_id` محفوظ بـ UUID مختلف عن `user.id`. كذلك يضيف منتجات النظام (`!p.owner_user_id`) ما يخلط البيانات.

**الحل:**
- استخدام مجموعة `Set` للمقارنة الثنائية: `user.id` و `user.user_id`
- إزالة منتجات النظام من المنسدلة (مدير القسم يدير فقط منتجاته)
- أو فصل منتجات النظام في مجموعة مميزة إذا كان مطلوباً السماح بقواعد عليها

---

## الملفات التي ستُعدل

| الملف | التعديل |
|-------|---------|
| `EmployeeFollowUpPage.jsx` | إصلاح تسرب paidDues: إضافة guard تحميل + تصحيح `si.data?.employee_id` |
| `CustomersManagementPage.jsx` | بناء `ordersByPhone` من `eligibleOrders` بدل `eligibleOrdersByUser` |
| `useAdvancedProfitsAnalysis.js` | فلترة قائمة الموظفين حسب الإشراف عند تواجد employee filter |
| `AdvancedProfitsAnalysisPage.jsx` | تمرير supervisedEmployeeIds وتقييد الموظفين المعروضين |
| `DepartmentManagerSettingsPage.jsx` | إصلاح مقارنة owner_user_id بمجموعة ثنائية |
| `EmployeeFinancialCenterPage.jsx` | حساب كارت التحليل من منتجات owner_user_id فقط |

---

## معايير القبول
1. مستحقات مدفوعة = 0 إذا لم يوجد تسويات لموظفين تحت الإشراف
2. تفاصيل العميل تعرض طلباته ومشترياته الحقيقية
3. تحليل أرباح المنتجات يعرض فقط منتجات المالك المالي
4. قائمة الموظفين في التحليل تعرض فقط المشرف عليهم
5. منسدلة المنتجات في إدارة الأرباح تعرض منتجات مدير القسم فعلاً

