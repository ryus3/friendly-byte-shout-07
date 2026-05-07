# خطة شاملة - الإصلاحات الحرجة + الثورة التصميمية

## 1) إصلاح إشعار الطلب الذكي (اسم + أيقونة)
**ملف:** `supabase/functions/ai-order-notifications/index.ts`
- المشكلة: الإشعار يقول "من مستخدم" بدل اسم المنشئ الفعلي.
- السبب: `profiles.id` لا يطابق `created_by` في كل الحالات. سنقرأ بـ `.eq('user_id', record.created_by)` كـ fallback، ونتحقق من النتيجة.
- العنوان الجديد: `🤖 طلب ذكي جديد من {full_name}` (بدون كلمة "مستخدم" الافتراضية).
- الأيقونة: `Sparkles` (✨) بدل bell. تحديث `NotificationsPanel.jsx` ليُرجع أيقونة `Sparkles` احترافية لـ `type === 'new_ai_order'`، و`PackageCheck` لتغيرات الحالة، و`AlertTriangle` للرفض/الإلغاء.

## 2) كارثة المزامنة بالهيدر (تجاوز صلاحيات مدير القسم)
**ملف:** `supabase/functions/sync-order-updates/index.ts` + `SyncStatusIndicator.jsx` + `AlWaseetContext.jsx`
- المشكلة: زر المزامنة يستدعي `sync-order-updates` بدون تمرير `user_id`، فتُجلب توكنات كل المستخدمين وتُزامن كل الطلبات → مدير القسم يحصل على إشعارات المدير العام.
- الحل:
  - إضافة باراميتر `scope_user_id` للـ edge function. عند وجوده: فلترة `delivery_partner_tokens` بـ `.eq('user_id', scope_user_id)` وفلترة `activeOrders` بـ `.eq('created_by', scope_user_id)` أو موظفين تحت إشرافه (من `employee_supervisors` إن كان مدير قسم).
  - عند الاستدعاء اليدوي من الهيدر: تمرير `scope_user_id = current user.id`.
  - الـ cron الخلفي يبقى بدون scope (للمدير العام فقط).

## 3) إشعارات تحديث الحالة (تأتي مع كل مزامنة - خطأ)
**ملف:** `supabase/functions/sync-order-updates/index.ts`
- المشكلة الحالية: الإشعار يُنشأ لو `oldStatus !== newStatus` لكنه أحياناً يُنشأ بسبب اختلاف format (`"3"` vs `3`).
- الحل:
  - مقارنة صارمة: `String(oldStatus).trim() === String(newStatus).trim()` → تخطي.
  - إضافة فحص dedup: قبل insert، `SELECT 1 FROM notifications WHERE order_id=X AND data->>'delivery_status'=newStatus LIMIT 1` → إن وُجد، تخطي تماماً (لا تحديث ولا إعادة).
  - حفظ `delivery_status` داخل `data` للإشعار للسماح بهذا الفحص.
  - توجيه الإشعار لـ `created_by` فقط (الموظف صاحب الطلب) + مدير القسم إن كان موظفاً مشرفاً عليه.

## 4) إلغاء "ترجمة الموقع" البطيئة عند الموافقة
**ملف:** `src/components/dashboard/AiOrdersManager.jsx` / `AiOrderCard.jsx`
- المشكلة: المستخدم لاحظ أن إضافة منطق ترجمة `regions_master` يبطئ الموافقة.
- الحل المُتفق عليه عالمياً:
  - **تخزين الـ external_id الخام للشريك المصدر** في `ai_orders` كما الآن (لا تغيير).
  - **ترتيب الشركاء/المدن/المناطق**: الترتيب القياسي = ترتيب شركة التوصيل نفسها (`external_id ASC` كرقم) - هذا ما تستخدمه `الوسيط` و`مدن` داخلياً، فلا تكرار ولا فوضى.
  - عند الموافقة: لا ترجمة. RPC `approveAiOrder` يستخدم external_id كما هو إن طابق الشريك المختار، وإلا يُظهر تحذيراً واضحاً "هذه المنطقة من الوسيط - اختر الوسيط أو غيّر يدوياً".

## 5) توجيه الإيراد حسب مالك المنتج (تحقق)
**ملفات للفحص فقط ثم تعديل عند الحاجة:** `useFinancialSystem.js`, triggers `handle_invoice_received_*`
- التحقق:
  - `products.owner_user_id` يُحدد مالك المنتج.
  - عند استلام فاتورة: trigger يقرأ `order_items.product_id → products.owner_user_id` ويوزع الإيراد على cash_source الخاص بالمالك.
  - إذا كان المدير العام أنشأ طلباً يحوي منتجات أحمد: الإيراد يذهب لكاش أحمد، وأرباح المدير = 0 (لأنه ليس المالك).
- الفحص بـ `supabase--read_query`: عينة طلب فيه منتج لأحمد أنشأه المدير، ثم تتبع `cash_movements` و`profits` للتأكد. إن وُجد خلل: إصلاح trigger.

## 6) الثورة التصميمية للداشبورد (5 كروت)
كلها glassmorphism + gradient borders + micro-animations.

### أ. خارطة العراق التفاعلية (المحافظات الأكثر طلباً) — جديد
**ملف:** `src/components/dashboard/IraqMapCard.jsx`
- SVG لـ 18 محافظة (paths من مصدر مفتوح).
- Heatmap: تدرج من `hsl(var(--primary)/0.1)` إلى `hsl(var(--primary)/0.9)` حسب عدد الطلبات.
- Hover: tooltip مع عدد الطلبات + شريط تقدم + نسبة من الإجمالي.
- Click: فلترة لوحة الطلبات بهذه المحافظة.
- جدول مصغر جانبي بـ Top 5 محافظات.

### ب. الطلبات الأخيرة — Vertical Timeline
**ملف:** `src/components/dashboard/RecentOrdersCard.jsx`
- خط زمني عمودي بنقاط متدرجة لونياً حسب الحالة.
- لكل طلب: avatar دائري بأحرف اسم العميل + رقم تتبع كبير + شارة حالة + وقت الحالة الفعلي من شركة التوصيل (`delivery_status_updated_at`).
- العنوان: "مدينة - منطقة" فقط (إزالة "أقرب نقطة دالة").
- 5 طلبات فقط، أحدث طلب له border متحرك (pulse).

### ج. تنبيهات المخزون — Visual Cards
**ملف:** `src/components/dashboard/StockAlertsCard.jsx`
- صورة المنتج المصغرة + اسم المتغير.
- شريط نسبة المخزون (red/orange/yellow حسب الخطورة).
- Shimmer effect للعناصر الحرجة (< 5).
- عرض لمدير القسم (تم سابقاً) مع منتجاته فقط.

### د. الزبائن الأكثر طلباً
**ملف:** `src/components/dashboard/TopListCard.jsx` (variant=customers)
- Avatar دائري بحرفين ملونين (gradient حسب رقم الهاتف).
- Badge ذهبي/فضي/برونزي للأول/الثاني/الثالث.
- رقم الطلبات + إجمالي الإنفاق + نسبة نمو.

### هـ. المنتجات الأكثر طلباً
**ملف:** `src/components/dashboard/TopListCard.jsx` (variant=products)
- صورة المنتج + sparkline صغير لاتجاه المبيعات (آخر 7 أيام).
- ranking بأرقام عربية كبيرة.
- شارة تصنيف.

## 7) كاش فوري للطلب السريع + قوائم منسدلة سليمة
**ملف:** `src/components/quick-order/QuickOrderContent.jsx`
- المشكلة 1: "جاري التحميل" يظهر لأن البيانات تُجلب من DB حتى لو الكاش متوفر.
- الحل:
  - عند تغيير الشريك: قراءة فورية من `localStorage` cache key `cities_${partner}` و`regions_${partner}_${cityId}` و`sizes_${partner}` بدون `await`.
  - إن لم يوجد: fetch صامت في الخلفية (بدون "جاري التحميل") وحفظ بالكاش.
  - الترتيب: `external_id ASC` (ترتيب الشركة).
  - dedup بـ `Map` على `external_id`.
- المشكلة 2: القوائم العائمة منفصلة عن الـ trigger.
- الحل: استبدال `Select` بمكون `SearchableSelect` موجود + إضافة `position="popper"` و `align="start"` و `sideOffset={4}` على `PopoverContent`، مع `onScrollCapture` يُغلق القائمة فقط إذا scroll الـ container الخارجي تحرك (وليس داخل القائمة) عبر فحص `e.target.closest('[data-popover]')`.
- لا يُمس البحث (يبقى input داخل PopoverContent).

## التغييرات في قاعدة البيانات
- لا migrations جديدة (نستخدم `notifications.data` لتخزين `delivery_status`).
- إن لزم: إضافة index على `notifications(order_id, (data->>'delivery_status'))` لتسريع dedup.

## ترتيب التنفيذ
1. إصلاح الإشعارات (1, 3) + scope المزامنة (2) — حرج
2. التحقق من توجيه الإيراد (5)
3. كاش طلب سريع (7)
4. التصميم الإبداعي للكروت الخمسة (6)
5. اسم منشئ الطلب الذكي (1)

هل توافق؟