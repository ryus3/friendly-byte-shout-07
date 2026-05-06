
## تأكيد الأرقام
تم التحقق من قاعدة البيانات:
- **2744 مرادف منطقة** (region_aliases) ✅ الرقم صحيح ومأخوذ من جدول `region_aliases`
- 64 مرادف مدينة (city_aliases)
- الوسيط: 18 مدينة، 6261 منطقة
- مدن: 18 مدينة، 5755 منطقة

## السؤال المهم: ترجمة المنطقة بين الشركاء (تليغرام → مدن)

**نعم سينجح**، لأن المعمارية الحالية:
- `regions_master` يحوي المنطقة "الأم" (هوية داخلية واحدة)
- `region_delivery_mappings` يربط نفس `region_id` بـ `external_id` لكل شريك (الوسيط/مدن)

**كيف يعمل الترجمة عند الموافقة على طلب من تليغرام:**
البوت يحفظ في `ai_orders` المعرّف الداخلي `region_id` (وليس external_id الوسيط فقط). عند الموافقة في "نافذة طلبات الذكاء" واختيار "مدن"، النظام يأخذ `region_id` الداخلي ويبحث في `region_delivery_mappings` بـ `delivery_partner='modon'` ليحصل على external_id الخاص بمدن. هذا هو "نظام الماستر/المترجم".

**المشكلة الحالية:** البوت يخزن external_id (alwaseet) فقط في `ai_orders.city_id/region_id`. سنُصلح هذا ليُخزَّن `regions_master.id` الداخلي، ثم عند الموافقة يُترجَم تلقائياً للشريك المختار.

---

## الخطة المتبقية الكاملة

### 1) ترجمة المدن/المناطق بين الشركاء (Master Translator)
- `telegram-bot/index.ts`: عند مطابقة المنطقة، حفظ `regions_master.id` الداخلي في `ai_orders.resolved_region_id` و `resolved_city_id` (مع الإبقاء على external_id للعرض).
- `AiOrdersManager.jsx` / `AiOrderCard.jsx` عند الموافقة:
  - قراءة الشريك المختار حالياً (alwaseet/modon)
  - استدعاء helper جديد `translateLocationToPartner(internalCityId, internalRegionId, partner)` يقرأ من `*_delivery_mappings`
  - تمرير external_id الصحيح للشريك المختار

### 2) Quick Order: كاش فوري + ترتيب الشركة + قوائم منسدلة ملتصقة
- `QuickOrderContent.jsx`:
  - تحميل المدن/المناطق/الأحجام من Cache مباشرة عند تغيير الشريك (بدون انتظار API). الترتيب حسب `external_id` (ترتيب الشركة) وليس أبجدياً.
  - حذف حالة "جاري التحميل" — عرض فوري من الذاكرة المحلية إن توفرت، وإلا fallback صامت من DB.
  - الأحجام بالعربية: ترجمة `Normal/Large/...` عبر خريطة ثابتة.
  - **إصلاح القوائم العائمة**: استبدال `Select` الحالي (Radix Portal) بـ `Popover` مرتبط بـ trigger أو إضافة `position="popper" sideOffset={4}` مع `onScroll` يُغلق القائمة، بحيث لا تنفصل عند التمرير.

### 3) Recent Orders: 5 طلبات + وقت تغير الحالة الفعلي
- جلب `status_changed_at` من جدول `order_status_history` (آخر تغيير للحالة من شركة التوصيل) بدلاً من `updated_at`.
- إضافة عمود `delivery_status_updated_at` يُحدّث فقط داخل edge function عند تغير الحالة فعلاً (مأخوذ من `updated_at` الذي ترجعه شركة التوصيل، وليس `now()`).
- عرض "العنوان: مدينة - منطقة" فقط.
- الحدّ بـ 5 طلبات (`.slice(0,5)`).

### 4) ثورة تصميمية للداشبورد (الكروت الخمسة)
**أ. المحافظات الأكثر طلباً — خارطة العراق التفاعلية:**
- استخدام SVG لخارطة العراق (18 محافظة) مع تلوين heatmap حسب عدد الطلبات
- Hover/Click → tooltip بإحصائيات + شريط تقدم
- ألوان متدرجة من theme primary

**ب. الطلبات الأخيرة — Timeline عمودي:**
- خط زمني بنقاط نابضة (pulse animation) لكل حالة
- شارة حالة بتدرج لوني + رقم تتبع كبير
- Glassmorphism card مع border متحرك للطلب الأحدث

**ج. تنبيهات المخزون — بطاقات بصرية:**
- صور المنتجات المصغرة + شريط نسبة المخزون
- ألوان تحذير متدرجة (أحمر/برتقالي/أصفر) حسب الخطورة
- shimmer effect للعناصر الحرجة

**د. الزبائن الأكثر طلباً:**
- Avatar دائري بأحرف أولى ملونة + Badge ذهبي/فضي/برونزي للأول والثاني والثالث
- نسبة مئوية للنمو

**هـ. المنتجات الأكثر طلباً:**
- صور المنتجات + sparkline صغير لاتجاه المبيعات
- Ranking بأرقام عربية كبيرة

كل الكروت: glassmorphism، gradient borders، micro-animations عند hover، تتوافق مع dark theme الحالي.

### 5) إصلاح Scroll-to-Top المتجمد
- المشكلة: الأيقونة floating لكن لا تستجيب على بعض الصفحات لأن السكرول يحدث داخل container ولا على window.
- الحل: تعديل `ScrollToTop` ليبحث عن أقرب `[data-scroll-container]` ويستخدمه، وإلا window. إضافة `data-scroll-container` على `<main>` في `Layout.jsx`.

### 6) إشعار الطلب الذكي الجديد
- `ai-order-notifications/index.ts`: تغيير العنوان إلى:
  `🤖 طلب ذكي جديد من {اسم المستخدم الفعلي} (تليغرام)`
- جلب الاسم من `profiles.full_name` بـ `created_by`.
- المستلمون: المدير العام + مدير قسم الموظف (من `employee_supervisors`).
- استخدام أيقونة `Sparkles` أو `Brain` بدل bell البدائية في `NotificationsPanel`.

### 7) StockAlertsCard لمدير القسم احمد
- المشكلة: `canViewAlerts` يتطلب صلاحيات قد لا تكون لمدير قسم.
- الحل: تعديل الشرط إلى `(isAdmin || isDepartmentManager || canViewStockAlerts || canManageInventory) && ownsAnyProducts`.

### 8) إشعارات تحديث الحالة (إصلاح التكرار + يعمل والموقع مغلق)
- `sync-order-updates/index.ts`:
  - **منع التكرار الحقيقي**: قبل إنشاء إشعار، البحث عن إشعار سابق بنفس `order_id` ونفس `delivery_status`. إن وُجد: تخطي تماماً (لا تحديث ولا إعادة إرسال).
  - الإشعار يُنشأ فقط عند `oldStatus !== newStatus`.
  - استخدام `updated_at` الذي ترجعه شركة التوصيل لحفظ `delivery_status_updated_at`.
- **العمل والموقع مغلق**: التأكد من تشغيل cron job كل 10 دقائق على `sync-order-updates` (يعمل خادمياً مستقلاً عن المتصفح). دفع Push notifications عبر `send-push-notification` (FCM/Web Push) مع subscription محفوظ — يصل حتى مع إغلاق الموقع.
- الحذف التلقائي: التأكد من تشغيل trigger `auto_delete_returned_orders` عند `delivery_status='17'` بعد إستلام الفاتورة.

### 9) الحذف التلقائي + استلام الفواتير
- التحقق من cron `smart-invoice-sync` يعمل كل 30 دقيقة → يستلم الفواتير → trigger يحدث `receipt_received=true` → orders تكتمل تلقائياً.

---

## الملفات المعدلة (تقريباً)
- `supabase/functions/telegram-bot/index.ts` (حفظ internal IDs)
- `supabase/functions/ai-order-notifications/index.ts` (اسم المستخدم + أيقونة)
- `supabase/functions/sync-order-updates/index.ts` (منع تكرار + delivery_status_updated_at)
- `src/components/dashboard/AiOrdersManager.jsx`, `AiOrderCard.jsx` (مترجم الشريك)
- `src/components/quick-order/QuickOrderContent.jsx` (كاش فوري + ترتيب + popover)
- `src/components/dashboard/RecentOrdersCard.jsx` (timeline + 5 + وقت فعلي)
- `src/components/dashboard/StockAlertsCard.jsx` (شرط dept manager + تصميم)
- `src/components/dashboard/TopListCard.jsx` (تصاميم Avatar/Badge/Sparkline)
- `src/components/dashboard/IraqMapCard.jsx` (جديد — خارطة SVG تفاعلية)
- `src/pages/Dashboard.jsx` (دمج IraqMapCard)
- `src/components/Layout.jsx` (data-scroll-container)
- `src/App.jsx` (ScrollToTop يدعم container)
- `src/components/NotificationsPanel.jsx` (أيقونة احترافية)
- migration: عمود `orders.delivery_status_updated_at` + index على `ai_orders.resolved_region_id`

هل توافق على تنفيذ الخطة كاملة؟
