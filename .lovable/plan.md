# Plan

## What will be fixed now

1. Repair تسجيل الدخول والاحتفاظ بالتوكن لشركات التوصيل بحيث الحساب لا يختفي بعد ثوانٍ.
2. إصلاح خطأ الوسيط جذرياً ومنع الحلقة: TOKEN_EXPIRED ثم 503 ثم اختفاء الجلسة.
3. جعل مدن تستخدم الكاش فعلياً للمدن والمناطق وأحجام الطرود بدل الاستدعاء كل مرة.
4. تثبيت خريطة الترجمة الموحدة بين النظام الداخلي وشركات التوصيل.
5. تشديد حذف الطلب الخارجي: لا حذف محلياً إلا بعد تأكيد قاطع أن الحذف تم فعلاً لدى شركة التوصيل.

## Findings confirmed from the current codebase

- حفظ الجلسة ناقص: `login()` في `AlWaseetContext.jsx` يحفظ السجل في DB ويضبط `token` داخل الحالة، لكنه لا يحدّث `tokenExpiry` ولا يكتب `delivery_partner_default_token` بعد تسجيل الدخول مباشرة. لهذا الاسترجاع لاحقاً يعتمد على بيانات غير مكتملة أو قديمة.
- `restoreSession()` يثق بـ `localStorage` مباشرة ويعيد الجلسة بدون التحقق أن السجل ما زال `is_active=true` وأن التوكن نفسه ما زال هو الأحدث في DB.
- عند `errNum:21` يتم تنظيف الحالة المحلية، لكن التطبيق يطلق عدة طلبات متتالية للوسيط في نفس اللحظة؛ سجل الشبكة أظهر `200 TOKEN_EXPIRED` ثم بعدها مباشرة `503 Service temporarily unavailable` من نفس edge function.
- لا يوجد حالياً تكرار سجلات لنفس الحساب في DB، لكن سبب التراكم البنيوي ما زال موجوداً لأن dedupe يتم في الواجهة فقط وليس بقيد قاعدة بيانات/تطبيع حاسم.
- كاش MODON موجود فعلاً في DB الآن: 18 مدينة، 5755 ربط منطقة لـ MODON، و4 أحجام طرود. لكن الواجهة لا تستخدمه بالكامل:
  - `QuickOrderContent.jsx` ما زال يستدعي `ModonAPI.getCities/getRegionsByCity/getPackageSizes` مباشرة.
  - `fetchRegions()` في `AlWaseetContext.jsx` يقرأ `regions_master.city_id = cityId` بينما `cityId` الخاص بمدن في الواجهة هو `external_id`، لذلك الكاش يفشل ثم يسقط إلى API.
  - لا يوجد أي كود يكتب إلى `package_sizes_cache`; الجدول يُقرأ فقط، لذلك أحجام الطرود ليست مضمونة التحديث.
- خريطة الترجمة الموحدة موجودة فعلاً عبر `city_delivery_mappings` و`region_delivery_mappings` ويستخدمها `AlWaseetUnifiedOrderCreator.jsx` وbot/AI، لكن تحميل الواجهة ما زال غير موحّد معها.
- حذف الطلبات اليدوي في `SuperProvider.jsx` خطير حالياً: يحذف من `orders` مباشرة بدون التحقق من نجاح الحذف في شركة التوصيل. هذا يخالف طلبك الصارم.

## Implementation plan

### 1) Repair delivery login persistence and token lifecycle
- إنشاء مسار موحّد داخل `AlWaseetContext.jsx` لتفعيل الحساب بعد login/renew/restore:
  - يضبط `token`, `tokenExpiry`, `waseetUser`, `isLoggedIn`, `activePartner`
  - يكتب `delivery_partner_default_token` بشكل موحّد وآمن
  - يحدّث `delivery_default_accounts`
- تعديل `restoreSession()` ليقرأ من DB أولاً، ثم يقبل `localStorage` فقط إذا طابق سجلاً نشطاً وغير منتهي ومطابقاً للحساب الافتراضي.
- تعديل `logout()` وحدث `alwaseet-token-expired` ليحذفا كل مفاتيح الجلسة المرتبطة بالشريك والحساب الافتراضي، لا جزءاً منها فقط.
- منع الطلبات المتوازية للوسيط بعد انتهاء الجلسة بإضافة guard محلي يوقف أي استدعاء جديد عندما تكون الجلسة معلّمة كمنتهية حتى يعاد تسجيل الدخول.

### 2) Eliminate token accumulation at the source
- إضافة migration تنظّف وتفرض الاتساق في `delivery_partner_tokens`:
  - توحيد `normalized_username`
  - unique index على `(user_id, partner_name, normalized_username)`
  - partial unique index يضمن افتراضي واحد فقط لكل `(user_id, partner_name)` عندما `is_default=true`
- تعديل login/renew/proxy deactivation ليستخدم `normalized_username` دائماً بدل `ilike(account_username)` فقط.
- تعديل auto-renew بحيث يحدّث السجل الصحيح بدقة باستخدام `id` أو `normalized_username + partner + user` وليس مطابقة رخوة.

### 3) Harden AlWaseet proxy against the current crash loop
- تعديل `alwaseet-proxy` ليبقى دائماً داخل envelope JSON حتى في المسارات الفاشلة غير المتوقعة.
- إزالة `console.*` المباشر داخل الكود التطبيقي واستبداله بنمط آمن حيث يلزم في الواجهة، وتقليل burst الطلبات بعد `TOKEN_EXPIRED`.
- فحص سبب 503 مع نشر النسخة الجديدة ثم التحقق عبر logs أن المسار يرجع `200` منظم حتى وقت الانتهاء.

### 4) Make MODON fully cache-first in the UI
- تعديل `QuickOrderContent.jsx` و`AlWaseetContext.jsx` لاستخدام DB cache لمدن ومناطق مدن وأحجام الطرود قبل أي API، وبصورة افتراضية دائمة.
- تحميل مدن MODON عبر join/lookup من `city_delivery_mappings + cities_master` بحيث تعرض الأسماء الداخلية لكن تحتفظ بـ `external_id` الصحيح للإرسال.
- تحميل مناطق MODON عبر `region_delivery_mappings + regions_master` مفلترة حسب `external city id` المختار، وليس `regions_master.city_id` مباشرة.
- إزالة السقوط إلى API من شاشة الإنشاء السريع إلا إذا كان الكاش فارغاً فعلاً أو في مزامنة يدوية مقصودة.

### 5) Complete MODON cache coverage
- توسيع `update-modon-cache` ليزامن أيضاً `package_sizes_cache` مثل المدن والمناطق.
- تحديث `useCitiesCache`/مكوّنات الإدارة كي تعرض بوضوح عدد مدن ومناطق وأحجام MODON من آخر مزامنة ناجحة.
- الحفاظ على hub الموحّد الحالي كمرجع وحيد للترجمة وعدم إنشاء مسار موازٍ جديد.

### 6) Enforce safe external order deletion
- تعديل مسار الحذف اليدوي في `SuperProvider.jsx`:
  - الطلب المحلي فقط: الحذف المباشر كما هو.
  - الطلب الخارجي: لا حذف محلياً قبل محاولة حذف/تحقق خارجي.
  - إذا التوكن منتهي، أو الاتصال فشل، أو لم يصل تأكيد قاطع من شركة التوصيل: يمنع الحذف المحلي وتظهر رسالة واضحة.
- إعادة استخدام منطق الحماية الموجود في `AlWaseetContext` و`alwaseet-api.getOrderByQR()` بدلاً من وجود مسارين متناقضين.
- توسيع المنطق ليشمل MODON أيضاً، مع نفس القاعدة: local delete only after confirmed remote success.

## Technical details

```text
Unified delivery cache flow
UI selection
  -> cities_master + city_delivery_mappings(partner)
  -> regions_master + region_delivery_mappings(partner)
  -> package_sizes_cache(partner)
  -> order creator translates internal IDs to partner external_id
  -> partner API
```

```text
Safe token lifecycle
login/renew/restore
  -> normalize username
  -> upsert exact token row
  -> set one default row only
  -> write validated local session snapshot
errNum:21
  -> deactivate DB row
  -> clear local session snapshot
  -> stop further partner requests
  -> require manual re-login
```

```text
Safe external deletion
Delete click
  -> identify local vs external order
  -> if external: validate active token
  -> call remote delete or remote existence check
  -> delete locally only when remote confirmed success/not-found conclusively
  -> otherwise block delete and keep local order untouched
```

## Files likely to change

- `src/contexts/AlWaseetContext.jsx`
- `src/lib/alwaseet-api.js`
- `src/lib/modon-api.js`
- `src/components/quick-order/QuickOrderContent.jsx`
- `src/contexts/SuperProvider.jsx`
- `src/hooks/useCitiesCache.js`
- `supabase/functions/alwaseet-proxy/index.ts`
- `supabase/functions/update-modon-cache/index.ts`
- `supabase/functions/refresh-delivery-partner-tokens/index.ts`
- new Supabase migration for token uniqueness/default consistency

## Validation after implementation

1. تسجيل الدخول للوسيط ثم تحديث الصفحة والتأكد أن الحساب يبقى محفوظاً.
2. افتعال `errNum:21` والتأكد أن الجلسة تُمسح مرة واحدة بلا 503 ولا overlay.
3. فتح نموذج مدن والتأكد أن المدن/المناطق/الأحجام تُحمّل من الكاش بدون نداءات API متكررة.
4. التحقق أن عدد مناطق MODON الظاهر يطابق المزامنة الأخيرة المخزنة.
5. تجربة حذف طلب خارجي مع:
   - توكن صالح
   - توكن منتهي
   - فشل اتصال
   والتأكد أن الحذف المحلي لا يتم إلا عند التأكيد القاطع.
