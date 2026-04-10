

## خطة الإصلاح الشاملة - 8 مشاكل

### 1. نقاط الولاء: 25 نقطة لكل 1000 دينار
الكود الحالي في `CustomersManagementPage.jsx` يحسب `Math.floor(spentNoDelivery / 1000)` أي نقطة واحدة لكل 1000.
- تغيير المعادلة إلى `Math.floor(spentNoDelivery / 1000) * 25`
- إضافة تعريف مستويات الولاء حسب النقاط (برونزي/فضي/ذهبي/ماسي)

### 2. خطأ "duplicate key" عند إضافة قاعدة ربح
قاعدة البيانات لديها قيد `UNIQUE (employee_id, rule_type, target_id)`. عند محاولة إضافة قاعدة لنفس الموظف والمنتج يحصل خطأ.
- تحويل `insert` إلى `upsert` مع `onConflict: 'employee_id,rule_type,target_id'` في `DepartmentManagerSettingsPage.jsx`
- نفس التعديل في أي مكان آخر يضيف قواعد ربح

### 3. المصاريف المحذوفة تظهر (5000 مصاريف عامة)
حركات القاصة تحتوي على المصروف الأصلي (-5000) والإرجاع (+5000). المجموع = 0 لكن الواجهة تعرض بطاقة "المصاريف العامة: 5000" لأنها تحسب فقط الحركات الخارجة بدون خصم الإرجاعات.
- تعديل حساب المصاريف ليخصم `expense_refund` من المصاريف العامة
- أو فلترة المصاريف التي لها إرجاع مقابل

### 4. أداة نقل ملكية المنتجات (لم تُبنَ بعد)
إضافة مكون `TransferOwnershipDialog` في `ManageProductsPage.jsx`:
- زر "نقل الملكية" يظهر عند تحديد منتجات
- اختيار المالك الجديد من قائمة المديرين/الموظفين
- تحديث `owner_user_id` مع تسجيل `ownership_transferred_at = NOW()`
- إضافة عمود `ownership_transferred_at` للجدول عبر migration
- المنتجات المنقولة تُحسب مالياً من تاريخ النقل فقط

### 5. منتجات نسائي المنقولة لسارة - الحساب من تاريخ النقل
المنتجات نُقلت عبر migration بدون تاريخ نقل. يجب:
- Migration لإضافة عمود `ownership_transferred_at` لجدول `products`
- Migration ثانية لتحديث المنتجات الـ 6 التي نُقلت لسارة بتاريخ النقل = تاريخ الـ migration السابقة
- تعديل حسابات الإيرادات والأرباح لتحترم `ownership_transferred_at` (طلبات بعد هذا التاريخ فقط تُحسب للمالك الجديد)

### 6. تعديل الموظف من مدير القسم لا يُحفظ
`UnifiedEmployeeDialog` يحتاج فحص - على الأرجح مشكلة صلاحيات RLS على جدول `profiles` عند التحديث من مدير القسم.
- التحقق من سياسة UPDATE على profiles
- ضمان أن مدير القسم يستطيع تعديل بيانات الموظفين تحت إشرافه

### 7. إدارة الموظفين لمدير القسم = نسخة كاملة من المدير
تبويب الموظفين الحالي في `DepartmentManagerSettingsPage` مبسط. المطلوب:
- إضافة أزرار التليغرام ومنح الرموز
- إضافة إدارة الفريق (TeamManagementDialog)
- إضافة تحديث الصلاحيات (UpdateRolePermissionsDialog)
- إضافة وضع العرض grid/table مثل ManageEmployeesPage
- تصفية الحالة والدور
- كل ذلك مع تقييد البيانات على `supervisedEmployees` فقط

### 8. التحقق من Real-time على الدومين المخصص
- التأكد من أن Supabase realtime subscriptions تعمل على `pos.ryusbrand.com`
- التأكد من أن إضافة/تعديل المنتجات تستخدم refetch فوري وليس reload

### تفاصيل تقنية
- الملفات المتأثرة: `CustomersManagementPage.jsx`, `DepartmentManagerSettingsPage.jsx`, `ManageProductsPage.jsx`, حسابات المركز المالي
- Migrations: إضافة `ownership_transferred_at` + تحديث المنتجات المنقولة
- أولوية التنفيذ: خطأ الـ duplicate key أولاً (يمنع العمل)، ثم النقاط، ثم أداة النقل، ثم ترقية إدارة الموظفين

