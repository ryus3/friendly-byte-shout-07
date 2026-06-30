# الخطة الشاملة النهائية — نظام التوصيل المحلي العالمي + إصلاحات عاجلة

## القسم أ — إصلاحات عاجلة (تُنفَّذ أولاً)

### أ.1 نافذة طلبات الإرجاع فارغة
- في `ReturnOrdersDialog.jsx`: حذف أي join مع `ai_orders` وأي فلتر على `status`. الاستعلام يصبح: `select * from orders where order_type = 'return' order by created_at desc`.
- التحقق المباشر من DB أن الطلب 149776372 له `order_type='return'`. لو القيمة مختلفة (مثل `returned` أو NULL مع `status='returned'`)، توسيع الفلتر: `order_type='return' OR status IN ('returned','return_received')`.
- إزالة أي فلتر `created_by` خاطئ — الاعتماد على RLS فقط.

### أ.2 الطلبات المحذوفة تعرض قديم/أوقات خاطئة
- `AutoDeleteLogDialog.jsx`: الاستعلام يدمج حالياً `auto_delete_log` + `orders_backup` وقد يفقد الترتيب. إعادة بناء الاستعلام:
  - `union all` بين المصدرين مع normalize للحقول.
  - الترتيب الموحّد: `order by deleted_at desc nulls last` (وليس `created_at`).
  - عرض **الأحدث 200** + بحث + فلتر بالتاريخ.
- التأكد من حفظ `deleted_at = now()` و `deleted_by`/`deletion_reason` في كل مسارات الحذف (manual + auto + trigger). إضافة trigger `before delete on orders` يكتب الصف في `orders_backup` مع `deleted_at=now()` و `deleted_by=auth.uid()` إذا لم يكن مضبوطاً.
- ربط إشعار حذف الطلب (موجود) مع سجل الحذف عبر `order_number` ليظهر مع كل صف.

### أ.3 توحيد عداد الإشعارات (هيدر = قائمة جانبية)
- المصدر الواحد: hook `useUnreadNotificationsCheck` (المستخدم بالهيدر).
- تعديل `useSidebarBadges.js` ليستخدم نفس الـ hook بدل استعلام منفصل، أو استدعاء نفس الـ RPC.
- إخفاء الشارة عند 0، عرض الرقم الحقيقي حتى 99، ثم `99+`.

### أ.4 تبويب فواتير شركة التوصيل — Pagination + Scroll
- في `OrdersFollowUpPage` و `EmployeeFollowUpPage`: قسم الفواتير يصبح بنفس تصميم قائمة الطلبات:
  - مكوّن `Pagination` مطابق (1،2،3،«،») بنفس التصميم.
  - `عرض X - Y من Z`.
  - أزرار "للأعلى/للأسفل" floating بنفس الشكل.
  - 15 فاتورة/صفحة افتراضياً.

### أ.5 تصميم عرض القائمة (List View) للطلبات
- إعادة بناء بطاقة الطلب في وضع "قائمة" لتصبح صف أنيق مضغوط:
  - صف واحد مرتفع ~56px فقط: رقم الطلب • اسم العميل • شارة الحالة • المبلغ • شركة التوصيل • زر expand.
  - عند الـ expand يظهر باقي التفاصيل أسفله inline (animation).
  - أيقونات صغيرة للإجراءات (تعديل/طباعة/حذف) عند hover/long-press.
- وضع الشبكة (Grid) يبقى كما هو دون تغيير.

---

## القسم ب — نظام التوصيل المحلي العالمي (Phase 1 كاملة)

### ب.1 هيدر الفاتورة المحلي — رفع صورة لا رابط
- إضافة bucket `local-invoice-headers` (public read).
- `LocalInvoiceHeaderSettings.jsx`: حقل رفع شعار حقيقي (drag & drop) → يُحفظ في bucket باسم `{user_id}/logo-{timestamp}.png` → الرابط الناتج يُحفظ في `settings.local_invoice_header.logo_url`.
- حفظ metadata: `uploaded_by`, `uploaded_at`, `original_filename`.

### ب.2 صلاحية تخصيص الفاتورة لكل موظف/مدير
- مصفوفة الصلاحيات الثلاث:
  - **المدير العام**: يفعّل/يطفي "فاتورة موحّدة للجميع"، ويعدّل القالب العام، ويعدّل لأي موظف/قسم.
  - **مدير القسم**: يعدّل قالباً موحّداً لكل موظفيه (cascade)، لا يقدر يطلع عن القسم، الموظف لا يعدّل.
  - **الموظف صاحب صلاحية "طلبات محلية"**: يعدّل قالبه الخاص فقط إن لم يكن مدير القسم/العام مفعّلاً "قفل القالب".
- جدول جديد `local_invoice_templates(id, owner_user_id, scope enum(global,department,user), department_id, locked boolean, header jsonb, created_by, updated_at)`.
- منطق الاختيار عند الطباعة: `user → department → global` (أول قالب موجود غير مقفول).

### ب.3 طباعة الفاتورة في صفحة متابعة الطلبات
- **فلترة**: فلتر "نوع التوصيل" (الكل/محلي/شركة توصيل) فوق القائمة.
- **تحديد متعدد**: checkboxes ظاهرة في وضع القائمة + وضع الشبكة.
- **شريط إجراءات** عند التحديد:
  - "طباعة فواتير منفصلة (80mm)" — تيكيت لكل طلب.
  - "طباعة فاتورة مندوب مجمّعة (A4)" — manifest واحد.
  - "تعيين/تغيير مندوب".
- فاتورة شركة التوصيل (AlWaseet/MODON): زر طباعة جديد بالبطاقة + جماعي → تيكيت 80mm احترافي (شعار المتجر + شعار الشركة + QR لرقم التتبع) + مؤشر "مطبوعة/غير مطبوعة" (`orders.label_printed_at`) + فلتر بالتبويب.

### ب.4 نظام مندوبي التوصيل المحليين — Migration الكبيرة

#### الجداول (مع GRANT + RLS):
```
local_delivery_offices(id, name, governorate, manager_user_id, phone, address)
local_delivery_agents(id, user_id, name, phone, governorate,
                      office_id, base_fee_per_order, commission_pct,
                      assigned_cities text[], assigned_regions text[],
                      id_front_url, id_back_url, photo_url, contract_url,
                      address, notes, rating numeric, is_active)
local_order_assignments(id, order_id, agent_id, assigned_by, assigned_at,
                        delivery_fee_for_agent, status, received_at, notes)
local_order_status_history(id, order_id, agent_id, old_status,
                           new_status, note, changed_by, changed_at,
                           geo_lat, geo_lng)
local_delivery_manifests(id, manifest_number, agent_id, created_by,
                         orders_count, expected_collection,
                         agent_fees_total, status, scanned_at)
local_manifest_orders(manifest_id, order_id)
local_settlement_invoices(id, invoice_number, agent_id, period_from,
                          period_to, total_orders, total_collected,
                          total_agent_fees, net_owed_to_owner,
                          status, received_at, settled_at)
local_settlement_invoice_orders(invoice_id, order_id,
                                amount_collected, agent_fee, net)
local_delivery_statuses(code, name_ar, color, needs_action, is_final)
local_order_processing_box(id, order_id, message, from_role,
                           to_role, status, created_at, resolved_at)
local_order_ratings(id, order_id, customer_phone, agent_rating,
                    store_rating, agent_comment, store_comment,
                    created_at)
local_invoice_templates(id, owner_user_id, scope, department_id,
                        locked, header jsonb, created_by, updated_at)
```

#### Triggers:
- `handle_local_order_status_change` — يحدّث orders + يسجّل history + يطلق notification فوري للمنشئ/المدير/مدير القسم.
- `handle_local_manifest_scan` — يحوّل كل الطلبات في manifest إلى "مع المندوب" دفعة واحدة + يُشعر المنشئين.
- `handle_local_delivery_success` — عند "تم التسليم": cash_movement عبر `owner_user_id` (نفس الوسيط 100%) + يسجّل أجر المندوب كدَين على المالك.
- `handle_local_settlement_received` — عند "استلام التحاسب": cash_movement (إيراد) + يقفل الفاتورة + تظهر بالمركز المالي.
- `auto_assign_agent_by_region` — عند إنشاء طلب محلي، يبحث في `local_delivery_agents.assigned_cities/regions` ويعيّن أول مندوب مطابق (default، يمكن تغييره).

#### الأدوار والصلاحيات:
- `local_delivery_agent` — مندوب.
- `local_office_manager` — مدير مكتب.
- صلاحيات: `manage_local_delivery` (مدير عام)، `manage_local_delivery_agents` (مدير قسم/مكتب)، `view_local_delivery_assignments` (موظف يرى مندوب طلبه)، `choose_local_delivery_agent` (يختار/يغيّر المندوب).

### ب.5 الصفحات الجديدة
- `/local-delivery/offices` — إدارة المكاتب (إنشاء مكتب، نقل مندوبين، تعيين مدير مكتب).
- `/local-delivery/agents` — إدارة المندوبين (CRUD + تعيين مدن/مناطق + رفع مستمسكات).
- `/local-delivery/agents/:id` — بروفايل مندوب: صورة + هوية + عنوان + عقد + إحصائيات + تقييمات + طلبات حالية + سجل تحاسب.
- `/local-delivery/manifests` — الفواتير المجمّعة (إنشاء، طباعة، تتبع).
- `/local-delivery/settlements` — فواتير التحاسب (إنشاء، استلام، أرشيف).
- `/local-delivery/statistics` — لوحة إحصائيات: أكثر مندوب توصيلاً، أعلى تقييم، متوسط زمن التسليم، نسبة الإرجاع، توزيع جغرافي على خريطة العراق.
- `/local-delivery/processing-box` — صندوق المعالجة (مثل موقع الوسيط) لطلبات محلية فيها مشكلة.
- `/agent/dashboard` — لوحة المندوب (موبايل أولاً): إحصائياتي، رصيدي، طلباتي.
- `/agent/orders` — طلباتي مع فلاتر حالة + زر اتصال + زر واتساب + زر تغيير حالة.
- `/agent/scan` — ماسح QR (lazy `html5-qrcode`).
- `/agent/manifests/:id` — عرض الفاتورة المجمّعة وتغيير حالات الطلبات منها مباشرة.
- `/agent/settlements` — فواتير تحاسبي + استلام مالي + تأكيد إلكتروني.
- `/track/local/:id` — صفحة عامة بدون auth (QR للزبون): تفاصيل بسيطة + تقييم المندوب والمتجر بنجوم.
- `/processing/local/:orderId` — صندوق معالجة لطلب محلي (محادثة مدير ↔ مندوب).

### ب.6 الطلبات الذكية → طلب محلي
- في `AiOrdersManager`: إضافة زر "تحويل إلى محلي" بجانب "إرسال للوسيط".
- المنطق: عند الضغط، ينشأ `order` بـ `delivery_partner='محلي'` + `delivery_fee=settings.default_local_fee` + ينطلق `auto_assign_agent_by_region`.

### ب.7 طلب سريع + تحويل لمحلي
- في `QuickOrderContent.jsx`:
  - عند اختيار "محلي": تعطيل city/region فيلدز الوسيط، تفعيل city/region محلية، `delivery_fee = settings.default_local_fee`، `delivery_partner = 'محلي'`، إظهار **dropdown اختيار المندوب** (default = الموظف المطابق للمنطقة، قابل للتغيير).
  - إصلاح الـ bug الحالي: state isolation كامل بين الوضعين (currently delivery_partner لا يُكتب بشكل صحيح في submit payload).
  - إضافة منطق "auto-suggest agent" عند تغيير المدينة/المنطقة.

### ب.8 أجور التوصيل المحلي — تحكم مرن
- في `DeliverySettingsDialog.jsx`:
  - **الأجر الافتراضي** (رقم واحد).
  - **حسب المحافظة** (جدول `local_fees_by_governorate`).
  - **حسب المنطقة** (جدول `local_fees_by_region`).
  - **حسب المندوب** (override في `local_delivery_agents.base_fee_per_order`).
- الأولوية عند إنشاء الطلب: `agent > region > governorate > default`.
- المدير ومدير القسم يعدّلون كل المستويات. الموظف يرى فقط ولا يعدّل (إلا إذا فعّل المدير صلاحية `override_local_fee_per_order`).

### ب.9 صندوق المعالجة (Processing Box) — مثل الوسيط
- لطلبات محلية وطلبات شركات التوصيل:
  - زر "فتح صندوق معالجة" بكل طلب يحتاج معالجة (حالة معلّقة/مؤجّلة/لا يرد).
  - نافذة محادثة threaded بين المنشئ/المدير/المندوب.
  - حالة "تمت المعالجة" تقفل الصندوق وتسجّل في history.

### ب.10 الإشعارات الفورية (Realtime)
- عند كل تغيير حالة محلي → push notification + in-app notification إلى:
  - منشئ الطلب.
  - مدير القسم.
  - المدير العام (إن فعّل الاستلام).
- عند إسناد المندوب → إشعار فوري للمندوب.
- عند تحديث الموظف للطلب (مثلاً ملاحظة) → إشعار للمندوب.
- استخدام Supabase Realtime على `local_order_status_history` + `order_assignments`.

### ب.11 تقييم الزبون
- صفحة `/track/local/:id` تعرض زر "تقييم" يفتح modal: نجوم للمندوب + نجوم للمتجر + تعليق اختياري.
- التقييم محسوب في معدّل المندوب (`local_delivery_agents.rating`) ومعدّل المتجر العام (في `settings.store_rating`).

### ب.12 تواصل المندوب
- في صفحة `/agent/orders` و `/agent/manifests/:id`:
  - زر اتصال مباشر (`tel:`).
  - زر واتساب (`https://wa.me/`).
  - زر "عرض على الخريطة" (Google Maps deep link).

---

## القسم ج — توصياتي العالمية الإبداعية

### ج.1 أين يعيش نظام التوصيل المحلي؟
**التوصية**: نظام مزدوج العرض (المعيار العالمي):
- **الطلبات المحلية تظهر في صفحة متابعة الطلبات** بجانب طلبات الوسيط (موحّد، مع فلتر "نوع التوصيل").
- **صفحة منفصلة `/local-delivery`** لإدارة المندوبين/المكاتب/الفواتير/الإحصائيات (مثل صفحة "إدارة المنتجات" المنفصلة عن "المنتجات").
- المنطق: العمليات اليومية في مكان واحد، الإدارة الاستراتيجية في صفحة متخصصة.

### ج.2 أفكار إبداعية مضافة
- **خريطة حية**: في `/local-delivery/statistics` خريطة العراق تعرض المندوبين كنقاط متحركة (محاكاة) + heatmap لكثافة الطلبات.
- **لوحة قيادة لكل مندوب** (gamification): نجمة الأسبوع، شارات (100 طلب، 0% إرجاع، أسرع توصيل).
- **توقع الذكي للمندوب**: عند إنشاء الطلب، اقتراح أفضل 3 مندوبين حسب: المنطقة + الحمولة الحالية + معدّل النجاح.
- **QR ديناميكي للفاتورة المجمّعة**: مسحه يفتح صفحة "استلام دفعة" يكتب فيها المندوب توقيعه الإلكتروني، يحوّل كل الطلبات لـ "مع المندوب" دفعة واحدة + يطلق إشعار جماعي.
- **تأكيد إلكتروني للتحاسب**: الفاتورة فيها زر "تأكيد الاستلام" يطلب OTP من المندوب (SMS/إشعار) قبل التأكيد.
- **خط زمني تفاعلي** لكل طلب يعرض كل التغييرات مع GPS coordinates ووقت كل خطوة.
- **شات داخلي** بين المنشئ والمندوب لكل طلب (`local_order_processing_box` نستخدمه كـ chat).

---

## التنفيذ على دفعتين

**الدفعة 1 (هذه المرة)**:
- كل القسم أ (الإصلاحات العاجلة) + ب.1 + ب.2 + ب.3 (الجزء الخاص بفلتر + تحديد + طباعة منفصلة) + Migration الكاملة (ب.4) + ب.5 الصفحات الإدارية الأساسية (`offices`, `agents`, `agents/:id`, `manifests`, `settlements`) + ب.7 (إصلاح طلب سريع) + ب.8 (أجور مرنة) + ب.10 (Realtime notifications).

**الدفعة 2 (بعد موافقتك على نتيجة الدفعة 1)**:
- صفحات المندوب `/agent/*` كاملة + صفحة `/track/local/:id` العامة + التقييم + صندوق المعالجة + الإحصائيات المتقدمة + الطلبات الذكية → محلي + خرائط + gamification.

السبب: الدفعة 1 ضخمة جداً (migration + 8 صفحات + 6 dialogs + إصلاحات)، تقسيمها يضمن الجودة وتجنب أخطاء التراجع.

---

## ملاحظات إلزامية
- التزام كامل بـ Inventory Golden Rule و Completion Gate.
- كل cash_movements عبر triggers DB فقط.
- Revenue Routing عبر `owner_user_id` 100%.
- كل جدول جديد في `public` يحصل على `GRANT` صريح في نفس migration.
- `/track/local/:id` تستخدم RPC `SECURITY DEFINER` ترجع حقول limited فقط (لا أسعار شراء، لا أرباح).
- استخدام `devLog` بدل `console.log`، lazy-load لـ `html5-qrcode` و `jspdf` و `recharts`.
