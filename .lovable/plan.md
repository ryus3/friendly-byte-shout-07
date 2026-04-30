## التشخيص المؤكد

### مشكلة الطلب 140222501

الطلب موجود محلياً:

- `tracking_number = 140222501`
- `delivery_partner = alwaseet`
- `delivery_account_used = alshmry94`
- `created_by = 91484496-b887-44f7-9e5d-be9db5567604`
- `partner_missed_count = 0`
- `last_synced_at = null`

سبب عدم حذفه تلقائياً ليس أن النظام لا يعرف الموظف أو التوكن، بل لأن `sync-order-updates` يفشل في جلب قائمة AlWaseet قبل أن يصل لمرحلة إثبات الحذف.

السجلات تؤكد:

```text
خطأ في جلب طلبات alshmry94: HTTP 400
الطلب 140222501 غير موجود لكن لم يصل رد ناجح من alwaseet - تخطي بأمان
```

وهذا التصرف آمن: النظام لا يحذف إذا فشل API، حتى لا نحذف طلبات صحيحة بسبب حظر/خطأ خارجي.

السبب التقني الواضح:

- `sync-order-updates` يستخدم لـ AlWaseet الرابط المباشر:
  `https://api.alwaseet-iq.net/v1/merchant`
- بينما باقي النظام يستخدم الـ static proxy الصحيح:
  `https://api.ryusbrand.com/alwaseet/v1/merchant`
- لذلك AlWaseet يرجع `HTTP 400` لكل الحسابات، ولا يتم احتساب `partner_missed_count` ولا الحذف.

### هل يعرف الطلب لأي موظف وتوكن ينتمي؟

نعم، قاعدة البيانات تعرف ذلك من:

- `orders.created_by`
- `orders.delivery_partner`
- `orders.delivery_account_used`

لكن منطق الـ Edge Function الحالي يتحقق من نجاح جلب نفس الحساب بهذا المفتاح:

```text
partner + account_username
```

وبما أن الجلب فاشل، لا يسمح بالحذف. هذا صحيح أمنياً، لكن يحتاج إصلاح مسار API.

### هل هناك ضغط عالي؟

حالياً يوجد ضغط غير مثالي:

- عند فتح صفحة الطلبات يتم تشغيل `syncVisibleOrdersBatch`.
- وبعد 5 ثوان يتم تشغيل `sync-order-updates` أيضاً.
- في AlWaseetContext توجد منطق مزامنة وحذف كثيرة وقديمة ومتداخلة.

لكن بالنسبة لهذا الطلب تحديداً: السبب المباشر هو فشل AlWaseet HTTP 400 بسبب عدم استخدام proxy في `sync-order-updates`.

## الخطة الآمنة للتنفيذ

### 1) إصلاح مسار AlWaseet داخل `sync-order-updates`

تغيير مسار AlWaseet فقط إلى الـ static proxy:

```ts
if (partnerName === 'modon') {
  baseUrl = 'https://api.ryusbrand.com/modon/v1/merchant';
} else if (partnerName === 'alwaseet') {
  baseUrl = 'https://api.ryusbrand.com/alwaseet/v1/merchant';
} else {
  baseUrl = partnerBaseMap[partnerName] || 'https://api.alwaseet-iq.net/v1/merchant';
}
```

بدون تغيير:

- منطق الحذف 2-strike
- منطق تحرير المخزون
- منطق الفواتير
- RLS
- بوت التليغرام
- التريغرات المالية/المخزنية

### 2) جعل المطابقة عالمية وآمنة للحسابات المشتركة

سأعدّل داخل `sync-order-updates` منطق `successfulFetches` ليكون أدق:

- النجاح يُسجل حسب:
  `partner + account_username`
- والطلب يُطابق فقط على نفس:
  `delivery_partner + delivery_account_used`
- إذا كان نفس حساب شركة التوصيل مستخدماً عند أكثر من موظف، لا نخلط الطلبات بين الموظفين، بل نستخدم اسم الحساب كشاهد أساسي، ومعرّفات الطلب (`id/qr/tracking`) كشاهد المطابقة.

المبدأ:

```text
لا حذف إلا إذا:
1. جلب الحساب الصحيح نجح فعلاً
2. الطلب غير موجود في نتيجة الحساب الصحيح
3. تكرر الغياب مرتين 2-strike
4. لا توجد حماية مالية تمنع الحذف الفعلي
```

هذا يضمن أنه يعرف الطلب لأي توكن/حساب ينتمي ولا يحذف بسبب فشل API أو حساب خطأ.

### 3) تحسين سجل الأخطاء لتشخيص التوكن بدون كشف أسرار

سأضيف logging آمن في Edge Function:

- الحساب
- الشريك
- status code
- `errNum` إن وجد
- بدون طباعة التوكن

حتى إذا رجع AlWaseet `errNum:21` نعرف هل المشكلة صلاحية endpoint أو توكن فعلاً، بدون تعطيل الحساب تلقائياً.

### 4) إصلاح خطأ `modon_cities_cache` بدون تغيير قاعدة البيانات

الكونسول يظهر:

```text
Could not find table public.modon_cities_cache
```

الجدول غير موجود فعلاً، والموجود هو النظام الموحد:

- `cities_master`
- `regions_master`
- `cities_cache`
- `regions_cache`

سأغيّر في `AlWaseetContext.jsx`:

```js
activePartner === 'modon' ? 'modon_cities_cache' : 'cities_master'
```

إلى استخدام `cities_master` أو جدول الكاش الموحد حسب النمط الحالي، حتى يتوقف الخطأ المتكرر عند فتح الموقع. هذا إصلاح آمن لأنه لا ينشئ جداول ولا يغير بيانات.

### 5) سبب التحميل بعد السبلاش

نعم كلامك صحيح: السبلاش يجب أن يغطي تحميل البداية. المشكلة الآن أن السبلاش ينتهي بعد 2.8 ثانية ثابتة، ثم التطبيق لا يزال ينتظر:

- `useAuth.loading`
- `usePermissions.loading`
- `SuperProvider.loading`
- تحميل Dashboard الذي يشترط `inventoryLoading || loading || !user`

لذلك يظهر Loader بعد السبلاش.

### 6) إصلاح ظهور Loader بعد السبلاش بدون كسر النظام

سأجعل السبلاش لا يختفي بالوقت فقط، بل يبقى إلى أن تنتهي المرحلة الأساسية:

```text
auth ready + permissions ready + أول بيانات أساسية جاهزة أو timeout آمن
```

ثم يظهر التطبيق مباشرة، بدل:

```text
Splash -> Loader -> الصفحة
```

ليصبح:

```text
Splash -> الصفحة
```

مع timeout قصير حتى لا يعلق السبلاش إذا فشل طلب خارجي.

### 7) أسباب بطء فتح الموقع حالياً

الأسباب الأكبر التي وجدتها:

1. `AlWaseetContext.jsx` ضخم جداً ويتم تحميله من البداية، رغم أن معظم وظائفه لا نحتاجها فور فتح الموقع.
2. `SuperProvider` يجلب بيانات كثيرة جداً دفعة واحدة:
   - products
   - orders مع order_items
   - customers
   - purchases
   - expenses
   - profits
   - cash sources
   - settings
   - filters
   - profiles
   - loyalty
3. `UnifiedAuthContext` يجلب الصلاحيات، ثم `UnifiedPermissionsProvider` يجلب نفس الصلاحيات مرة ثانية تقريباً.
4. `ProfitsProvider` يجلب profits وnotifications عند البداية، ثم `useUnifiedProfits` قد يعيد حسابات ثقيلة في Dashboard.
5. خطأ `modon_cities_cache` يكرر طلبات فاشلة ويزيد الضجيج والبطء.
6. صفحة الطلبات تشغل مزامنتين عند الدخول: مزامنة ظاهرة + Edge Function بعد 5 ثوان.

### 8) تحسين الأداء بأقل مخاطرة الآن

لن أعمل refactor كبير الآن. سأطبق فقط إصلاحات منخفضة المخاطرة:

- إصلاح `modon_cities_cache`.
- منع تحميل المدن/الأحجام عند الإقلاع إلا عند الحاجة الفعلية لإنشاء/تعديل طلب.
- جعل السبلاش يغطي التحميل الأساسي بدل ظهور Loader بعده.
- عدم تشغيل مزامنتين متداخلتين عند فتح صفحة الطلبات؛ نترك `sync-order-updates` للحذف الآمن، ونؤجل المزامنة المرئية أو نجعلها لا تعمل إذا كانت Edge Function قيد العمل.

## ما لن أغيره

- لا تعديل RLS.
- لا تعديل search_path.
- لا تعديل تريغرات المخزون/الكاش.
- لا تعديل بوت التليغرام.
- لا حذف أو تعطيل توكنات تلقائياً.
- لا حذف الطلب مباشرة من قاعدة البيانات يدوياً.

## نتيجة التنفيذ المتوقعة

بعد التنفيذ:

- AlWaseet sync سيستخدم المسار الصحيح مثل باقي النظام.
- الطلب `140222501` سيتم فحصه من حساب `alshmry94` الصحيح.
- إذا كان محذوفاً فعلاً من الشركة، سيزيد `partner_missed_count` في أول تشغيل، ثم يُحذف/يُلغى حسب الحماية المالية في التشغيل الثاني.
- لن يحصل حذف عشوائي بسبب API فاشل.
- سيقل تحميل البداية، ويتوقف Loader بعد السبلاش قدر الإمكان.
- يقل الضغط عند فتح صفحة الطلبات.

إذا وافقت، أنفذ بهذا الترتيب الآمن:

```text
1. إصلاح sync-order-updates لـ AlWaseet proxy
2. تحسين منطق الحساب/التوكن المشترك في sync-order-updates
3. إصلاح modon_cities_cache
4. تحسين السبلاش ليغطي التحميل الأساسي
5. تخفيف مزامنة بداية صفحة الطلبات لمنع الضغط
6. اختبار الطلب 140222501 من السجلات وقاعدة البيانات
```
