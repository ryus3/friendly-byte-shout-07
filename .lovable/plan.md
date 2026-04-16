

## خطة إصلاح شاملة - 6 مشاكل حرجة

---

### 1. قواعد الأرباح لا تُعطى من مدير القسم لموظفيه

**التشخيص**: سارة (مدير قسم) لديها صلاحية `manage_profit_settlement` وRLS يسمح لها. البيانات في قاعدة البيانات موجودة فعلاً (سارة أنشأت قاعدتين لأحمد). المشكلة في **العرض** وليس في الحفظ:

- في `DepartmentManagerSettingsPage.jsx` سطر 196-234: الجلب يعمل بشكل صحيح `.in('employee_id', supervisedEmployeeIds)`.
- **السبب الجذري المحتمل**: `supervisedEmployeeIds` قد تكون فارغة أو لا تحتوي على أحمد. من البيانات: سارة (`f10d8ed9`) مشرفة على أحمد (`fba59dfc`) ✓. لكن هناك احتمال أن `useSupervisedEmployees` لا تُرجع النتائج بشكل صحيح لمدير القسم.
- **إصلاح إضافي**: القواعد التي أنشأها المدير العام (created_by = NULL) لا تظهر لسارة لأن الـ RLS يشترط `manage_profit_settlement` أو أن الموظف يرى قواعده فقط. يجب التأكد أن سارة ترى قواعد موظفيها **بغض النظر عمن أنشأها**.

**الملفات**:
- `src/hooks/useSupervisedEmployees.js` - التحقق من إرجاع البيانات الصحيحة
- `src/pages/DepartmentManagerSettingsPage.jsx` - تحسين عرض القواعد + إضافة رسالة خطأ واضحة
- Migration إذا لزم لإضافة RLS policy تسمح لمدير القسم برؤية قواعد موظفيه المشرف عليهم

---

### 2. تعديل عدد المنتجات يتأخر ويحتاج تحديث يدوي

**التشخيص**: في `SuperProvider.jsx` سطر 831-843، عند تغيير `products` أو `product_variants`، يستدعي `dbRefetchProducts()` ثم `superAPI.fetchAllData()` كاملاً. هذا:
- بطيء (يعيد جلب كل البيانات)
- فيه ازدواجية (dbRefetchProducts + fetchAllData.products)

**الإصلاح**:
- استخدام `dbRefetchProducts()` فقط بدون `fetchAllData()`
- تحديث الحالة المحلية مباشرة من نتيجة `dbRefetchProducts`
- تقليل الـ debounce من 300ms إلى 100ms

**الملف**: `src/contexts/SuperProvider.jsx`

---

### 3. الطلبات الذكية لا تظهر فوراً بعد الموافقة في صفحة الطلبات

**التشخيص**: عند الموافقة على طلب ذكي (`approveAiOrder`)، يتم إنشاء طلب حقيقي في قاعدة البيانات. Realtime يستمع لجدول `orders` ويضيفه عبر `addOrderInstantly`. لكن المشكلة:
- `addOrderInstantly` قد لا يعمل بشكل صحيح إذا الطلب الجديد لم يُطابق صيغة العرض
- أو الـ Realtime subscription غير مفعّل على Vercel

**الإصلاح**:
- بعد `approveAiOrder` الناجح، إضافة `refreshDataInstantly()` أو استدعاء مباشر لجلب الطلب الجديد ودمجه في الحالة
- التأكد من أن `addOrderInstantly` يعمل بشكل صحيح مع normalize

**الملف**: `src/contexts/SuperProvider.jsx` (دالة `approveAiOrder`)

---

### 4. جلسة تسجيل الدخول لا تُحفظ

**التشخيص**: الإعدادات في `client.ts` صحيحة (`persistSession: true`). لكن في `UnifiedAuthContext.jsx`:
- السطر 213: `if (sessionHandled && event !== 'TOKEN_REFRESHED' && event !== 'SIGNED_IN')` - هذا يمنع إعادة معالجة الجلسة عند `INITIAL_SESSION` إذا `sessionHandled` أصبح true مبكراً
- السطر 261: `if (session?.user && !sessionHandled)` - race condition بين `onAuthStateChange` و `checkExistingSession`
- المشكلة الحقيقية: إذا `fetchUserProfile` فشل أو أرجع profile بحالة غير `active`، يتم `setUser(null)` رغم وجود session صالحة

**الإصلاح**:
- إزالة `sessionHandled` flag والاعتماد على deduplication أذكى
- عند فشل `fetchUserProfile`، عدم مسح الـ user إذا كان هناك session صالحة - إعادة المحاولة
- إضافة retry logic مع backoff عند فشل جلب البروفايل

**الملف**: `src/contexts/UnifiedAuthContext.jsx`

---

### 5. شريط تقدم المناطق يبقى 0 أثناء التحديث + MODON لا يحمّل

**التشخيص**: 
- **خطأ WORKER_RESOURCE_LIMIT**: Edge Function تموت قبل إكمال جلب المناطق لأنها تجلب المناطق لكل مدينة بشكل تتابعي مع 300ms delay = 18 مدينة × 300ms = 5.4 ثانية فقط للانتظار + وقت المعالجة. لكن مع 6232 منطقة وعمليات upsert فردية، تتجاوز الحد الأقصى للذاكرة/الوقت.
- **المنطق**: السجل يُحدّث كل 5 مدن فقط، لكن الدالة تموت قبل ذلك أحياناً.
- **MODON**: نفس المشكلة - `update-modon-cache` يواجه نفس حدود الموارد.
- **الحل**: استخدام batch upsert بدل واحد واحد، وتقسيم العمل إلى chunks أصغر، وتحديث شريط التقدم بشكل أكثر تكراراً.

**الإصلاح**:
- تعديل `update-cities-cache/index.ts`: batch upsert للمناطق، تحديث التقدم كل مدينة بدل كل 5
- إضافة `delivery_partner: 'alwaseet'` للـ sync log INSERT
- تعديل `update-modon-cache/index.ts`: نفس التحسينات + إضافة `delivery_partner: 'modon'`
- تقليل حجم الذاكرة المستخدمة (عدم تخزين كل المناطق في الذاكرة)

**الملفات**:
- `supabase/functions/update-cities-cache/index.ts`
- `supabase/functions/update-modon-cache/index.ts`

---

### 6. تحسين سرعة الموقع بشكل عام

**الإصلاحات المتضمنة في البنود أعلاه**:
- تحديث فوري للمنتجات بدون `fetchAllData()` الكامل (بند 2)
- إضافة الطلبات فوراً بعد الموافقة (بند 3)
- عدم إعادة جلب البروفايل عند كل `TOKEN_REFRESHED` (بند 4)

**إضافي**:
- في `SuperAPI.js`: عند تغيير `products`/`product_variants`، عدم عمل `invalidate('all_data')` - فقط invalidate المنتجات
- تقليل الـ debounce للجداول الأخرى من 500ms إلى 200ms

**الملف**: `src/api/SuperAPI.js`

---

### ترتيب التنفيذ

| # | المهمة | الملفات |
|---|--------|---------|
| 1 | إصلاح جلسة تسجيل الدخول | `UnifiedAuthContext.jsx` |
| 2 | إصلاح تحديث فوري للمنتجات + طلبات ذكية | `SuperProvider.jsx`, `SuperAPI.js` |
| 3 | إصلاح قواعد أرباح مدير القسم | `DepartmentManagerSettingsPage.jsx` + migration إذا لزم |
| 4 | إصلاح Edge Functions للكاش (المناطق 0 + MODON) | `update-cities-cache/index.ts`, `update-modon-cache/index.ts` |

