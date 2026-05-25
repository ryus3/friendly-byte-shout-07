## المشاكل والحل

### 1) خطأ "لا يمكن التعرف على المحافظة" في طلب سريع
السبب: المدن والمناطق تُجلَب من `cities_master` / `regions_master` (جداول مركزية عامة)، فالـ id الذي يختاره المستخدم هو **internal master id** وليس بالضرورة موجوداً في `city_delivery_mappings` / `region_delivery_mappings` لشريك الوسيط. عند إرسال الطلب، `resolveExternalId` لا يجد تطابقاً مع `delivery_partner='alwaseet'` فيرمي الخطأ.

الحل: مصدر المدن/المناطق للوسيط من جداول الـ mappings الخاصة بالشريك مباشرة (تماماً كما يفعل MODON حالياً في السطر 738–753). هكذا الـ id المختار يكون **external_id** للوسيط ومضمون التطابق.

### 2) المدن تحمّل قليلاً قبل الظهور
السبب: `useCitiesCache` يبدأ بـ `setIsLoading(true)` ويقوم بـ pagination للمناطق مع تأخير 50ms بين الصفحات، وإذا تأخر الكاش يظهر "تحميل...".

الحل: 
- حفظ snapshot من المدن/المناطق في `localStorage` بعد كل تحميل ناجح، والتحميل الأولي يهيدرت من الـ localStorage **تزامنياً** في `useState(() => ...)` → ظهور فوري بلا أي شيمر، ثم تحديث صامت في الخلفية.
- في `QuickOrderContent`: تهيئة `cities` و `packageSizes` بشكل lazy من نفس الـ snapshot، وعدم تفعيل `setLoadingCities(true)` إذا توفر snapshot.

### 3) المنسدلة منفصلة عن القائمة وتتحرك عند السحب
السبب: `searchable-select-fixed.jsx` يستخدم portal مع `position: fixed`. لديه listener لتمرير Dialog و ScrollArea، لكن **لا** يستمع لـ `window scroll`. في صفحة طلب سريع (ليست داخل Dialog) عند تمرير الصفحة الزر يتحرك بينما المنسدلة تبقى ثابتة في الـ viewport → تبدو منفصلة.

الحل: إضافة `window` scroll listener (capture + passive) داخل نفس الـ effect المسؤول عن تحديث `buttonRect`، فيتم إعادة حساب موضع المنسدلة فوراً مع كل سكروول وتبقى ملتصقة بالزر. كذلك إعادة الحساب على `orientationchange` للموبايل.

---

## التعديلات

**`src/hooks/useCitiesCache.js`**
- إضافة LocalStorage cache (`ryus_cities_v1`, `ryus_regions_v1`) مع TTL ناعم.
- تهيئة `cities` و `allRegions` تزامنياً من LocalStorage.
- `setIsLoading(false)` إذا كان هناك snapshot، ثم refresh في الخلفية بدون شيمر.

**`src/components/quick-order/QuickOrderContent.jsx`** (السطور ~720–810 و 866+)
- في فرع `activePartner === 'alwaseet'`: استبدال جلب المدن من `cachedCities` بجلب من `city_delivery_mappings` (نفس نمط MODON) — `external_id` يصبح `id` المعروض.
- جلب المناطق من `region_delivery_mappings` فلترة على `city_id` (master id الناتج من mapping المختار) **و** `delivery_partner='alwaseet'`. نحتفظ بـ `city_id` الداخلي من نفس صف الـ mapping كي نستعلم به مباشرة.
- لا نُفعّل `setLoadingCities(true)` إذا كان `cachedCities`/snapshot جاهز.

**`src/components/ui/searchable-select-fixed.jsx`** (السطر ~84–106)
- إضافة `window.addEventListener('scroll', updatePosition, { capture: true, passive: true })` و `orientationchange`.
- التنظيف يزيلها في cleanup.
- ضمان أن `updatePosition` يستخدم `requestAnimationFrame` لتجنب layout thrash.

لا تغييرات في قواعد البيانات ولا في الواجهات الخلفية.

---

## نتائج متوقعة
- اختيار بغداد/الشعلة (وأي محافظة/منطقة) → الطلب يُنشأ بنجاح بدون "لا يمكن التعرف على المحافظة".
- المدن والمناطق تظهر **بنفس اللحظة** عند دخول الصفحة.
- المنسدلة تبقى ملتصقة بالقائمة عند سحب الصفحة لأعلى/أسفل.
