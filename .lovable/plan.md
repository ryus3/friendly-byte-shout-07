## ما سأنفذه الآن (دقة المخزون مؤجلة لاحقاً)

### 1) تقرير أرباح الفواتير — إصلاح الفراغ + ميزات جديدة
- إعادة بناء نافذة `InvoicesProfitReportDialog`:
  - ارتفاع ثابت `h-[90vh]` مع تمرير داخلي صحيح بدل `absolute` المنهار.
  - فلاتر فترة: يوم/أسبوع/شهر/سنة/كل الفترات/مخصص.
  - فلتر نطاق (Scope chips): حساباتي النشطة، كل الموظفين/موظفيّ، موظف واحد، عدة موظفين.
  - Multi-select للموظفين (Popover مع checkboxes).
  - سحب يمين/يسار للتبويبات + أزرار أسهم.
  - معالجة أخطاء واضحة بدل الفراغ الصامت.

### 2) صفحة الطلبات — التقرير يعتمد على الحسابات النشطة
- تمرير `defaultScope="active_accounts"` من `AlWaseetInvoicesTab` للنافذة.
- يعرض فقط فواتير الحسابات (alwaseet/modon usernames) النشطة حالياً للمستخدم.

### 3) صفحة متابعة الموظفين — نقل الزر داخل تبويب الفواتير
- حذف الزر من أعلى الصفحة.
- وضعه بجانب عنوان "فواتير شركة التوصيل" داخل `EmployeeDeliveryInvoicesTab` بنفس حجم زر التحديث.
- تمرير `allowScopeSelection` وقائمة الموظفين المشرف عليهم.

### 4) دالة DB موسّعة (تمت الموافقة عليها وتم تنفيذها)
- `get_visible_invoices_for_report` تدعم: `active_accounts` و `employees uuid[]`.

### 5) الإشعارات
- في `NotificationsPanel`: عدم عرض اسم صاحب الطلب إذا كان هو المستخدم الحالي نفسه.
- إبقاء التمييز بالقوسين والأسلوب الحالي فقط عند الإشعارات الواردة من موظفين آخرين.
- في `sync-order-updates`: عدم إضافة `(creatorName)` في العنوان إذا كان المستلم هو نفسه منشئ الطلب.

### الملفات
- `src/components/orders/InvoicesProfitReportDialog.jsx` (إعادة كتابة)
- `src/components/orders/AlWaseetInvoicesTab.jsx` (تمرير scope)
- `src/components/orders/EmployeeDeliveryInvoicesTab.jsx` (إضافة الزر للهيدر)
- `src/pages/EmployeeFollowUpPage.jsx` (نقل الزر، تمرير props)
- `src/components/NotificationsPanel.jsx` (إخفاء اسم المستخدم الحالي)
- `supabase/functions/sync-order-updates/index.ts` (إخفاء الاسم للمستلم نفسه)

### مؤجل لطلب لاحق
- دقة المخزون (الفروق الـ13 صف).
- ثورة المتاجر وربط الدومين/السب دومين.