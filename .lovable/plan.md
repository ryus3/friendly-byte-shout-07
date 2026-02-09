
## ملخص سريع للمشكلة (حسب ما ظهر عندي من الكود والبيانات)
أنت الآن داخل بحساب **ryus-brand** وتسجيل الدخول لمدن داخل التطبيق **ناجح**، لكن:

1) **زر “تحقق الآن” لا يزامن طلبات مدن**  
- السبب: الدالة المستخدمة في زر “تحقق الآن” هي `syncOrderByQR` داخل `AlWaseetContext.jsx`، وهذه الدالة حالياً مبنية بالكامل على **الوسيط فقط**:
  - تبحث عن توكنات/حسابات `alwaseet` فقط
  - وتستدعي `AlWaseetAPI.getOrderByQR` فقط  
=> لذلك حتى لو الطلب “MODON”، سيحاول التحقق من الوسيط ولن يحدّث طلب مدن.

2) **زر العدّ التنازلي في الهيدر قد يفشل لطلبات مدن عند بعض السيناريوهات**  
- المزامنة في الهيدر تعتمد على `performSyncWithCountdown` → `syncVisibleOrdersBatch` (وهذه بالفعل تدعم مدن)، لكن تظهر عندك رسالة الفشل “تعذر الحصول على طلبات الموظف من مدن…”.  
- نحتاج تحسينين:
  - تسجيل/تشخيص أوضح لمكان الفشل (هل الطلبات صفر؟ هل استدعاء API فشل؟)
  - ضمان أن مزامنة مدن تستخدم “أفضل طريقة جلب” عند مدن (وعدم اعتبار “قائمة فارغة” خطأ دائماً)

3) **كاش المدن والمناطق لمدن لا يتحدث (يبدأ ثم يتوقف)**  
عندي مؤشرين قويين من قاعدة البيانات:
- `cities_regions_sync_log` عند مدن: موجود سجل واحد `delivery_partner=modon` لكن **`ended_at` = null** → يعني عملية المزامنة **انقطعت/فشلت** قبل أن تكتمل.
- عدد خرائط المناطق:  
  - `region_delivery_mappings` للوسيط: 6222  
  - `region_delivery_mappings` لمدن: 1215  
وهذا طبيعي إن كانت مدن فعلاً تعيد مناطق أقل، لكن مشكلتك الحالية أن التحديث “لا يكتمل”.

والسبب الأرجح لانقطاع مزامنة الكاش:
- `update-modon-cache` يستدعي `supabase.functions.invoke('modon-proxy', ...)` من داخل Edge Function.
- بينما `modon-proxy` مُعرّفة في `supabase/config.toml` على `verify_jwt = true`
- استدعاء Function-to-Function عبر service-role غالباً **لا يمرر JWT مستخدم**، فيفشل النداء أو يرجع خطأ/استجابة غير متوقعة، فتتوقف المزامنة بدون إكمال وتحديث `ended_at`.

كذلك في واجهة الكاش:
- `useCitiesCache.fetchSyncInfo()` حالياً يستدعي RPC عام `get_last_successful_cities_regions_sync` (بدون تمييز الشريك)  
→ هذا يجعل شاشة مدن تعرض أحياناً أرقام/آخر تحديث خاصة بالوسيط، وبالتالي “تحس ماكو تحديث” حتى لو صار شيء.

---

## الهدف
1) جعل “تحقق الآن” + زر الهيدر يعملان فعلياً على طلبات مدن.
2) جعل تحديث كاش مدن يكتمل 100% (ويُسجّل نهاية المزامنة في log).
3) جعل شاشة الكاش تعرض “آخر تحديث/الأعداد” الخاصة بالشريك الحالي (مدن أو وسيط) بشكل صحيح، وتعرض Progress الصحيح.

---

## التغييرات المقترحة (Frontend + Edge Functions + DB)

### A) إصلاح “تحقق الآن” لطلبات مدن
**الملف:** `src/contexts/AlWaseetContext.jsx`

1) تعديل `syncOrderByQR(qrId)` ليكون متعدد الشركاء:
- بعد جلب `localOrder` من قاعدة البيانات، نستخرج:
  - `partner = localOrder.delivery_partner`
  - `account = localOrder.delivery_account_used`
  - `owner = localOrder.created_by`
- ثم:
  - إذا `partner === 'alwaseet'` → نفس السلوك الحالي (AlWaseetAPI)
  - إذا `partner === 'modon'`:
    - نجلب توكن مناسب باستخدام `getTokenForUser(owner, account, 'modon', true)` مع fallback للمستخدم الحالي مثل الموجود في `syncVisibleOrdersBatch`
    - نستخدم دوال `ModonAPI` لجلب الطلب والتحقق (مثلاً `ModonAPI.getOrderByQR` أو `ModonAPI.getMerchantOrders` ثم البحث عن `qr_id/tracking_number`)

2) تعديل رسائل الـ toast داخل `syncOrderByQR` لتوضح:
- هل المشكلة “لا يوجد توكن مدن لهذا الحساب”
- أم “API مدن رجّع 401”
- أم “لا توجد بيانات للطلب”

**نتيجة هذا الجزء:** زر “تحقق الآن” سيحدث سعر/عنوان/حالة طلب مدن مثل الوسيط.

---

### B) تحسين زر الهيدر والـ “مزامنة السريعة” لمدن (لمنع الفشل الصامت)
**الملف:** `src/contexts/AlWaseetContext.jsx`

1) في `syncVisibleOrdersBatch` (وهو يدعم مدن بالفعل):
- عندما يرجع `ModonAPI.getMerchantOrders` قائمة فارغة:
  - نعرضها كـ “لا يوجد تحديثات” بدل ما نعتبرها “فشل مزامنة” (خصوصاً إذا API رجع status true لكن data empty)
- إضافة logging واضح قبل/بعد استدعاء `ModonAPI.getMerchantOrders`:
  - endpoint
  - هل البيانات Array
  - errNum/msg لو موجودة

2) (اختياري لكن مفيد) تقليل الاعتماد على `getMerchantOrders` الضخم لمدن في المزامنة السريعة:
- عند وجود أوامر محددة (الطلبات المرئية)، نحاول “جلب بالمعرف/QR” إذا كانت API مدن تدعم ذلك بكلفة أقل، لتقليل rate limits.

---

### C) إصلاح تحديث كاش مدن ليكتمل دائماً
**الملف:** `supabase/functions/update-modon-cache/index.ts`

بدلاً من الاعتماد على `modon-proxy` داخل Edge Function:
1) استبدال `supabase.functions.invoke('modon-proxy', ...)` بنداءات `fetch` مباشرة إلى MODON API من داخل `update-modon-cache`:
- Cities:
  - `GET https://mcht.modon-express.net/v1/merchant/citys?token=...`
- Regions:
  - `GET https://mcht.modon-express.net/v1/merchant/regions?token=...&city_id=...`

2) إضافة “حماية ضد الانقطاع”:
- عند أي خطأ في مدينة معينة:
  - نسجل الخطأ
  - نكمل باقي المدن بدل ما تتوقف العملية بالكامل
- وفي النهاية:
  - نضمن تحديث سجل `cities_regions_sync_log` بـ `ended_at` و `success=false` عند الفشل العام
  - أو `success=true` عند النجاح

3) إضافة Rate-limit احترام:
- مدن لديها حد طلبات (حسب مواصفاتكم السابقة)  
- نضيف تأخير بسيط بين المدن (مثلاً 200-400ms) و/أو retry خفيف عند 429.

**نتيجة هذا الجزء:** زر “تحديث Cache من مدن” سيبدأ ويُكمل ويكتب `ended_at`، ولن يبقى “جاري…” ثم يتوقف.

---

### D) جعل شاشة الكاش “تفهم الشريك الحالي” (مدن/وسيط)
#### 1) DB: إضافة RPC لجلب آخر مزامنة حسب الشريك
حاليا موجود فقط:
- `get_last_successful_cities_regions_sync()` (عام)

سنضيف:
- `get_last_successful_cities_regions_sync_by_partner(partner_name text)`

ترجع:
- last_sync_at, cities_count, regions_count, success, sync_duration_seconds

#### 2) Frontend hook: `useCitiesCache.js`
- تعديل `fetchSyncInfo(partnerName)` ليستدعي RPC الجديد مع `partnerName` (modon/alwaseet)
- واستدعاؤه من `CitiesCacheManager` بتمرير `activePartner`

#### 3) UI realtime progress: `CitiesCacheManager.jsx`
- في realtime subscription على `cities_regions_sync_log`:
  - تجاهل أي payload لا يطابق `payload.new.delivery_partner === activePartner`
  - تعديل شرط “اكتمال المزامنة”: حاليا يتفقد `eventType === 'INSERT'` عند النجاح، بينما النجاح الحقيقي يكون في `UPDATE` (لأن السجل يُنشأ ثم يُحدّث)  
  - بالتالي نعدّل الشرط ليعمل على `UPDATE` عندما `success === true`

**نتيجة هذا الجزء:** صفحة مدن لن تعرض آخر تحديث للوسيط، ولن تتأثر بتحديثات الوسيط أثناء تحديث مدن، وسيظهر Progress و “آخر تحديث” بشكل صحيح.

---

## التحقق العميق بعد التنفيذ (إجباري)
### 1) طلب مدن (زر تحقّق الآن)
- افتح تفاصيل الطلب `2616423` (MODON)
- اضغط “تحقق الآن”
- نتحقق من:
  - تحديث السعر/الخصم/العنوان (إن تغيرت في مدن)
  - وجود logs في console تؤكد أنه استخدم `ModonAPI` وليس `AlWaseetAPI`

### 2) زر الهيدر (العد التنازلي)
- وأنت على Partner = مدن:
  - اضغط زر الهيدر
  - نتأكد أن progress يظهر وأن الطلبات تُحدّث
  - إذا ماكو تغييرات، يجب أن ينتهي بدون رسالة “فشل” (يعرض “لا توجد تحديثات”)

### 3) كاش مدن
- افتح “إدارة المدن والمناطق” واختر مدن
- اضغط “تحديث Cache من مدن”
- نتأكد:
  - السجل `cities_regions_sync_log` لـ modon يُحدّث (cities_count/regions_count) ثم يكتب `ended_at` و `success=true`
  - عدد `region_delivery_mappings` لمدن يرتفع إذا فعلاً API توفر أكثر من 1215  
  - أو يبقى 1215 لكن مع **آخر تحديث جديد** ونجاح مكتمل (يعني هذا هو العدد الحقيقي لدى مدن)

### 4) مزامنة الطلبات عندما الموقع “مغلق”
- بما أن cron موجود ويشغّل `sync-order-updates` بأوقات مجدولة (`09:00` و `23:45` حسب الإعدادات):
  - بعد إصلاح منطق “التحقق الآن” و”الهيدر”، سنراقب أيضاً سجل `orders.updated_at` بعد وقت الـ cron للتأكد أن مدن تتزامن حتى بدون فتح الواجهة.
  - إذا بقيت لا تتزامن ليلاً: سنضيف خطوة ثانية (خارج هذا الإصلاح) لمراجعة نتائج `sync-order-updates` وقيود “ساعات العمل” إن وُجدت في Edge Functions أخرى مثل `background-sync`.

---

## الملفات/المكونات المتوقع تعديلها
- `src/contexts/AlWaseetContext.jsx`  
  - تعديل `syncOrderByQR` ليصبح متعدد الشركاء
  - تحسين التعامل مع نتائج/أخطاء مدن في `syncVisibleOrdersBatch` (إن لزم)
- `supabase/functions/update-modon-cache/index.ts`  
  - تحويل جلب المدن/المناطق إلى fetch مباشر (بدون modon-proxy) + تحسين تحمل الأخطاء
- `src/hooks/useCitiesCache.js`  
  - `fetchSyncInfo(partnerName)` باستخدام RPC جديد
- `src/components/cities-cache/CitiesCacheManager.jsx`  
  - فلترة realtime حسب `delivery_partner`
  - تعديل منطق اكتمال التحديث (UPDATE وليس INSERT)
- Migration SQL (Supabase):
  - إنشاء RPC: `get_last_successful_cities_regions_sync_by_partner(partner_name text)`

---

## مخاطر/ملاحظات
- إذا كان عدد مناطق مدن الحقيقي فعلاً ~1215، فبعد الإصلاح سيظهر التحديث ناجح لكن العدد لن يصل 6222 (وهذا سيكون “صحيح” وليس خطأ).
- أي تغيير في Edge Functions سنراجعه مع Logs لضمان ماكو توقف وسط التحديث، لأن عندك سابقاً `ended_at=null` وهذا دليل انقطاع.

