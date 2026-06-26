
## المشكلة (فاتورة 3623484)

### 1. الإشعار والتأكيد للمالك لا يعملان
- جدول `off_channel_collections` فيه جميع السجلات بحالة `pending_classification` (وليس `pending_owner_confirmation`).
- الـ trigger `trg_notify_owner_off_channel` يُرسل الإشعار **فقط** عند الانتقال إلى `pending_owner_confirmation`.
- نافذة التصنيف `OffChannelClassifyDialog` موجودة داخل تبويب "طلبات الفاتورة الخاصة" لكنها لم تُستخدم على هذه الفاتورة، لذلك لا يصل أي إشعار.
- صفحة الـ Inbox `/off-channel-inbox` موجودة لكن **لا يوجد أي رابط لها** في القائمة الجانبية أو شريط الإشعارات أو أي مكان مرئي للمالك.

### 2. حساب الإيراد المحاسبي خاطئ
- المعروض حالياً: **955,000** (من شركة التوصيل 930k + خارج القناة 25k).
- المطلوب قبل تأكيد المالك: **950,000** (= مبلغ الفاتورة الفعلي من شركة التوصيل، يشمل خصم اجور توصيل الـ off-channel).
- المطلوب بعد تأكيد المالك: **975,000** (= 950k + 25k المُستلَم خارج القناة).
- السبب: الكود حالياً يجمع `invoice_order_amount - delivery_fee` لكل طلب على حدة، ثم يضيف الـ off-channel، فينتج 955k. الصحيح هو الاعتماد على `delivery_invoices.amount` كمصدر حقيقة لإيراد القناة، ثم إضافة الـ off-channel المؤكَّد فقط.

---

## خطة الإصلاح

### أ) تصحيح حساب "الإيراد المحاسبي" في `src/lib/invoiceProfitsCalc.js`
- إضافة وسيط `invoiceAmount` (= `delivery_invoices.amount`) إلى `computeInvoiceProfits`.
- تعديل منطق `totalRevenue`:
  - **قبل تأكيد الـ off-channel**: `totalRevenue = invoiceAmount` (مثلاً 950,000).
  - **بعد تأكيد الـ off-channel**: `totalRevenue = invoiceAmount + Σ(off_channel المؤكَّد customer_paid_amount)` (مثلاً 950 + 25 = 975).
- `channelRevenue` يبقى مشتق من `invoiceAmount` (بدون أجور توصيل القناة فقط، لا الـ off-channel).
- `revenueFromItems` و`totalCost` و`netForOwners` تتبع نفس القاعدة بحيث "صافي الربح" يتطابق مع المنطق الجديد.
- تحديث `fetchInvoiceProfitsData` لجلب `delivery_invoices.amount` للفاتورة، وتمريرها للحاسبة.
- تحديث `src/components/orders/InvoiceProfitsTab.jsx` لتمرير `invoiceAmount` للحاسبة.

### ب) تفعيل إشعار المالك تلقائياً + UI واضح للتأكيد
- **Migration جديد**:
  1. تحديث الـ trigger `notify_owner_off_channel_pending` ليُرسل الإشعار أيضاً عند الحالة الأولية `pending_classification` إذا كان `owner_user_id` معروف وحُسب `owner_due_amount > 0` لاحقاً (وأيضاً عند التحوّل لـ `pending_owner_confirmation`).
  2. RPC اختياري `auto_classify_off_channel(order_id)` يصنّف تلقائياً بناءً على `total_amount` و`delivery_fee` (نوع `electronic_payment` افتراضياً) عند الحاجة — لكن لن نُفعّله افتراضياً، نتركه يدوياً.
  3. **والأهم**: استدعاء الإشعار حتى للسجلات الموجودة حالياً بحالة `pending_classification` (تنبيه المالك بأن هناك طلباً يحتاج تصنيف ثم تأكيد).

- **واجهة جديدة للوصول السريع**:
  - إضافة بطاقة "📥 تحصيلات بانتظار تأكيدي" في الصفحة الرئيسية (Dashboard) أو في شريط الإشعارات، تعرض العداد وتربط إلى `/off-channel-inbox`.
  - إضافة عنصر قائمة في `BottomNav` / `Layout` للمالك (إذا `rows.length > 0` في `useOffChannelCollections({ scope:'inbox' })`).
  - تحسين `OffChannelOwnerInbox.jsx`: عرض المبلغ بشكل أوضح، إضافة معلومات الطلب (المنتج، الزبون)، تفعيل زر "لم يصلني" (يُرجع الحالة ويُنشئ ملاحظة).

### ج) التحقق
- فتح فاتورة 3623484 والتأكد:
  - "إجمالي الإيراد المحاسبي" = **950,000 د.ع** قبل التأكيد.
  - الضغط على "استلمت" من inbox المالك → يصبح **975,000 د.ع**.
  - وصول إشعار للمالك مع رابط مباشر إلى `/off-channel-inbox`.

---

## الملفات المتأثرة

1. `src/lib/invoiceProfitsCalc.js` — تعديل منطق `totalRevenue` ليعتمد على `invoiceAmount`.
2. `src/components/orders/InvoiceProfitsTab.jsx` — تمرير `invoiceAmount` للحاسبة.
3. `src/components/accounting/OffChannelOwnerInbox.jsx` — تحسين العرض وتفعيل "لم يصلني".
4. `src/components/Layout.jsx` أو `BottomNav.jsx` — إضافة رابط/شارة "تحصيلات بانتظار تأكيدي".
5. Migration جديد:
   - توسعة trigger الإشعار ليرسل عند `pending_classification` أيضاً.
   - إرسال إشعارات تعويضية للسجلات الحالية بحالة `pending_classification` التي لم تصل لمالكها.

لا يوجد تغيير في `byOwner` أو `productMap` أو منطق توزيع الأرباح/الإرجاع — هذه طبقات سليمة من الإصلاح السابق.
