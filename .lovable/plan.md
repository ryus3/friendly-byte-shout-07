## 1. خريطة العراق — تصميم زجاجي سمائي شفاف عالمي

**الملف:** `src/components/dashboard/ProvincesHeatmapCard.jsx`

التحسينات:
- تعبئة شفافة جداً للقطر بلون سمائي خفيف (`hsl(199 89% 60% / 0.06)`) بدل التدرّج الحالي الكثيف.
- حدود واضحة مضيئة: استبدال الـ `<img>` بـ inline SVG يحوي مسار العراق مع `stroke="hsl(199 89% 70%)"`, `stroke-width="1.2"`, `fill` شفاف، و `filter: drop-shadow` متعدد الطبقات (توهج سمائي خارجي + داخلي).
- إضافة شبكة خطوط الطول/العرض دقيقة جداً داخل القطر (`stroke-opacity: 0.08`) لإحساس "الخرائط الاحترافية".
- تقليل blur الخلفية وجعل الـ aurora أنعم (opacity 0.35) كي لا تطغى على الحدود.
- markers: حلقات زجاجية رفيعة (`ring-1`) + توهج نبضي خفيف للمحافظات النشطة.
- إضافة نقاط ضوئية صغيرة عند رؤوس الحدود الرئيسية لإحساس "Awwwards".

ملاحظة: سنحوّل `/iraq-map.svg` إلى inline component لنستطيع التحكم بـ stroke/fill مباشرة بدلاً من فلاتر CSS التي لا تعطي حدوداً نقية.

## 2. الفاتورة لمدير القسم — فلترة الطلبات المحلية لكل مستخدم بنفسه

**المشكلة المتبقية:** أحمد (مدير قسم) يفتح فواتيره من تبويب الفواتير الرئيسي `AlWaseetInvoicesTab.jsx`، وهذا التبويب لا يمرر `viewerUserId`، فيرى كل الطلبات المرتبطة لكل المستخدمين الذين يشاركون نفس حساب شركة التوصيل (بما فيها طلبات المدير الأعلى).

**القاعدة الصحيحة:**
- أي مستخدم يفتح فاتورة من تبويبه الشخصي → يرى فقط طلباته المحلية المرتبطة (`created_by = auth.uid()`).
- المدير الأعلى الذي يفتح فاتورة من صفحة "متابعة الموظفين" لموظف محدد → يرى طلبات ذلك الموظف فقط (موجود مسبقاً).
- العرض العام بدون فلتر موظف → كل الطلبات (السلوك الافتراضي).

**التنفيذ:**

`src/components/orders/AlWaseetInvoicesTab.jsx` (السطر ~549):
- إضافة `viewerUserId={user?.id}` إلى `<AlWaseetInvoiceDetailsDialog>` ليفلتر الـ hook النتائج حسب صاحب الجلسة.

`src/components/orders/AllEmployeesInvoicesView.jsx` (مراجعة):
- المنطق الحالي يمرر `employeeFilter !== 'all' ? employeeFilter : null`. هذا صحيح لعرض المدير العام (يرى الكل عند 'all' ويرى موظف معين عند الفلترة).

`src/components/orders/EmployeeDeliveryInvoicesTab.jsx`:
- المنطق الحالي صحيح (يمرر `employeeId`).

لا حاجة لتغيير `useAlWaseetInvoices.js` — الفلترة موجودة وتعمل عند تمرير `viewerUserId`.

## الملفات المعدّلة

- `src/components/dashboard/ProvincesHeatmapCard.jsx` — تصميم زجاجي احترافي للخريطة (inline SVG + stroke + fill شفاف جداً).
- `src/components/orders/AlWaseetInvoicesTab.jsx` — تمرير `viewerUserId={user?.id}` للحوار.