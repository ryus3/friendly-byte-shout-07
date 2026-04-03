
المشاكل ما زالت واضحة من الكود الحالي، وسببها ليس شيئاً واحداً بل 4 فجوات رئيسية ما زالت موجودة:

1. متابعة الموظفين ما زالت تتسرّب لأن العزل في `EmployeeFollowUpPage.jsx` يعتمد على `settlementInvoices` القادمة من الـ inventory context، ثم يمررها إلى `SettledDuesDialog` الذي يعيد الجلب بنفسه من `settlement_invoices` بدون guard من نوع “Nothing if Empty”. كذلك المقارنة الحالية تعتمد غالباً على `employee_id` فقط، بينما المشروع كله يعاني من ازدواج `id/user_id`.
2. تفاصيل العملاء = 0 لأن `CustomersManagementPage.jsx` يبني `ordersByPhone` من `eligibleOrdersByUser` المعتمدة على `created_by` فقط، بينما الواقع عندكم أن بيانات العميل يجب أن تُحتسب من طلبات الهاتف المؤهلة، ومع مطابقة المستخدم بكلا المعرّفين عند الحاجة. لذلك تظهر النقاط من الولاء لكن الطلبات/المشتريات من مجموعة مختلفة.
3. تحليل أرباح المنتجات ما زال يسحب رقم النظام لأن `useAdvancedProfitsAnalysis.js` يفلتر بالموظف عبر `product.created_by` بدلاً من `product.owner_user_id`. لذلك صفحة التحليل ما تزال تعتبر منتجات النظام أو تستبعد منتجات مدير المركز الفعلية.
4. إدارة القسم ما زالت ناقصة في الأرباح والمنتجات لأن `DepartmentManagerSettingsPage.jsx` يجلب كل المنتجات النشطة بدون فلترة ملكية، وقواعد الأرباح مربوطة بـ `created_by = user.id` فقط، ما قد يخفي منتجات مدير القسم إذا كانت الملكية الفعلية مبنية على `owner_user_id` أو اختلاف `id/user_id`.

خطة التنفيذ الجذرية:

1. عزل “المستحقات المدفوعة” نهائياً
- توحيد مصدر بيانات المستحقات في `EmployeeFollowUpPage.jsx` و`SettledDuesDialog.jsx`.
- إضافة guard صارم:
  - إذا كان المستخدم مدير قسم و`supervisedEmployeeIds` ما زالت فارغة/قيد التحميل → القيم = 0 والقائمة فارغة.
  - عدم fallback إلى كل الفواتير أبداً.
- اعتماد مطابقة مزدوجة للموظف: `employee_id` مقابل `user.id` و`user.user_id`.
- تصفية الفواتير الحقيقية والقديمة legacy بنفس scope، وليس فقط `realSettlementInvoices`.
- منع ظهور أي فاتورة أو مستحقات لسارة نفسها داخل متابعة الموظفين.

2. إصلاح فواتير الموظفين تحت الإشراف فقط
- في `AllEmployeesInvoicesView.jsx`:
  - فلترة الموظفين والفواتير عبر كلا المعرفين `id/user_id`.
  - عدم استخدام `employeesData` الخام في الربط؛ استخدام القائمة المفلترة فقط.
  - منع ظهور فواتير المدير نفسه حتى لو كان له `owner_user_id`.
- في `useSupervisedEmployees.js`:
  - تعديل `filterNotifications` لإلغاء السماح بالإشعارات العامة `user_id = null` لمدير القسم في سياق المتابعة المالية.
  - جعل `allowedUserIds` و`canViewEmployeeData` تعملان على كلا الحقلين وليس واحداً فقط.

3. إصلاح العملاء بحيث لا تبقى الطلبات/المشتريات صفر
- في `CustomersManagementPage.jsx`:
  - بناء طلبات العميل من `eligibleOrders` حسب الهاتف أولاً، ثم قصرها على نطاق المستخدم عبر مطابقة `created_by` مع `authUser.id` و`authUser.user_id`.
  - توحيد مصدر:
    - `customer_loyalty.total_orders`
    - `customer_loyalty.total_spent`
    - `completedOrders`
    - `totalSalesWithoutDelivery`
    من نفس dataset الفعلية.
- عند فتح `CustomerDetailsDialog` يتم تمرير الطلبات المؤهلة نفسها المستعملة في الكرت، لا إعادة حساب مختلف.
- إذا كانت نقاط الولاء تاريخية ولا تطابق الطلبات الحالية، تبقى النقاط كما هي لكن الطلبات/المشتريات والتفاصيل تعتمد dataset الهاتف المؤهلة الصحيحة فقط.

4. إصلاح تحليل أرباح المنتجات لمدير المركز
- في `useAdvancedProfitsAnalysis.js`:
  - استبدال فلتر `product.created_by === filters.employee` بفلتر الملكية المالية `product.owner_user_id === filters.employee`.
  - دعم مطابقة ثنائية `owner_user_id` مع `id/user_id`.
  - إبقاء الطلب ضمن التحليل فقط إذا كان يحتوي منتجات يملكها ذلك المدير مالياً.
- في `EmployeeFinancialCenterPage.jsx`:
  - ربط كرت “تحليل أرباح المنتجات” بعدد الطلبات التي تحتوي منتجات `owner_user_id` الخاصة بمدير المركز فقط، وليس أي طلب للنظام.
  - التحقق أن الانتقال إلى `advanced-profits-analysis?employee=...` يمرر معرف الملكية الصحيح.

5. إصلاح إدارة القسم لتظهر منتجات المدير فعلاً
- في `DepartmentManagerSettingsPage.jsx`:
  - فلترة قائمة المنتجات إلى:
    - منتجات مدير القسم المملوكة له مالياً `owner_user_id`
    - ومنتجات النظام فقط إذا كان المطلوب السماح له بإدارة قواعد عليها.
  - عدم جلب كل منتجات النظام/الآخرين بلا scope.
  - تعديل جلب قواعد الأرباح ليعتمد على كلا المعرفين في `created_by`.
  - تصحيح نوع القاعدة:
    - `product` عند تحديد منتج
    - `general/default` عند “كل المنتجات”
    بشكل متوافق مع محرك الحساب الفعلي.
- إبقاء `ProductPermissionsManager` كواجهة الإدارة الكاملة، لكن تمرير scope منتجات مدير القسم فقط حتى تصبح مثل المدير ضمن نطاقه، لا على كامل النظام.

6. مراجعة نافذة رأس المال
- الكود يفتح `CapitalDetailsDialog` بالفعل داخل `EmployeeFinancialCenterPage.jsx`.
- سأراجع في التنفيذ props الممرّرة لها مقابل صفحة المدير (`AccountingPage.jsx`) وأجعلها تستخدم نفس البيانات/المعطيات الكاملة حتى تظهر بنفس التفصيل وليس بشكل ناقص.

الملفات التي يجب تعديلها:
- `src/pages/EmployeeFollowUpPage.jsx`
- `src/components/accounting/SettledDuesDialog.jsx`
- `src/components/orders/AllEmployeesInvoicesView.jsx`
- `src/hooks/useSupervisedEmployees.js`
- `src/pages/CustomersManagementPage.jsx`
- `src/components/customers/CustomerDetailsDialog.jsx`
- `src/hooks/useAdvancedProfitsAnalysis.js`
- `src/pages/EmployeeFinancialCenterPage.jsx`
- `src/pages/DepartmentManagerSettingsPage.jsx`

معيار القبول بعد التنفيذ:
- سارة لا ترى أي “مستحقات مدفوعة” إلا لموظفيها فقط، وإذا لا يوجد موظفون تحت إشرافها تكون القيمة 0.
- لا تظهر فواتير عبدالله ولا فواتير سارة نفسها في قائمة موظفي القسم.
- العميل الذي لديه نقاط تظهر له طلباته ومشترياته وتفاصيله الحقيقية، لا أصفار وهمية.
- تحليل أرباح المنتجات يعكس فقط منتجات مدير المركز المملوكة له `owner_user_id`.
- تبويب أرباح القسم يعرض منتجات مدير القسم فعلاً، وإدارة الموظفين/الصلاحيات تبقى بمستوى المدير لكن ضمن نطاق القسم فقط.
