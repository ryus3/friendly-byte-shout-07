# الخطة الشاملة — نظام التوصيل المحلي الكامل + إصلاحات الواجهة

## المحور 1 — فاتورة الطلب المحلي (إعادة بناء كاملة)

### 1.1 هيدر فاتورة قابل للتخصيص
- إضافة قسم جديد في **الإعدادات → إعدادات التوصيل** يسمى "هيدر فاتورة الطلب المحلي" يحتوي:
  - شعار المحل (رفع صورة، تُحفظ في bucket `storefront-assets`).
  - اسم المحل (مثلاً: "أزياء أحمد الشمري").
  - العنوان، الهاتف، صفحة فيسبوك/إنستغرام، ملاحظة تذييل.
- تُحفظ في جدول `settings` تحت مفتاح `local_invoice_header` (JSON واحد).
- لكل **مالك منتج** (owner_user_id) إمكانية ضبط هيدره الخاص لاحقاً (مرحلة 2)، الآن: هيدر موحّد للمحل.

### 1.2 إصلاحات محتوى الفاتورة الحالية
- **رقم الطلب**: استبدال `ORD001887` بالـ `order_number` الفعلي (`RYUS-463543`). كانت تستخدم `id` كـ fallback خاطئ.
- **اسم المنتج**: عرض اسم المنتج + اللون + القياس + ملاحظة المتغيّر — مأخوذة من `order_items` مع join على `products` + `product_variants`. حالياً تظهر `—` لأن البيانات لا تُمرَّر كاملة.
- **العنوان**: المدينة - المنطقة - تفاصيل/أقرب نقطة دالة (`customer_city` - `customer_province`/region - `customer_address` - `nearest_landmark` إن وُجد).
- **الإجمالي**: تصحيح المنطق ليساوي `total_amount` الحقيقي (شامل التوصيل) = 25,000 بدل 20,000. الخلل أن `total_amount` كان يُحسب من المجموع الفرعي فقط.
- **شارة "شامل التوصيل"** أسفل الإجمالي.

### 1.3 QR Code — التوضيح والمنطق
- **رابط الـ QR** يفتح صفحة عامة `/track/local/<order_id>` بدون login:
  - **الزبون** (يمسحه): يرى صفحة بسيطة — رقم طلبه + حالته الحالية + اسم المحل + رقم تواصل. لا يرى أسعار داخلية ولا بيانات المندوب.
  - **المندوب** (يمسحه وهو مسجّل دخول كـ `local_delivery_agent`): يُعاد توجيهه تلقائياً إلى `/agent/orders/<order_id>` حيث يرى التفاصيل الكاملة + زر تغيير حالة + ملاحظات.
  - **المدير/الموظف** (مسجّل دخول): يفتح تفاصيل الطلب الداخلية مباشرة.
- صفحة `/track/local/:id` تستخدم RPC عامة `public.get_local_order_public(order_id)` تُرجع الحقول العامة فقط.

### 1.4 فاتورة مجمّعة للمندوب (Manifest)
- زر جديد "فاتورة مندوب مجمّعة" في صفحة "إدارة التوصيل المحلي → المندوبين".
- يختار المدير المندوب + الطلبات (أو فترة) → ينشئ صفحة A4 تحتوي:
  - **هيدر الفاتورة** (شعار المحل، اسم المندوب، رقم الفاتورة `LDM-xxxx`، التاريخ).
  - **تجميع حسب المحل/المالك**: كل مالك منتجات لديه قسم خاص باسمه، تحته جدول طلباته للمندوب.
  - **سطر لكل طلب**: رقم الطلب، اسم العميل، الهاتف، العنوان الكامل، تفاصيل المنتجات (اسم/لون/قياس/كمية)، السعر الإجمالي، حالة الطلب الحالية، عمود "ملاحظات" فارغ للكتابة اليدوية.
  - **QR واحد كبير** أعلى الفاتورة → مسحه يفتح للمندوب صفحة "استلام دفعة" تُحوِّل كل الطلبات إلى "تم الاستلام من المندوب" دفعة واحدة.
  - **مجموع** عدد الطلبات + إجمالي المبلغ المتوقع تحصيله + إجمالي أجور المندوب.

---

## المحور 2 — نظام مندوبي التوصيل المحليين المتكامل

### 2.1 الجداول (migration واحدة)
```
local_delivery_offices(id, name, governorate, manager_user_id)
local_delivery_agents(id, user_id, name, phone, governorate, office_id,
                      base_fee_per_order, commission_pct, is_active)
local_order_assignments(id, order_id, agent_id, assigned_by, assigned_at,
                        delivery_fee_for_agent, status, received_at, notes)
local_order_status_history(id, order_id, agent_id, old_status, new_status,
                           note, changed_by, changed_at, geo_lat, geo_lng)
local_delivery_manifests(id, manifest_number, agent_id, created_by,
                         orders_count, expected_collection, agent_fees_total,
                         status, scanned_at)
local_manifest_orders(manifest_id, order_id)
local_settlement_invoices(id, invoice_number, agent_id, period_from, period_to,
                          total_orders, total_collected, total_agent_fees,
                          net_owed_to_owner, status, received_at, settled_at)
local_settlement_invoice_orders(invoice_id, order_id, amount_collected, agent_fee, net)
```
- جميعها: GRANT + RLS + `has_role` pattern.
- جدول مرجعي `local_delivery_statuses` يطابق حالات الوسيط (قيد التجهيز / مع المندوب / قيد التوصيل / تم التسليم / مؤجل / مرتجع جزئي / مرتجع كامل / لا يرد).

### 2.2 الأدوار
- `local_delivery_agent` — يرى طلباته المُسندة فقط.
- `local_office_manager` — يرى مكتبه ومندوبيه.
- `manage_local_delivery` permission للمدير العام/المالك.

### 2.3 تدفّق العمل (شرح دقيق كما طلب المستخدم)
1. **الإسناد**: المدير/الموظف يفتح طلباً محلياً → "إسناد لمندوب" → يختار المندوب → ينشئ `local_order_assignments` ويُغيّر `orders.status` إلى "مع المندوب".
2. **طباعة الفاتورة** (فردية أو مجمّعة manifest).
3. **استلام المندوب**: يمسح QR الفاتورة المجمّعة → كل الطلبات تصبح "تم الاستلام من المندوب" دفعة واحدة + يُسجَّل `received_at` على كل assignment.
4. **تحديث حالة كل طلب**: المندوب يفتح طلباً (من قائمته أو بمسح QR طلب فردي) → يضغط زر حالة + ملاحظة → trigger يُحدِّث `orders.status/delivery_status` + يُسجَّل في `local_order_status_history`.
5. **تسليم ناجح**: عند "تم التسليم" → trigger يُسجِّل cash_movement تلقائي بنفس منطق الوسيط (routing عبر `owner_user_id`)، يُخصم أجر المندوب كمصروف على المالك ودَين على المندوب.
6. **التحاسب**:
   - مثال طلبات بقيمة 125,000 (منها 25,000 توصيل) → المندوب يأخذ 25,000 مباشرة، يبقى عليه 100,000.
   - المدير يضغط "إنشاء فاتورة تحاسب" للمندوب → يحدد الفترة/الطلبات → تُنشأ `local_settlement_invoice` بمنطق مطابق لفواتير شركة الوسيط.
   - عند الضغط "استلام التحاسب" → cash_movement (إيراد) + تحديث `delivery_invoices`-like + إغلاق الفاتورة + تظهر بالمركز المالي/التقارير/المستحقات تماماً كفواتير الوسيط.

### 2.4 الواجهات الجديدة
- **`/local-delivery/offices`** — إدارة المكاتب (للمدير).
- **`/local-delivery/agents`** — إدارة المندوبين (للمدير/مدير المكتب).
- **`/local-delivery/manifests`** — قوائم الفواتير المجمّعة.
- **`/local-delivery/settlements`** — فواتير تحاسب المندوبين + استلام.
- **`/agent/orders`** (موبايل-أولاً) — صفحة المندوب: طلباتي (مع/قيد التوصيل/معلق/تم التسليم/راجع) + زر سريع لتغيير الحالة + ماسح QR.
- **`/agent/scan`** — ماسح كاميرا QR (lazy load `html5-qrcode`).
- **رؤية الطلبات حسب الدور**:
  - المدير: كل شيء.
  - مدير القسم: طلباته + طلبات موظفيه.
  - الموظف: طلباته فقط مع تفاصيل المندوب المسؤول.
  - المندوب: طلباته المُسندة فقط.

### 2.5 صلاحيات الموظفين
- إضافة permission جديدة `view_local_delivery_assignments` للموظفين تتيح رؤية المندوب المُسند لطلباتهم.
- إضافة permission `manage_local_delivery_agents` لمدير القسم.

---

## المحور 3 — إصلاحات الواجهة العاجلة

### 3.1 Badge الإشعارات +99 خاطئ
- في `useSidebarBadges.js` و `Layout.jsx`: تأكد أن العدد يُقرأ فعلياً من `notifications WHERE user_id = me AND is_read = false` (مع استبعاد `auto_ai_order_notifications`/dismissed). حالياً يبدو أنه يقرأ من مصدر آخر أو يتجاوز الفلتر.
- إخفاء الـ Badge تماماً إذا كان العدد = 0 (`{count > 0 && <Badge>...</Badge>}`).
- عرض الرقم الحقيقي بدل `99+` إلا فوق 99.

### 3.2 نافذة طلبات الإرجاع فارغة
- إصلاح جذري في `ReturnOrdersDialog.jsx`:
  - الاستعلام يجب أن يُرجع كل الطلبات التي `order_type = 'return'` **بصرف النظر** عن status أو ai_orders أو أي join مقيِّد.
  - التحقق المباشر من DB أن الطلب 149776372 له `order_type = 'return'` ثم تعديل الفلتر بدقة.
  - تطبيق RLS الموجود (المدير يرى الكل، الموظف يرى طلباته).

### 3.3 نافذة الطلبات المحذوفة فارغة
- إصلاح في `DeletedOrdersDialog` (الذي كان يعمل سابقاً):
  - فحص استعلام `auto_delete_log` / `order_deletion_attempts` — أحد الجداول تغيّر أو الفلتر صار خاطئاً.
  - إعادة عرض كل المحذوفات مع تفاصيل (مَن حذف، متى، السبب، بيانات الطلب الأصلية).

---

## المحور 4 — تنفيذ بقية الخطة المتفق عليها سابقاً
- إصلاح تحويل الطلب السريع إلى محلي (`QuickOrderContent.jsx`): إعادة تهيئة city/region، تعيين `delivery_fee = 5000` و `delivery_partner = 'محلي'`.
- (تم بالفعل) حذف الطلب المحلي + إعادة تسمية القائمة + ترتيب "تحصيلات بانتظار التأكيد".

---

## الملفات الرئيسية المتأثرة

**Migration واحدة كبيرة** لكل جداول المحور 2 + RPC `get_local_order_public` + triggers (`handle_local_order_status_change`, `handle_local_manifest_scan`, `handle_local_settlement_received`).

**كود جديد:**
- `src/pages/local-delivery/OfficesPage.jsx`, `AgentsPage.jsx`, `ManifestsPage.jsx`, `SettlementsPage.jsx`
- `src/pages/agent/MyOrdersPage.jsx`, `ScanPage.jsx`, `OrderDetailPage.jsx`
- `src/pages/track/LocalOrderTrackPage.jsx` (عام، بدون auth)
- `src/components/local-delivery/AssignAgentDialog.jsx`, `ManifestPrintView.jsx`, `SettlementInvoiceDialog.jsx`, `StatusUpdateDialog.jsx`
- `src/components/settings/LocalInvoiceHeaderSettings.jsx`
- مسارات في `App.jsx`

**كود معدَّل:**
- `LocalOrderPrintInvoice.jsx` (هيدر مخصص، رقم طلب صحيح، تفاصيل منتج كاملة، عنوان كامل، إجمالي شامل)
- `LocalOrderPrintDialog.jsx` (دعم manifest)
- `useSidebarBadges.js` + `Layout.jsx` (إصلاح badge الإشعارات)
- `ReturnOrdersDialog.jsx` (فلتر `order_type='return'` بدون قيود)
- `DeletedOrdersDialog.jsx` (إصلاح الاستعلام)
- `QuickOrderContent.jsx` (تحويل محلي)
- `src/contexts/SuperProvider.jsx` (دعم cash_movement من triggers محلية)
- `src/components/Layout.jsx` (إضافة عناصر القائمة الجديدة للمندوب/التوصيل المحلي حسب الدور)

---

## ملاحظات تقنية
- التزام مطلق بـ Inventory Golden Rule (تحرير المخزون عند `delivered=4` أو `returned=17` فقط) و Completion Gate.
- جميع cash_movements عبر triggers DB فقط — لا تكرار من client.
- Revenue Routing عبر `owner_user_id` كما في الوسيط 100%.
- صفحة `/track/local/:id` العامة تستخدم RPC `SECURITY DEFINER` ترجع حقول limited (لا أسعار شراء، لا أرباح، لا بيانات داخلية).
- جميع الجداول الجديدة في `public` تتبع قاعدة GRANT الإلزامية.

## التحذير
النطاق ضخم — migration كبيرة + 12+ ملفاً جديداً + 8 ملفات معدّلة. سيُنفَّذ دفعة واحدة عند الموافقة.
