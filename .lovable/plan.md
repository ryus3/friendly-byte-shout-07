
## 1) خريطة العراق — حد رفيع جداً ومضيء بدون نشاز
**الملف:** `src/components/dashboard/ProvincesHeatmapCard.jsx` و `src/components/dashboard/IraqMapSvg.jsx`

- في `IraqMapSvg.jsx` تغيير `strokeWidth * 10` إلى قيمة أنحف ثابتة (السبب: الـ group مُكبَّر ×10 فيظهر الخط ضخماً جداً كما في الصورة).
- استخدام `vectorEffect="non-scaling-stroke"` مع `strokeWidth={0.6}` فقط، بدون مضاعفة ×10.
- إزالة الـ drop-shadow المزدوج الحالي واستبداله بـ glow واحد خفيف:
  `filter: drop-shadow(0 0 1.5px hsl(199 89% 70% / 0.7))`
- تخفيف لون الـ stroke قليلاً: `hsl(199 89% 75% / 0.85)` للحصول على خط نيون أنيق نحيف.
- الإبقاء على التعبئة الشفافة `hsl(199 89% 65% / 0.04)`.

النتيجة: حدود رفيعة مضيئة بنعومة بدلاً من الحد العريض الحالي.

## 2) زر المزامنة في الهيدر — تقييد النطاق حسب الدور
**المشكلة:** الموظف أحمد عند الضغط على زر المزامنة يزامن كل طلبات النظام.

**التحقيق:** `scopeOrdersQuery` في `src/contexts/AlWaseetContext.jsx` يبدو صحيحاً منطقياً (المدير العام = كل شيء، مدير قسم = نفسه + موظفوه، الموظف = نفسه). لكن المشكلة على الأرجح في أن `fastSyncPendingOrders` بعد جلب الطلبات المحلية يستدعي API الوسيط بكل الـ tracking numbers بدون إعادة تطبيق فلتر المالك، أو أن `supervisedIdsRef` لأحمد يحوي قيماً خاطئة.

**الإصلاح في `AlWaseetContext.jsx`:**
- إضافة دالة مساعدة `getSyncScope(user)` ترجع:
  - admin → `all`
  - department_manager → `[self, ...supervised]`
  - employee → `[self]` فقط
- في `fastSyncPendingOrders` التأكد من أن استعلام `pendingOrders` يستخدم `scopeOrdersQuery` بحيث يُجبر الموظف على رؤية طلباته فقط، وعدم الاعتماد على `supervisedIdsRef` للموظفين.
- التحقق من أن `useSupervisedEmployees` لا يحمّل قائمة لموظف عادي (يجب أن تكون فارغة).
- تسجيل devLog واضح: `🔒 نطاق المزامنة لـ {role}: {count} طلب`.

## 3) إشعار إيراد الطلب — أيقونة احترافية + اسم البائع
**الملف:** `src/contexts/NotificationsContext.jsx` (rendering) + migration على `notify_product_owner_on_receipt`.

### 3أ) أيقونة الفلوس الاحترافية
- استبدال الإيموجي 💰 في عنوان الإشعار بـ Lucide icon احترافي (مثلاً `Banknote` أو `Wallet` مع gradient ذهبي أخضر) داخل دائرة زجاجية في قائمة الإشعارات.
- إنشاء معالج خاص في رندر الإشعار: عند `type === 'revenue_received'` يُعرض أيقونة Banknote بحجم 20px داخل بادج بـ `bg-gradient-to-br from-emerald-500/20 to-amber-500/20` مع `ring-1 ring-emerald-400/40`.

### 3ب) ذكر اسم بائع/منشئ الطلب بين قوسين
- تعديل trigger `notify_product_owner_on_receipt` ليُضمّن `created_by_name` في `data` JSON:
  - جلب `full_name` من `profiles` للحقل `orders.created_by`.
  - إذا كان المنشئ هو المدير العام → الاسم "المدير العام"، وإلا الاسم الكامل من profiles.
- تعديل نص الإشعار:
  - من: `تورة الطلب 143202894 — إيرادك: 20000 د.ع`
  - إلى: `طلب 143202894 (المدير العام) — إيرادك: 20,000 د.ع`
- إعادة حساب الإشعارات السابقة من type `revenue_received` لإضافة اسم البائع.

## 4) فحص صفحة الطلب السريع — مدن/مناطق كاش الوسيط للحساب المختار
**الملف:** `src/components/quick-order/QuickOrderContent.jsx` السطر 760-770.

**الفحص الحالي:** عند `activePartner === 'alwaseet'` تستخدم `cachedCities` من `useCitiesCache()` بدون تمييز أي حساب وسيط مختار (alshmry94 أو غيره). الكاش `cities_cache` على مستوى partner_name فقط وليس per-token.

**الإصلاح:**
- التحقق من `waseetUser` المختار (alshmry94 مثلاً) وتمرير `account_username` إلى `useCitiesCache({ partner: 'alwaseet', account: waseetUser?.username })`.
- في `useCitiesCache` إضافة فلتر اختياري على عمود `account_username` في الجدول؛ إذا لم يكن الكاش مخصصاً لحساب → fallback للكاش العام.
- إن لزم: إضافة عمود `account_username` (nullable) في جدول الكاش وتشغيل sync أولي لحساب alshmry94 لجلب مدن/مناطق هذا الحساب تحديداً.
- إضافة devLog: `🏙️ تحميل مدن alwaseet للحساب {username}: {count}`.

## ملاحظات تقنية
- لا تغيير في منطق الأرباح أو حركات النقد.
- تغييرات DB محصورة في trigger `notify_product_owner_on_receipt` + (احتمالاً) عمود `account_username` في كاش المدن.
- جميع تغييرات الواجهة تستخدم semantic tokens.
