

# خطة شاملة لإصلاح 7 مشاكل + مناقشة بوت التليغرام

---

## المشاكل والحلول

### 1. إدارة العملاء: عرض عملاء الموظف الحقيقيين فقط (من طلباته المكتملة)

**المشكلة:** `ordersByPhone` يُبنى من `eligibleOrders` (كل الطلبات المؤهلة في النظام)، و`myCustomers` يقبل أي عميل له طلب في النظام بأي موظف. النتيجة: كل الموظفين يرون كل العملاء.

**الحل في `CustomersManagementPage.jsx`:**
- بناء `ordersByPhone` من `eligibleOrdersByUser` (طلبات المستخدم الحالي فقط) بدلاً من `eligibleOrders`
- إلغاء `myCustomers` الحالي واستبداله بفلتر مباشر: العميل يظهر فقط إذا كان لديه طلبات مكتملة أنشأها هذا الموظف
- حتى المدير العام يرى فقط عملاء طلباته هو

**عرض رقم التتبع في تفاصيل العميل:**
- في `CustomerDetailsDialog.jsx` سطر 235: تغيير `order.order_number` إلى `order.tracking_number || order.order_number`

### 2. إدارة الأرباح: إظهار منتجات الموظف + منتجات النظام المصرح بها

**المشكلة:** `DepartmentManagerSettingsPage.jsx` يفلتر فقط منتجات `owner_user_id` (المملوكة مالياً). يتجاهل منتجات النظام التي لدى الموظف صلاحية عليها.

**الحل:**
- جلب المنتجات المملوكة مالياً (`owner_user_id` = user)
- جلب المنتجات المصرح بها من `employee_allowed_products` حيث `employee_id` = أحد الموظفين تحت الإشراف أو user نفسه
- جلب منتجات النظام (`owner_user_id IS NULL`) التي لها صلاحيات للموظفين المشرف عليهم
- دمج القائمتين مع إزالة التكرار

### 3. تحليل أرباح المنتجات: تقييد قائمة الموظفين

**المشكلة:** `AdvancedProfitsAnalysisPage.jsx` يعرض كل الموظفين النشطين في الـ dropdown حتى لو كان المستخدم مدير قسم. النتائج تعرض أرباح النظام لا أرباح المنتجات المملوكة.

**الحل في `AdvancedProfitsAnalysisPage.jsx`:**
- عند وجود `employeeFromUrl` (مدير مركز): تصفية `employees` لتعرض فقط المدير نفسه + موظفيه
- استخدام `supervisedScope` الموجود في `useAdvancedProfitsAnalysis.js` لتقييد القائمة المعروضة

**الحل في `useAdvancedProfitsAnalysis.js`:**
- إرجاع `supervisedScope` كقيمة من الهوك
- في الصفحة، فلترة `employees` بناءً على `supervisedScope` إذا كان موجوداً

### 4. حركة إرجاع المصروف تظهر بالإنجليزية

**المشكلة:** في `EmployeeFinancialCenterPage.jsx` سطر 532-538، خريطة الترجمة لا تتضمن `expense_refund`. في `CashMovementsList.jsx` سطر 68 أيضاً لا يوجد.

**الحل:**
- إضافة `'expense_refund': 'إرجاع مصروف محذوف'` في كلا الملفين:
  - `CashMovementsList.jsx` → `getMovementTypeLabel`
  - `EmployeeFinancialCenterPage.jsx` → خريطة reference_type

### 5. فواتير شركة التوصيل تدخل لقاصة مالك المنتج

**المشكلة (مناقشة):** هذا يعتمد على دالة `record_order_revenue_on_receipt` في قاعدة البيانات. يجب التحقق أن هذه الدالة تحدد `cash_source_id` بناءً على `owner_user_id` من المنتج في الطلب.

**الحل:** فحص الدالة في قاعدة البيانات والتأكد من أن الربط الصحيح موجود. إذا لم يكن، تعديل الدالة لتوجيه الإيراد إلى قاصة المالك.

### 6. تسجيل الدخول وحفظ الجلسة

**الوضع الحالي:** `persistSession: true` و `autoRefreshToken: true` مفعلان في `src/integrations/supabase/client.ts`. Supabase يحفظ الجلسة في `localStorage` ويجددها تلقائياً. الجلسة تبقى صالحة ما دام `refresh_token` صالحاً (افتراضياً في Supabase = **90 يوم**). لا يوجد مشكلة تقنية — إذا كان يُطلب تسجيل دخول متكرر، قد يكون المتصفح يمسح `localStorage` أو هناك خطأ في استرجاع الجلسة.

### 7. إدارة الموظفين والأرباح بمستوى المدير

**المشكلة:** تبويب "الموظفين" في `DepartmentManagerSettingsPage.jsx` يعرض فقط قائمة بسيطة (اسم + كود). بينما `ManageEmployeesPage.jsx` يوفر grid/table view + إحصائيات + تعديل + فريق.

**الحل:**
- إضافة مكونات من `ManageEmployeesPage` (الإحصائيات، أزرار التعديل، عرض التفاصيل) إلى تبويب الموظفين
- لكن مع تقييد البيانات إلى `supervisedEmployees` فقط
- إضافة حوارات `UnifiedEmployeeDialog` و`UpdateRolePermissionsDialog` و`TeamManagementDialog`

---

## حول بوت التليغرام - مناقشة

**سؤال 1: نظام "هل تقصد؟" للمنتجات**
نظام "هل تقصد؟" موجود بالفعل **للمناطق** فقط. لا يوجد نظام مماثل للمنتجات. الفكرة ممتازة وعملية. أقترح:
- عند عدم تطابق المنتج: عرض أزرار inline بأقرب 3-5 منتجات (مثل المناطق تماماً)
- إذا كان التطابق جزئياً (ثقة أقل من 90%): عرض "هل تقصد [المنتج]؟ نعم / لا"
- هذا يتطلب تعديل `telegram-bot/index.ts` وإضافة callback handler جديد مثل `product_select_`

**سؤال 2: توسيع المنتجات الذكي (برشلونة أسود + أبيض اكس)**
هذه الميزة **غير موجودة حالياً**. الباسر الحالي يعالج كل سطر منتج كعنصر واحد. إضافة هذه الميزة ممكنة لكنها معقدة وتحتاج:
- تحليل الـ `+` كفاصل بين ألوان/مقاسات
- اكتشاف السياق: هل الـ `+` يعني لون جديد لنفس المنتج أم منتج جديد
- 3 حالات مختلفة (لون+لون، مقاس+مقاس، منتج+منتج) تحتاج منطق مختلف

**توصيتي:** البدء بنظام "هل تقصد؟" للمنتجات أولاً (أسهل وأكثر فائدة فورية)، ثم العمل على التوسيع الذكي كمرحلة ثانية.

---

## الملفات المستهدفة

| الملف | التعديل |
|-------|---------|
| `CustomersManagementPage.jsx` | بناء `ordersByPhone` من طلبات المستخدم فقط |
| `CustomerDetailsDialog.jsx` | عرض `tracking_number` بدلاً من `order_number` |
| `DepartmentManagerSettingsPage.jsx` | إضافة منتجات النظام المصرح بها + تطوير تبويب الموظفين |
| `AdvancedProfitsAnalysisPage.jsx` | تقييد dropdown الموظفين بنطاق الإشراف |
| `useAdvancedProfitsAnalysis.js` | إرجاع `supervisedScope` من الهوك |
| `EmployeeFinancialCenterPage.jsx` | ترجمة `expense_refund` |
| `CashMovementsList.jsx` | ترجمة `expense_refund` |

