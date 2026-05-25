## سبب انتهاء توكن الوسيط قبل أوانه

شركة الوسيط فعلاً تمنح التوكن **7 أيام** صلاحية، ونحن نخزنه عندنا بـ`expires_at = now + 7 days` (`AlWaseetContext.jsx:2352`) ولدينا cron يجدّده تلقائياً قبل 24 ساعة من الانتهاء (`refresh-delivery-partner-tokens`). إذن من جهتنا الإعداد صحيح. السبب الحقيقي لرسالة "انتهت صلاحية الجلسة" هو **جهة الوسيط** ترفض التوكن قبل نهاية 7 أيام لأحد سببين:

1. **تسجيل دخول جديد بنفس الحساب من جهاز/متصفح آخر** → سيرفر الوسيط يُبطل التوكن القديم فوراً ويعطي errNum:21 (نراه نحن "TOKEN_EXPIRED"). الحساب `alshmry94` مشترك بين أكثر من موظف، فأي تسجيل دخول جديد يكسر جلسات الباقين.
2. **خطأ مؤقت في endpoint معيّن من جهة الوسيط** → بعض مسارات الوسيط ترجع errNum:21 كـ "ليس لديك صلاحية" حتى مع توكن صالح. عالجنا أغلبها في `alwaseet-proxy` (`PASSTHROUGH_21_ENDPOINTS`) لكن `create-order` غير مشمول لأنه فعلياً حساس.

**الخلاصة:** التاريخ المحلي لا يعكس قرار سيرفر الوسيط. لذلك يجب أن نتعافى تلقائياً (auto-relogin) عند رفض التوكن من قِبل السيرفر، بدل إجبار المستخدم على فتح إعدادات شركة التوصيل ولمس "تجديد التوكن" يدوياً.

## الخطة الكاملة

### 1) شفاء تلقائي عند رفض التوكن (Auto re-login + retry)

**أ. على جانب الواجهة (`src/lib/alwaseet-api.js`)**
- داخل `apiCall` قبل رمي `isTokenExpired = true`: محاولة استدعاء وظيفة جديدة `attemptSilentRelogin(token)`:
  - تستدعي edge function `refresh-delivery-partner-tokens` لجدول التوكن المعني (نمررها `tokenId` أو `username+partner`).
  - تنتظر الرد، تقرأ التوكن الجديد من `delivery_partner_tokens`، وتعيد محاولة نفس endpoint مرة واحدة.
- إذا فشل التجديد → نرمي `isTokenExpired` كما هو الآن.

**ب. على جانب edge function `refresh-delivery-partner-tokens`**
- توسعة قبول `body.token_id` أو `body.username+partner_name` لتجديد توكن محدد عند الطلب (بدل انتظار cron).
- إن نجح، تكتب التوكن الجديد في DB ويعود `success: true, token`.

**ج. على جانب `AlWaseetContext.jsx`**
- مستمع `alwaseet-token-expired` يحاول تنفيذ نفس الـrelogin الصامت قبل عرض أي toast (نخفض throttle إلى 5 ثوانٍ ونعرض toast فقط لو فشل التجديد فعلاً).
- في `createOrder/edit-order` على مستوى الواجهة (`QuickOrderContent.jsx` و`CreateOrderPage.jsx`): إذا التقطنا `isTokenExpired` بعد retry، نظهر toast فيه action "تجديد التوكن" يفتح `DeliveryPartnerDialog`.

### 2) تجديد استباقي أكثر أماناً
- في `AlWaseetContext.jsx` عند mount الصفحة: لو `expiresAt - now < 48h` → استدعاء tcp التجديد فوراً (بدل انتظار cron).
- إضافة فحص عند رجوع التاب للتركيز (`visibilitychange`): إذا التوكن خلال 24 ساعة من الانتهاء → تجديد صامت.

### 3) ظهور المدن/المناطق فوراً في طلب سريع
ملف: `src/components/quick-order/QuickOrderContent.jsx`
- استخدام lazy initializer لـ`cities`/`packageSizes` لتُملأ مباشرة من `cachedCities` بدون انتظار `useEffect`.
- إزالة `setLoadingCities(true)` إذا `cachedCities.length > 0` (لا وميض "تحميل...").
- جلب المناطق synchronously داخل `onValueChange` للمدينة عبر `getRegionsByCity(cityId)` وضبط `regions` مباشرة قبل أي async، وإزالة placeholder "تحميل المناطق...".

### 4) ربط المنسدلات بصرياً بحقل الاختيار
ملف: `src/components/ui/searchable-select-fixed.jsx`
- إزالة الفجوة 4px → جعل القائمة ملتصقة بأسفل الزر (`top: rect.bottom`).
- عند `open === true`:
  - الزر: `rounded-b-none border-b-0`
  - البطاقة المنسدلة: `rounded-t-none` + نفس لون حدود الزر (`border-input`).
- تطبيق نفس shadow الناعم وتطابق العرض تماماً مع الزر — تظهر كقطعة واحدة موحّدة.

### 5) التحقق من إشعار الإيراد (لا تعديل كود)
- استعلام sql على آخر 10 إشعارات `revenue_received` للتأكد:
  - المبلغ = `final_amount - delivery_fee` (موزّع نسبياً عند تعدّد الملاك).
  - يحوي اسم البائع بين قوسين.
  - `user_id` = مالك المنتج فقط، لا يصل لمدير عام/موظف آخر.

## ملفات سيتم تعديلها
- `src/lib/alwaseet-api.js` — silent relogin + retry
- `src/contexts/AlWaseetContext.jsx` — relogin خلف الكواليس + تجديد استباقي + visibilitychange
- `supabase/functions/refresh-delivery-partner-tokens/index.ts` — دعم تجديد مفرد عند الطلب
- `src/components/quick-order/QuickOrderContent.jsx` — تحميل فوري للمدن/المناطق
- `src/components/ui/searchable-select-fixed.jsx` — ربط المنسدلة بالحقل بصرياً
- تشغيل supabase--read_query فقط للتحقق من إشعارات الإيراد (لا migration)

## لا يتم لمس
- منطق توزيع الإيراد/الأرباح، RLS، triggers الإشعار، أو أي ملف خارج النطاق المذكور.
- لا migrations جديدة.
