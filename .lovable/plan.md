
# خطة شاملة: نظام التوصيل المحلي المتكامل + إصلاحات

تنفّذ دفعة واحدة. النطاق كبير لذا يُقسَّم داخلياً لخمسة محاور.

---

## المحور 1 — إصلاح تحويل الطلب السريع إلى محلي + حذف الطلب المحلي

**المشكلة الحالية:**
- `QuickOrderContent.jsx` يستخدم `setActivePartner('local')` لكن بعض الحقول (city/region/customer_city/customer_province) لا تُعاد تهيئتها فتبقى قيم الوسيط، فترفض دالة الإنشاء التحويل وتُبقي المسار على الوسيط ضمنياً.
- زر الحذف للطلب المحلي يستدعي نفس مسار حذف الوسيط الذي يحاول الاتصال بـ alwaseet-proxy فيرجع "خطأ في الحذف" (RYUS-463543).

**الإصلاحات:**
1. عند تغيير `orderCreationMode` إلى `local_only`:
   - تفريغ `formData.city_id`, `region_id` وتعبئة `formData.city/region` يدوياً بدل المعرّفات.
   - تعيين `deliveryFeeAmount = settings.deliveryFee` (5000) بدل صفر، وحفظه في `delivery_fee` على الطلب المحلي.
   - تعيين `delivery_partner = 'محلي'` صراحةً قبل إنشاء الطلب.
2. في `useOrders` / `order-deletion-utils.js`: عند `delivery_partner = 'محلي'` تخطي استدعاء alwaseet-proxy وحذف السجل مباشرةً من `orders` + تحرير المخزون عبر التريغر الموجود.
3. إضافة دالة `canDeleteLocalOrder()` تسمح للحذف لأي طلب محلي حالته `pending` أو `قيد التجهيز` بدون قيود الوسيط.

---

## المحور 2 — أجور التوصيل المحلي والإيراد الفعلي

- إضافة حقل `local_delivery_fee` على الطلب (إن لم يكن موجوداً يُستخدم `delivery_fee`).
- الافتراضي من `settings.deliveryFee` (5000 د.ع) قابل للتعديل في صفحة إنشاء/تحويل الطلب.
- لاحقاً يمكن تجاوزه من إعدادات المندوب أو إعدادات المنطقة المحلية.
- يدخل ضمن `total_amount` تماماً مثل الوسيط، ويُحتسب في الإيراد عبر نفس مسار `invoiceProfitsCalc`.

---

## المحور 3 — فاتورة طباعة الطلب المحلي

**التصميم:** فاتورة A6/تيكيت 80mm احترافية لكل طلب، تحتوي:
- لوغو RYUS + رقم الطلب `RYUS-xxxxxx`
- اسم العميل، الهاتف، المحافظة/المنطقة/العنوان التفصيلي
- جدول المنتجات (اسم/مقاس/لون/الكمية/السعر)
- المجموع الفرعي، أجور التوصيل، الخصم، الإجمالي
- اسم المندوب (إن وُجد) + اسم منشئ الطلب
- ملاحظات
- **QR Code** يحمل رابط `https://pos.ryusbrand.com/track/local/<order_id>` لتحديث الحالة من المندوب
- تاريخ الطباعة

**الواجهة:**
- زر طباعة فردي في تفاصيل الطلب المحلي.
- في قائمة الطلبات: تحديد متعدد (checkboxes) + زر "طباعة فواتير محلية" يطبع كل المحدد دفعة واحدة (PDF متعدد الصفحات أو نافذة طباعة موحدة).

**التنفيذ:** مكوّن React + html2canvas/jsPDF (lazy load) أو window.print مع stylesheet مخصص، يدعم RTL وخط Amiri الموجود.

---

## المحور 4 — نظام مندوبي التوصيل المحليين المتكامل

### الأدوار الجديدة (في `roles`)
- `local_delivery_agent` (مندوب توصيل): يرى الطلبات المُسندة إليه فقط، يحدّث حالتها.
- `local_pickup_agent` (مندوب استلام): يستلم الطلبات الراجعة من العملاء.
- `local_office_manager` (مكتب محافظة): يدير مندوبي محافظته، يستلم/يحوّل طلبات.

### الجداول الجديدة
1. `local_delivery_agents` — ملف المندوب: user_id, name, phone, governorate, base_fee_per_order, commission_pct, is_active, office_id.
2. `local_delivery_offices` — مكاتب المحافظات: name, governorate, manager_user_id.
3. `local_order_assignments` — ربط طلب بمندوب: order_id, agent_id, assigned_by, assigned_at, status, delivery_fee_for_agent, notes.
4. `local_delivery_statuses` — حالات قياسية مطابقة لحالات الوسيط (قيد التجهيز / تم الإرسال للمندوب / قيد التوصيل / تم التسليم / مؤجل / مرتجع جزئي / مرتجع كامل / لا يرد / إلخ) — جدول مرجعي.
5. `local_order_status_history` — تاريخ تغيّر الحالات (مَن غيّر، متى، ملاحظة، إحداثيات اختيارية).
6. `local_settlement_invoices` — فاتورة تحاسب مندوب: agent_id, invoice_number, period_from, period_to, total_orders, total_collected, total_agent_fees, net_owed_to_owner, status (open/received/settled), received_at.
7. `local_settlement_invoice_orders` — أسطر الفاتورة (order_id ↔ invoice_id + amounts).

### GRANT + RLS لكل الجداول الجديدة
- المندوب يقرأ assignments الخاصة به فقط (`agent_id` مرتبط بـ `auth.uid()`).
- مدير المكتب يرى مكتبه.
- المدير العام/المالك: ALL.
- يُتبع نمط `has_role` لتفادي recursion.

### تدفّق العمل
1. منشئ الطلب أو المدير يفتح طلب محلي → يختار "إسناد لمندوب" → ينشئ `local_order_assignments` ويُغيّر `orders.status` إلى "تم الإرسال للمندوب".
2. تُطبع فاتورة الطلب مع QR.
3. المندوب يفتح QR (يفتح صفحة محمية بـ login) → يرى الطلب → يضغط زر حالة (قائمة مماثلة لحالات الوسيط) + يكتب ملاحظة → يُسجَّل في `local_order_status_history` + يُحدِّث `orders.status/delivery_status` عبر تريغر مُوحَّد.
4. عند "تم التسليم" يُسجَّل cash movement تلقائياً بنفس منطق الوسيط (revenue routing عبر `owner_user_id`)، ويُحتسب `agent_fee` كمصروف على المالك ودَين على المندوب.
5. المدير ينشئ `local_settlement_invoice` لمندوب لمجموعة طلبات (يحدّد الفترة أو الطلبات يدوياً)، يستلم المبلغ، ويُغلق الفاتورة → نفس منطق فواتير الوسيط (نفس واجهة `delivery_invoices` لكن مخصّصة محلياً).
6. يدخل الإيراد الفعلي إلى المركز المالي عبر نفس مسارات الوسيط الموجودة.

### الواجهات
- صفحة "إدارة التوصيل المحلي" للمدير (مكاتب، مندوبين، إسنادات، فواتير).
- صفحة "طلباتي" للمندوب (موبايل-أولاً) مع زر تغيير الحالة السريع.
- صفحة "مسح QR" لاستخدام كاميرا الموبايل لتحديث طلب مباشرة.
- نافذة "فاتورة تحاسب المندوب" مع طباعة وزر استلام.

---

## المحور 5 — إصلاحات الواجهة المتفرّقة

1. **القائمة الجانبية (`Layout.jsx`):**
   - إعادة تسمية "تحصيلات بانتظار تأكيدي" → "تحصيلات بانتظار التأكيد" لكل الأدوار.
   - إضافة **Badge** أحمر صغير بجانب الاسم يعرض العدد الفعلي (من `useOffChannelCollections` للمدير، أو من جدول مرتبط بالموظف).
   - إضافة Badge أحمر بجانب "الإشعارات" يعرض العدد الفعلي من `notifications` للمستخدم الحالي (مع real-time subscribe).
   - تأكيد ترتيب "تحصيلات بانتظار التأكيد" مباشرة أسفل "مركزي المالي" لكل من المدير والموظف.
   - عدم تغيير العرض/الأبعاد — استخدام `Badge` صغير `text-[10px]` بحجم ثابت.

2. **نافذة طلبات الإرجاع (`ReturnOrdersDialog.jsx`):**
   - الاستعلام الحالي يفلتر على `status` فقط. التغيير: فلترة على `order_type = 'return'` أو وجود `return_history` للطلب أو `status IN ('returned','return_pending')` أو الحقل المناسب.
   - تشمل الطلب 149776372 — التحقق بالاستعلام أولاً ثم تصحيح الفلتر بدقّة.

---

## ملاحظات تقنية للمراجع

- جداول جديدة تتبع قاعدة GRANT + RLS الإلزامية في memory.
- ربط cash_movements تلقائياً بمنطق `owner_user_id` كما في الوسيط.
- تريغر موحد `handle_local_order_status_change` يحاكي `handle_order_status_change` لإطلاق المخزون عند 4/17 وتسجيل التريغرات المالية.
- التريغر يلتزم بـ Inventory Golden Rule و Completion Gate من الذاكرة.
- لا تكرار في تحديثات app code (تريغر فقط، كما في الذاكرة).

## الملفات الرئيسية المتأثرة (تقديري)

- `src/components/quick-order/QuickOrderContent.jsx`, `OrderDetailsForm.jsx`
- `src/lib/order-deletion-utils.js`, `src/hooks/useOrders.js`
- `src/components/orders/ReturnOrdersDialog.jsx`, `OrdersToolbar.jsx`, `OrderCard.jsx`
- `src/components/Layout.jsx` + Sidebar badges
- مكوّنات جديدة: `LocalDeliveryInvoicePrint.jsx`, `LocalDeliveryAgentsPage.jsx`, `LocalDeliveryOfficesPage.jsx`, `LocalSettlementInvoicesPage.jsx`, `AgentMyOrdersPage.jsx`, `LocalOrderQRScanner.jsx`, `LocalOrderStatusDialog.jsx`
- صفحات/مسارات جديدة في `App.jsx`
- migration واحدة كبيرة بكل الجداول الجديدة + GRANT + RLS + functions + triggers

## تحذير

هذا نطاق ضخم جداً. سيتم بناؤه في تشات واحد لكنه قد يستهلك زمناً وعدداً كبيراً من التغييرات. أوصي بالمتابعة المنفصلة إذا فضّلت لاحقاً، لكنني سأنفّذ الكل دفعة واحدة بناءً على اختيارك.
