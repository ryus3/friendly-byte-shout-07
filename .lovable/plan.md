# الخطة النهائية الشاملة — إصلاحات فورية + نظام التوصيل المحلي العالمي كامل

## القسم أ — إصلاحات عاجلة (فورية)

### أ.1 نافذة طلبات الإرجاع
- الاستعلام يعتمد **حصراً** على `order_type='return'` (وليس `status`).
- إزالة أي فلترة على `status IN ('returned',...)` من `ReturnOrdersDialog.jsx`.
- إضافة زرَي **صعود/نزول** floating (نفس نمط صفحة الطلبات).
- pagination 15/صفحة عند تجاوز 30 طلب، أو scroll مستمر مع sticky header.

### أ.2 الطلبات المحذوفة تُظهر قديم + الطلب 150022546 مفقود + الحذف لا يبقى
- **المشكلة الجذرية**: `orders_backup` يحوي سجلات قديمة، والـ trigger الجديد الذي أضفناه لا ينشط لأن الحذف يمر عبر `AutoDeleteLogDialog.handleDelete` وليس `DELETE` مباشر — أو أن `handleDelete` يحذف من `auto_delete_log` فقط دون حذف من `orders_backup`.
- **الحل**:
  1. RPC جديد `admin_hard_delete_order(order_id_or_number)`: يحذف من `orders`, `order_items`, `orders_backup`, `auto_delete_log`, `notifications` (المتعلقة)، بـ `SECURITY DEFINER` ويتحقق من صلاحية `manage_all_data`.
  2. زر الحذف في نافذة "سجل الحذف التلقائي" يستدعي RPC → الطلب يختفي نهائياً ولا يعود.
  3. فحص فوري لسبب عدم ظهور `150022546`: قراءة DB `SELECT * FROM orders_backup WHERE order_number LIKE '%150022546%' OR tracking_number='150022546'`، ولو مفقود، نستعلم من `notifications` ونعيد بناء backup entry.
  4. إعادة كتابة الاستعلام في `AutoDeleteLogDialog`: `union all` من `orders_backup` + `auto_delete_log` مع `coalesce(deleted_at, created_at)` للترتيب. عرض تاريخ الحذف الصحيح (وليس تاريخ الإنشاء).
  5. Backfill: تحديث `orders_backup.deleted_at` للسجلات الحالية بقيمة `coalesce(deleted_at, created_at + interval '0')` — أو تركها NULL لتُظهر أدنى في الترتيب.

### أ.3 تبويب فواتير شركة التوصيل → Pagination كامل
- `OrdersFollowUpPage` + `EmployeeFollowUpPage`: تبويب "الفواتير" يستخدم نفس مكوّن `Pagination` وأزرار up/down floating الموجودة في تبويب الطلبات.
- 15 فاتورة/صفحة، عرض "X - Y من Z"، نفس الأنماط.

### أ.4 عرض القائمة (List View) — تصميم عالمي احترافي
- إعادة تصميم `OrderCard` في وضع "قائمة":
  - صف مضغوط ~64px: رقم الطلب • badge حالة • اسم العميل • مبلغ • أيقونة شركة توصيل • chevron.
  - عند expand: تفاصيل inline بأنيميشن slide-down (منتجات، عنوان، أزرار سريعة).
  - hover states أنيقة، أيقونات صغيرة للإجراءات.
- **وضع الشبكة (Grid) يبقى بدون أي تغيير**.

### أ.5 توحيد إشعارات القائمة الجانبية مع الهيدر (تحقق نهائي)
- تأكيد أن `useSidebarBadges` يستخدم نفس مصدر `useNotifications().unreadCount` — إن لم يكن، توحيد فوري.

---

## القسم ب — نظام التوصيل المحلي العالمي (كامل — الدفعة الأولى)

### ب.1 هيدر الفاتورة المحلي — رفع صورة حقيقي
- Storage bucket: `local-invoice-headers` (public read، authenticated write).
- `LocalInvoiceHeaderSettings.jsx`: drag & drop لرفع الشعار → يُحفظ `{user_id}/logo-{timestamp}.png`.
- Metadata: `uploaded_by`, `uploaded_at`, `original_filename`, name, phone, address, footer.

### ب.2 قوالب الفاتورة متعددة المستويات
- جدول `local_invoice_templates(id, owner_user_id, scope enum('global','department','user'), department_id, locked boolean, header jsonb, created_by, updated_at)`.
- منطق الاختيار عند الطباعة: `user → department → global` (يتخطى المقفول لصالح الأعلى).
- المدير العام: تفعيل "قالب موحّد للجميع" + قفل.
- مدير القسم: قالب موحّد لموظفيه + قفل.
- الموظف صاحب صلاحية `manage_local_orders`: قالبه الخاص (إن لم يُقفل من الأعلى).

### ب.3 صفحة متابعة الطلبات — فلترة + طباعة جماعية
- فلتر جديد **نوع التوصيل** (الكل / محلي / شركة توصيل) فوق قائمة الطلبات.
- checkboxes ظاهرة في القائمة والشبكة.
- عند التحديد، شريط إجراءات:
  - **طباعة فواتير منفصلة (80mm)** — تيكيت/طلب.
  - **طباعة فاتورة مندوب مجمّعة (A4)** — manifest واحد بكل الطلبات المحددة + QR لكل طلب + توقيع.
  - **تعيين/تغيير مندوب** لمجموعة.
- **العالمي**: التيكيت 80mm للطلب الفردي (يوضع مع الطلب)، والـ A4 manifest للمندوب (يوقّع ويستلم دفعة).

### ب.4 طباعة فاتورة شركة التوصيل (AlWaseet/MODON)
- زر طباعة جديد على بطاقة الطلب + جماعي.
- تيكيت 80mm احترافي: شعار المتجر + شعار الشركة + رقم التتبع + QR للتتبع + عنوان + منتجات.
- عمود `orders.label_printed_at` + `label_printed_by`.
- فلتر "مطبوعة / غير مطبوعة" في التبويب.

### ب.5 Migration الكبيرة — نظام المندوبين الكامل

جداول (كلها بـ GRANT + RLS):
```
local_delivery_offices(id, name, governorate, manager_user_id, phone, address)
local_delivery_agents(id, user_id, name, phone, office_id,
                      base_fee_per_order, commission_pct,
                      assigned_cities text[], assigned_regions text[],
                      id_front_url, id_back_url, photo_url, contract_url,
                      address, notes, rating, is_active)
local_fees_by_governorate(governorate, fee)
local_fees_by_region(city, region, fee)
local_order_assignments(id, order_id, agent_id, assigned_by,
                        assigned_at, delivery_fee_for_agent,
                        status, received_at, notes)
local_order_status_history(id, order_id, agent_id, old_status,
                           new_status, note, changed_by, changed_at,
                           geo_lat, geo_lng)
local_delivery_manifests(id, manifest_number, agent_id, created_by,
                         orders_count, expected_collection,
                         agent_fees_total, status, scanned_at)
local_manifest_orders(manifest_id, order_id)
local_settlement_invoices(id, invoice_number, agent_id,
                          period_from, period_to, total_orders,
                          total_collected, total_agent_fees,
                          net_owed_to_owner, status,
                          received_at, settled_at)
local_settlement_invoice_orders(invoice_id, order_id,
                                amount_collected, agent_fee, net)
local_delivery_statuses(code, name_ar, color, needs_action, is_final)
local_order_processing_box(id, order_id, message, from_role,
                           to_role, status, created_at, resolved_at)
local_order_ratings(id, order_id, customer_phone, agent_rating,
                    store_rating, agent_comment, store_comment)
local_invoice_templates(...)
```

Triggers:
- `handle_local_order_status_change` — history + realtime notification لمنشئ الطلب/مدير القسم/العام.
- `handle_local_manifest_scan` — نقل جماعي لكل الطلبات إلى "مع المندوب".
- `handle_local_delivery_success` — cash_movement عبر `owner_user_id` + تسجيل أجر المندوب كدين.
- `handle_local_settlement_received` — cash_movement (استلام) + قفل الفاتورة + ظهور بالمركز المالي.
- `auto_assign_agent_by_region` — تعيين افتراضي حسب `assigned_cities/regions`.

أدوار وصلاحيات:
- Roles: `local_delivery_agent`, `local_office_manager`.
- Permissions: `manage_local_delivery`, `manage_local_delivery_agents`, `view_local_delivery_assignments`, `choose_local_delivery_agent`, `override_local_fee_per_order`.

### ب.6 الصفحات الإدارية (الدفعة الأولى)
- `/local-delivery/offices` — CRUD مكاتب + تعيين مدراء + نقل مندوبين.
- `/local-delivery/agents` — CRUD مندوبين + مدن/مناطق + رفع مستمسكات.
- `/local-delivery/agents/:id` — بروفايل: صور هوية، عقد، إحصائيات، تقييمات، طلبات، تحاسب.
- `/local-delivery/manifests` — الفواتير المجمّعة (إنشاء، طباعة A4، QR ديناميكي، تتبع).
- `/local-delivery/settlements` — فواتير التحاسب (إنشاء، استلام، OTP تأكيد، أرشيف).
- `/local-delivery/statistics` — لوحة إحصائيات: الأكثر توصيلاً، الأعلى تقييماً، متوسط زمن التسليم، نسبة الإرجاع، خريطة العراق interactive.
- `/local-delivery/processing-box` — صندوق معالجة لطلبات محلية.

### ب.7 QuickOrder — إصلاح التحويل لمحلي
- عند اختيار "محلي":
  - تعطيل city/region الوسيط.
  - تفعيل city/region محلية.
  - `delivery_partner='محلي'` + `delivery_fee` من `settings.default_local_fee` (بديهياً 5000).
  - dropdown "اختيار المندوب" مع auto-suggest حسب المنطقة.
- إصلاح bug الـ payload الذي يجعل الطلب يذهب للوسيط بدل المحلي.

### ب.8 أجور التوصيل المحلي المرنة
- في `DeliverySettingsDialog.jsx`:
  - أجر افتراضي.
  - جدول أجور حسب المحافظة.
  - جدول أجور حسب المنطقة.
  - override في `local_delivery_agents.base_fee_per_order`.
- الأولوية عند الإنشاء: `agent > region > governorate > default`.
- المدير/مدير القسم يعدلون كل شيء. الموظف يرى فقط.

### ب.9 صندوق المعالجة (Processing Box)
- لطلبات محلية + طلبات شركات التوصيل.
- زر "فتح صندوق معالجة" لكل طلب يحتاج تدخل.
- محادثة threaded بين المنشئ/المدير/المندوب.
- "تمت المعالجة" يقفل ويسجّل في history.

### ب.10 إشعارات فورية (Realtime)
- Supabase Realtime على `local_order_status_history` + `local_order_assignments`.
- push + in-app لكل تغيير حالة → منشئ الطلب + مدير القسم + المدير العام + المندوب.

### ب.11 الطلبات الذكية → محلي
- زر "تحويل إلى محلي" في `AiOrdersManager`.
- ينشأ طلب `delivery_partner='محلي'` + `auto_assign_agent_by_region`.

---

## القسم ج — الدفعة الثانية (تُنفَّذ بعد قبول الدفعة الأولى)

- `/agent/dashboard` + `/agent/orders` (اتصال/واتساب/خريطة) + `/agent/scan` (QR scanner lazy) + `/agent/manifests/:id` + `/agent/settlements` (تأكيد OTP).
- `/track/local/:id` — صفحة عامة بدون auth + تقييم زبون بنجوم للمندوب والمتجر.
- خرائط حية للإحصائيات.
- Gamification (شارات، نجمة الأسبوع).
- توقع ذكي لأفضل 3 مندوبين لكل طلب.
- Timeline تفاعلي بـ GPS.
- شات داخلي (`local_order_processing_box`).

---

## توصيتي (ج.1 — العالمي)
**عرض مزدوج**:
- الطلبات المحلية تظهر في **صفحة متابعة الطلبات** بجانب طلبات الوسيط (فلتر "نوع التوصيل") — نفس مبدأ الفواتير.
- صفحة `/local-delivery/*` منفصلة **للإدارة الاستراتيجية** (مندوبين، مكاتب، تحاسب، إحصائيات).
- هذا هو المعيار العالمي: العمليات اليومية موحّدة، الإدارة متخصصة.

---

## ملفات هذه الدفعة (ملخص)
- **Migration واحد كبير**: كل الجداول + GRANT + RLS + Triggers + Roles + Permissions + bucket.
- **إصلاحات**: `ReturnOrdersDialog.jsx`, `AutoDeleteLogDialog.jsx`, RPC `admin_hard_delete_order`, `OrderCard.jsx` (list view), Pagination في تبويب الفواتير في `OrdersFollowUpPage` و `EmployeeFollowUpPage`.
- **جديد**: `LocalInvoiceHeaderSettings.jsx` (رفع صورة), `AlWaseetLabelPrint.jsx` (تيكيت 80mm), `LocalDeliveryManifestA4.jsx`, `LocalOfficesPage`, `LocalAgentsPage`, `LocalAgentProfilePage`, `LocalManifestsPage`, `LocalSettlementsPage`, `LocalStatisticsPage`, `LocalProcessingBoxPage`, `LocalDeliveryFeesManager`, `ProcessingBoxDialog`, `useLocalDeliveryRealtime.js`.
- **تعديلات**: `QuickOrderContent.jsx`, `AiOrdersManager.jsx`, `OrdersFollowUpPage.jsx`, `EmployeeFollowUpPage.jsx`, `Layout.jsx` (روابط `/local-delivery/*`), `SuperProvider.jsx`.

---

## ملاحظات إلزامية
- Inventory Golden Rule + Completion Gate + Revenue Routing عبر `owner_user_id`.
- كل `cash_movements` عبر Triggers فقط.
- كل جدول جديد في `public` يحصل على GRANT في نفس migration.
- `devLog` بدل `console.log`، lazy لـ `html5-qrcode` و `jspdf` و `recharts`.
- `/track/local/:id` عبر RPC `SECURITY DEFINER` بدون بيانات حساسة.

بعد قبولك سأنفّذ هذه الدفعة كاملة دفعة واحدة (الإصلاحات + كل القسم ب باستثناء صفحات المندوب `/agent/*` و `/track/local/:id`، اللتين تأتيان في الدفعة الثانية).
