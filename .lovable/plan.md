## 1. السماح بتكرار نفس المنتج في الطلب

**المشكلة:** قيد فريد `unique_order_item_variant` يمنع تكرار نفس المتغير في طلب واحد، مما يفشل الطلبات الذكية بـ 3 منتجات متشابهة.

**الحل:**
- ترحيل قاعدة بيانات: حذف `DROP INDEX unique_order_item_variant`.
- إزالة منطق الدمج `aggregatedItemsMap` في `src/contexts/SuperProvider.jsx` (السطر ~2831 ومسار الذكي ~1246) لإبقاء كل صف عنصر مستقلاً.
- التأكد أن دوال الحجز/الخصم تتعامل مع الكميات تراكمياً (التراجع عبر استدعاءات RPC الموجودة لكل صف).

## 2. خريطة العراق — مظهر زجاجي بحواف مضيئة

**الملف:** `src/components/dashboard/ProvincesHeatmapCard.jsx`

- استبدال خلفية الـ mask المملوءة بـ:
  - طبقة زجاجية شفافة `bg-white/5 backdrop-blur-xl`.
  - حدود مضيئة باستخدام `filter: drop-shadow()` متعدد الطبقات (توهج primary + cyan خارجي).
  - حد داخلي رفيع `stroke` على outline الـ SVG بدلاً من تعبئة كاملة.
- إضافة طبقة gradient mesh خفيفة خلف الخريطة (نقاط ضوء aurora).
- markers تبقى كما هي لكن مع حلقة زجاجية محيطة (`ring` نصف شفاف).

## 3. فلترة الطلبات المحلية المرتبطة حسب المشاهد

**المشكلة:** `linkInvoiceWithLocalOrders` ترجع كل الطلبات المرتبطة بالفاتورة بدون فلترة حسب من يفتحها. لذلك يرى أحمد طلبات المدير المحلية، والمدير في صفحة متابعة أحمد يرى طلباته هو.

**القاعدة المطلوبة:**
- موظف يفتح الفاتورة → يرى فقط الطلبات حيث `orders.created_by = auth.uid()`.
- مدير يفتح الفاتورة من صفحته العادية → يرى طلباته المحلية فقط.
- مدير يفتح الفاتورة من صفحة متابعة موظف معين → يرى طلبات ذلك الموظف فقط (`created_by = employeeId`).

**التنفيذ:**

أ. `src/hooks/useAlWaseetInvoices.js` — تعديل `linkInvoiceWithLocalOrders(invoiceId, viewerUserId)`:
   - إضافة معامل ثانٍ `viewerUserId`.
   - فلترة النتيجة: `linkedWithOrders.filter(item => item.orders.created_by === viewerUserId)`.
   - إذا `viewerUserId` فارغ → السلوك الحالي (للمدير في العرض العام).

ب. `src/components/orders/AlWaseetInvoiceDetailsDialog.jsx`:
   - استقبال prop جديد `viewerUserId`.
   - تمريره إلى `linkInvoiceWithLocalOrders`.

ج. الاستدعاءات:
   - `EmployeeDeliveryInvoicesTab.jsx`: تمرير `viewerUserId={employeeId}` (يعمل لكل من الموظف الذي يرى نفسه، والمدير الذي يفتح متابعة موظف).
   - `AllEmployeesInvoicesView.jsx` (عرض المدير العام): تمرير `viewerUserId={user.id}` أو ترك null لإظهار كل الروابط (سنختار `user.id` لكي يرى المدير طلباته المحلية المرتبطة فقط، توافقاً مع المنطق).

د. تحديث عداد الطلبات المرتبطة في الواجهة (linkedCount) ليعكس الكمية المفلترة، مع إبقاء `cachedCount` (إجمالي طلبات شركة التوصيل) كما هو.

## الملفات المعدّلة

- `supabase/migrations/<new>.sql` — حذف قيد التكرار.
- `src/contexts/SuperProvider.jsx` — إزالة الدمج في مسارين.
- `src/components/dashboard/ProvincesHeatmapCard.jsx` — تصميم زجاجي.
- `src/hooks/useAlWaseetInvoices.js` — معامل المشاهد + فلترة.
- `src/components/orders/AlWaseetInvoiceDetailsDialog.jsx` — تمرير المشاهد.
- `src/components/orders/EmployeeDeliveryInvoicesTab.jsx` — تمرير `employeeId`.
- `src/components/orders/AllEmployeesInvoicesView.jsx` — تمرير `user.id`.