# Plan: Dashboard, Quick Order, Notifications & Telegram Bot Fixes

## 1. كرت "إجمالي الطلبات" في الصفحة الرئيسية

**المشكلة:** يعرض 7 بينما صفحة الطلبات تعرض 2 — لا يطابق منطق `OrdersStats.getStats('all')`.

**السبب:** في `src/pages/Dashboard.jsx` يُحسب `filteredTotalOrders` من `visibleOrders` (يتضمن طلبات الموظفين للمدير) بفلتر بسيط، بينما `OrdersStats` في صفحة الطلبات يفلتر دائماً طلبات المستخدم نفسه فقط بحسب الصلاحيات في `OrdersPage`.

**الحل:**
- في `Dashboard.jsx` → `dashboardData.totalOrdersCount`: استخدام نفس قائمة الطلبات المستخدمة في صفحة الطلبات: للموظف فقط `orders.filter(o => o.created_by === userUUID)`، وللمدير العام نفس فلترته في `OrdersPage`. ثم تطبيق نفس فلتر `OrdersStats.getStats('all')`:
  ```
  !o.isarchived && o.status !== 'completed' && o.status !== 'returned_in_stock'
  ```
- إنشاء مجموعة منفصلة `personalOrders` (طلبات المستخدم فقط) واستخدامها لكرت إجمالي الطلبات، بدل `visibleOrders`.

## 2. صفحة "طلب سريع" — مدن/مناطق/أحجام حسب الشريك المختار من الكاش

**الوضع الحالي:**
- الوسيط: يقرأ من `cachedCities` (كاش `cities_master` بأعمدة alwaseet_id) ✅
- مدن: يقرأ من `city_delivery_mappings` للكاش ✅
- لكن مناطق الوسيط في صفحة طلب سريع تأتي من `regions_master` بـ `alwaseet_id` بشكل مباشر — صحيح للوسيط، لكن لا توجد آلية لمناطق "مدن".

**الحل:**
- في `QuickOrderContent.jsx` و `useCitiesCache.js`: عند `activePartner === 'modon'`:
  - المدن: من `city_delivery_mappings` (موجود) ✅
  - **المناطق:** قراءة من `region_delivery_mappings` فلترة `delivery_partner='modon'` بدل قراءة `regions_master.alwaseet_id` (الذي قد يكون فارغاً لمدن).
  - الأحجام: من `package_sizes_cache` فلترة `partner_name='modon'` (موجود) ✅ — مع ضمان الترجمة العربية الموحدة.
- إنشاء helper `getPartnerCitiesAndRegions(partner)` يعيد `{cities, regions}` بنفس الشكل (id = external_id حسب الشريك، name من جدول master).
- تمرير الـ partner المُحدد في `useCitiesCache` كمعامل، بحيث صفحة طلب سريع تستدعي بيانات الشريك المختار حصراً.
- إضافة "مدن" في `useCitiesCache` ليصبح متعدد-الشركاء.

## 3. إصلاح الإشعارات المكررة لتغير حالة الطلب

**المشكلة:** عند فتح الموقع يأتي إشعار جديد بنفس الحالة رغم أن الحالة لم تتغير منذ آخر مزامنة.

**التحقق المطلوب من السبب الجذري (read DB):**
- فحص جدول `notifications`: هل توجد إشعارات متعددة لنفس `order_id` بنفس `delivery_status`؟
- فحص `sync-order-updates` edge function: المفروض `statusChanged = (newStatus !== currentStatus)` فقط — لكن قد يكون `currentStatus` يُقرأ بصيغة معدّلة (مثل السطر 451 يحدّث `delivery_status` بنص "currentStatus → newStatus (text)" قبل المقارنة في دورات لاحقة).

**النمط العالمي الصحيح:**
- إنشاء إشعار جديد فقط عند فعلياً `delivery_status` المخزن في DB ≠ الحالة الجديدة من API.
- إذا وُجد إشعار سابق لنفس `order_id` و `type='alwaseet_status_change'` غير مقروء → تحديثه (UPDATE) بدل إدراج جديد، ليصبح "غير مقروء" وتُحدّث `created_at`. هذا هو النمط العالمي (Notification Deduplication).

**الحل:**
- في `sync-order-updates/index.ts`:
  1. إصلاح bug السطر 451: لا تخزّن النص "currentStatus → newStatus" في `delivery_status`، استخدم حقل `notes` فقط. خزّن `newStatus` فقط في `delivery_status`.
  2. قبل الإدراج: `SELECT id FROM notifications WHERE data->>'order_id'=... AND type='alwaseet_status_change' AND is_read=false ORDER BY created_at DESC LIMIT 1`. إذا موجود ونفس `state_id` → skip. إذا موجود وحالة مختلفة → UPDATE (title, message, data, created_at, is_read=false). إذا غير موجود → INSERT.
- يضمن: إشعار واحد فقط لكل طلب لكل حالة، وعند تغيّر الحالة يتحدّث الإشعار نفسه ويُعاد كـ"غير مقروء".

## 4. إعادة تصميم وترتيب الصفحة الرئيسية

**الترتيب الجديد (تحت كرت "المبيعات المعلقة" مباشرة):**
1. **الطلبات الأخيرة** (5 طلبات) — يستبدل "الزبائن الأكثر طلباً" في موضعه الحالي
2. **تنبيهات المخزون** — لمدير القسم الذي يملك منتجات (owner_user_id) فقط، عرض منتجاته الخاصة، بدون وميض الرقم
3. **المنتجات الأكثر طلباً** (5)
4. **المحافظات الأكثر طلباً** (5)
5. **الزبائن الأكثر طلباً** (5)

**إعادة التصميم الإبداعي العالمي:**
- **Recent Orders Card:** بطاقة Glassmorphism مع:
  - شارة حالة ملوّنة متحركة (gradient pill)
  - Avatar دائري للزبون بالحرف الأول
  - وقت نسبي حقيقي بناءً على `updated_at` لآخر تغيير حالة (وليس `created_at`)
  - hover: يظهر زر "عرض التفاصيل"
  - شريط جانبي ملون يتغير لون حسب الحالة
  - نص العنوان متحرك (scrolling) إن طال
- **Top Lists:** كروت موحدة بـ progress bar نسبي، أيقونة دائرية مع gradient، badge "#1, #2..." ذهبي/فضي/برونزي للأوائل، animation عند الـ enter.
- **Stock Alerts:** بدون pulse على الرقم، تأثير shimmer خفيف على الحدود فقط، فلترة `products.owner_user_id === user.id` لمدير القسم.

**أفكار إبداعية إضافية للصفحة الرئيسية:**
- **Live Activity Feed صغير** أعلى الصفحة (شريط أفقي يمر فيه آخر 3 أحداث: طلب جديد، تسليم، تحديث) — مثل GitHub feed.
- **Confetti Animation** عند تجاوز رقم قياسي يومي للمبيعات.
- **Smart Greeting** بناءً على الوقت + اسم الموظف ("صباح الخير أحمد، لديك 3 طلبات تحتاج معالجة").
- **Hero Metric** مكبّر متحرك (Counter Animation) للإيراد اليومي مع sparkline صغير.
- **Daily Goal Progress Ring** (دائرة تقدم نحو هدف اليوم).
- **Pull-to-refresh** (موجود) ✅
- **Quick Actions FAB** (Floating Action Button) عائم: طلب سريع، إضافة منتج، إشعار.

## 5. بوت تليغرام — استرجاع نظام "هل تقصد؟" السابق

**المشكلة الحالية:**
- البوت يُحمّل المناطق من `regions_master` (موحّد) ثم يُحاول الترجمة لكل شريك عبر `region_delivery_mappings`.
- في صورة المستخدم: مناطق مكررة "حي 112" تظهر 8 مرات (لمدن مختلفة) لأن البحث لا يفلتر حسب city_id.
- نتيجة: نظام "هل تقصد؟" أسوأ من السابق رغم محاولة التحسين.

**التحقق:**
- قراءة كود `loadCitiesRegionsCache` (سطر 322): يحمّل من `regions_master` بكل المدن، ثم يربط `regionExternalIdMap` حسب الشريك المختار في الإعدادات (`telegram_bot_delivery_partner`).
- المشكلة: `regionsCache` يضم مناطق ليس لها mapping للشريك المختار (مثلاً مناطق فقط في الوسيط لا في مدن) → في "هل تقصد؟" تظهر مناطق لا يستطيع البوت استخدامها.

**الحل:**
- **فلترة `regionsCache` و `citiesCache` بعد التحميل** بحيث تحتوي فقط على مناطق/مدن لها `external_id` للشريك المختار:
  ```
  regionsCache = regionsCache.filter(r => regionExternalIdMap.has(r.id));
  citiesCache = citiesCache.filter(c => cityExternalIdMap.has(c.id));
  ```
- نتيجة: عند اختيار "الوسيط" في تبويب "بوت" — البوت يرى فقط مدن/مناطق الوسيط (كما كان سابقاً). عند "مدن" — فقط مدن مدن.
- **تأكيد:** تبويب "بوت" في كاش شركة التوصيل (`TelegramBotDeliveryPartnerSelector.jsx`) يعمل ويحفظ في `settings.telegram_bot_delivery_partner` ✅ — نتأكد فقط أن البوت يقرأها قبل تحميل الكاش (موجود في `getDeliveryPartnerSetting`).
- **إعادة تشغيل/إبطال الكاش:** عند حفظ partner جديد، إرسال signal لإفراغ كاش البوت (تحديث `lastCacheLoadTime=0` عبر استدعاء endpoint refresh أو تقليل TTL إلى دقيقة واحدة بعد الحفظ — أبسط حل: زيادة `BOT_VERSION` غير ممكن من UI، لذا نضيف زر "إعادة تحميل cache البوت" في `TelegramBotDeliveryPartnerSelector` يستدعي endpoint `?refresh_cache=1`).

## 6. ملخص الملفات المعدّلة

- `src/pages/Dashboard.jsx` — totalOrdersCount + إعادة ترتيب الكروت + Stock Alerts للمدير صاحب المنتجات
- `src/components/dashboard/RecentOrdersCard.jsx` — تصميم جديد، 5 طلبات، وقت تغيير الحالة
- `src/components/dashboard/TopListCard.jsx` — تصميم جديد (badges، progress bar)
- `src/components/dashboard/StockAlertsCard.jsx` — فلترة `owner_user_id` + إزالة pulse
- `src/components/quick-order/QuickOrderContent.jsx` — مناطق مدن من `region_delivery_mappings`
- `src/hooks/useCitiesCache.js` — دعم متعدد الشركاء
- `supabase/functions/sync-order-updates/index.ts` — dedup + إصلاح حقل delivery_status
- `supabase/functions/telegram-bot/index.ts` — فلترة citiesCache/regionsCache حسب الشريك المختار
- `src/components/cities-cache/TelegramBotDeliveryPartnerSelector.jsx` — زر إعادة تحميل cache البوت
- (جديد) `src/components/dashboard/LiveActivityFeed.jsx`، `SmartGreeting.jsx`، `DailyGoalRing.jsx` — للأفكار الإبداعية

## 7. ضمانات عدم التخريب

- لا تعديل على منطق المخزون/الكاش/الأرباح في DB
- لا migrations جديدة (فقط قراءة من جداول موجودة: `region_delivery_mappings`, `notifications`)
- جميع تعديلات edge functions backward-compatible
- الأفكار الإبداعية تُضاف كمكونات منفصلة قابلة للإخفاء، لا تُكسر التصميم الحالي

