
## نتيجة الفحص المباشر من قاعدة البيانات

| الطلب | البيانات الحقيقية | المعروض حالياً | الصحيح |
|---|---|---|---|
| **149776372** | `order_type='return'`, status=16 (قيد الإرجاع للتاجر)، مبلغ الوسيط = **−20,000**، ملاحظة التاجر: "ارجاع تراك ماروني واعطاء للزبون 20 الف" | "خصم من شركة التوصيل −5,000" ❌ | **إرجاع −20,000** في قسم منفصل |
| **149922672** | `regular`, status=4 (مُسلَّم)، مبلغ الوسيط = **0**، أجور = 5,000، ملاحظة: "هدية بدون اجور"، **مؤرشف في DB فعلاً** | "تحصيل خارج القناة 20,000" بدون تصنيف ⚠️ | **خارج القناة بانتظار تصنيف الموظف** (هو يدخل القيمة المقبوضة الحقيقية مثل 25,000) |

**خلاصة**: 
- قاعدة "كل طلب مبلغه يختلف عن المخطط = خصم" خاطئة — يجب استبعاد طلبات الإرجاع أولاً.
- 149922672 مؤرشف في `orders.isarchived=true`، فإذا لم يظهر في الواجهة فالمشكلة في فلتر صفحة الأرشيف (يستثني المُسلَّمة بمبلغ 0).

---

## المرحلة الثانية — التنفيذ الكامل

### 1) إصلاح فوري لتصنيف الطلبات الاستثنائية (`invoiceProfitsCalc.js`)
- استبعاد طلبات الإرجاع (`order_type='return'` أو `delivery_status='17'` أو `'16'` أو status=`returned`) من حساب الـ delta نهائياً.
- إضافة قسم رابع لقائمة "طلبات تحتاج انتباهك": **🔵 إرجاعات في هذه الفاتورة** يعرض كل طلبات الإرجاع مع المبلغ السالب الحقيقي من الوسيط (−20,000 لـ 149776372).
- الطلبات الاعتيادية المُسلَّمة بمبلغ وسيط = 0 → تبقى ضمن "خارج القناة" لكن مع شارة 🔴 "بحاجة تصنيف".

### 2) إصلاح فلتر صفحة الأرشيف
- في `useOrders.js` / صفحة الأرشيف، التأكد من أن `isarchived=true` يُعرض حتى لو `final_amount=0`. لا فلتر إضافي على المبلغ.
- التحقق أن 149922672 يظهر فعلاً في الأرشيف بعد الإصلاح.

### 3) جدول قاعدة البيانات `off_channel_collections`
أعمدة: `order_id`, `invoice_id`, `collector_user_id`, `owner_user_id`, `collection_type` (enum)، `customer_paid_amount`, `delivery_fee_absorbed`, `employee_profit_share`, `owner_due_amount`, `note`, `status` (enum: `pending_classification` / `pending_owner_confirmation` / `settled` / `waived`), `classified_at`, `confirmed_at`, `cash_movement_id`.
+ GRANTs (authenticated/service_role) + RLS (الموظف يرى سجلاته، المالك يرى ما يخص منتجاته) + تريغر `updated_at`.

### 4) Auto-detection (تريغر على `delivery_invoice_orders`)
عند `INSERT/UPDATE` لسطر مبلغه=0 + الطلب `regular` + `delivery_status=4`:
- إنشاء سجل في `off_channel_collections` بحالة `pending_classification` (إن لم يوجد).

### 5) نافذة تصنيف الموظف `OffChannelClassifyDialog.jsx`
حقول:
- نوع التحصيل: 💳 دفع إلكتروني / 🏦 تحويل بنكي / 💵 نقد من الزبون / 🎁 خصم كامل / 🚚 المالك يتحمّل التوصيل فقط.
- المبلغ المقبوض من الزبون (افتراضي: السعر + التوصيل، قابل للتعديل).
- من قبض؟ (الموظف منشئ الطلب / المالك مباشرة / آخر).
- ملاحظة (رقم العملية، اسم البنك...).

عند الحفظ يحسب تلقائياً:
- موظف بقاعدة ربح → `owner_due_amount = paid − employee_profit`، الحالة → `pending_owner_confirmation`.
- موظف بلا قاعدة → `owner_due_amount = paid` كاملاً.
- المالك/المدير منشئ الطلب → لا دَيْن، حركة `off_channel_receipt` مباشرة + الحالة → `settled`.
- خصم كامل → COGS+توصيل كمصروف، الحالة → `waived`.

### 6) صفحة المالك "تحصيلات بانتظار تأكيدي" `OffChannelOwnerInbox.jsx`
- داخل المركز المالي للمدير.
- قائمة بكل `pending_owner_confirmation`: الطلب + الموظف + المبلغ المتوقَّع + النوع.
- زرّان: ✅ **استلمت** / ⏸️ **لم يصلني بعد**.
- عند "استلمت": إنشاء `cash_movements` (+المبلغ) + تحديث `employee_debts` + الحالة → `settled` + إشعار للموظف.

### 7) دمج مع المركز المالي للموظف
- `EmployeeFinancialCenterManager.jsx`: إضافة سطر "دَيْن تحصيلات خارج القناة" ضمن خصومات الموظف.
- المستحقات الصافية = ربح المُسلَّم − دَيْن off-channel غير المسوّى.

### 8) كارت الفاتورة — إصلاحات نهائية
- "إجمالي الإيراد المحاسبي 975,000" يصبح: **المُحقَّق = من الوسيط + خارج القناة المُؤكَّد** (لا يُحسب المتوقَّع غير المؤكَّد). إضافة سطر ثالث: "بانتظار التأكيد: X".
- شارة 🔴 على "تحصيلات خارج القناة" تعرض عدد الطلبات `pending_classification`.

### تفاصيل تقنية (للمراجعة)
**ملفات جديدة**: 
- `supabase/migrations/<ts>_off_channel_collections.sql`
- `src/components/orders/OffChannelClassifyDialog.jsx`
- `src/components/accounting/OffChannelOwnerInbox.jsx`
- `src/hooks/useOffChannelCollections.js`

**ملفات معدَّلة**:
- `src/lib/invoiceProfitsCalc.js` (استبعاد الإرجاعات + إخراج قائمة الإرجاعات)
- `src/components/orders/InvoiceSpecialOrdersList.jsx` (قسم رابع للإرجاعات)
- `src/components/orders/InvoiceProfitsTab.jsx` (شارات + تصنيف عند النقر)
- `src/hooks/useOrders.js` (فلتر الأرشيف)
- `src/components/accounting/EmployeeFinancialCenterManager.jsx` (دَيْن off-channel)
- إضافة Route للصفحة الجديدة `OffChannelOwnerInbox`.

---

## للموافقة قبل التنفيذ

الخطة كبيرة (Migration + تريغر + 3 ملفات جديدة + 5 معدَّلة). هل أبدأ التنفيذ الكامل بهذا الترتيب، أم تفضّل تنفيذ **الإصلاحات الفورية (1+2+8) أولاً** للتأكد من ظهور الإرجاع والأرشيف بشكل صحيح، ثم بناء جدول `off_channel_collections` وتدفّق التأكيد في خطوة لاحقة؟
