
## الهدف
إصلاح سبب عدم مزامنة طلبات **مدن (MODON)** في:
- المزامنة اليدوية (زر “تحقق الآن” / “مزامنة”)
- عند الدخول لصفحة الطلبات/متابعة الموظفين

مع التأكد أن الربط صحيح مثل المزامنة التلقائية.

---

## التشخيص (المشكلة الجذرية)
### 1) مكتبة MODON على الواجهة الأمامية تستدعي مشروع Supabase مختلف
في `src/lib/modon-api.js` يوجد:
- `edgeFunctionUrl = 'https://tkheostkubborwkwzugl.supabase.co/functions/v1/modon-proxy'`
- و `Authorization` ثابت (Bearer ...)

هذا يعني أن التطبيق يحاول استدعاء `modon-proxy` من **مشروع Supabase آخر** (ref مختلف)، لذلك:
- مزامنة مدن من الواجهة تفشل (خاصة في متابعة الموظفين والمزامنة اليدوية)
- بينما المزامنة التلقائية تعمل لأنها تتم عبر Edge Functions داخل مشروعنا وبصلاحياته الصحيحة

هذه هي أهم نقطة تفسّر “لماذا التلقائية تعمل واليدوية لا”.

### 2) خطأ منطقي/برمجي داخل `syncAndApplyOrders`
في `src/contexts/AlWaseetContext.jsx` دالة `syncAndApplyOrders` أصبحت تجمع طلبات الوسيط + مدن في `allOrders`، لكن في نهاية الدالة يوجد استخدام لمتغير `waseetOrders` غير معرف في هذا النطاق (بعد التعديل).
هذا قد يسبب فشل الدالة أو نتائج غير مكتملة، ويزيد الإحساس أن “مدن لا يتزامن”.

---

## التغييرات المطلوبة (مختصرة)
### A) إصلاح `src/lib/modon-api.js` ليستخدم Supabase الحالي مثل الوسيط
بدلاً من URL ثابت، سنجعل كل استدعاءات MODON تمر عبر:
- `supabase.functions.invoke('modon-proxy', { body: { endpoint, method, token, payload, queryParams, isFormData } })`

بنفس نمط `src/lib/alwaseet-api.js` (الذي يستخدم `supabase.functions.invoke('alwaseet-proxy')`).

**نتيجة هذا التعديل:**
- متابعة الموظفين ستتمكن من جلب طلبات مدن
- المزامنة اليدوية ستجلب طلبات مدن
- اختفاء رسالة التحذير “فشل مزامنة مدن… تحقق من تسجيل الدخول” عندما كان سببها الاتصال بمشروع خاطئ

### B) إصلاح `syncAndApplyOrders` ليعتمد على `allOrders` فقط بدون متغيرات غير معرفة
- استبدال أي `waseetOrders.length` / `return waseetOrders` إلى:
  - `allOrders.length`
  - `return allOrders`
- تحسين رسالة/منطق “تم فحص/تحديث” ليكون صحيحاً للوسيط + مدن

### C) تحسين تشخيص الأخطاء (بدون إزعاج المستخدم)
- إضافة logging موجّه (devLog/console) داخل مسار MODON فقط عند الفشل:
  - هل يوجد token؟
  - هل edge function رجعت error؟
  - ما هو `errNum/msg` من MODON؟
- إبقاء Toast للمستخدم لكن يكون مختصر وواضح:
  - “فشل جلب طلبات مدن: (السبب المختصر)”
  - مع تلميح “قد يكون التوكن منتهي أو يوجد حظر مؤقت”

---

## خطوات التنفيذ بالتسلسل
1) مراجعة `modon-proxy` edge function contract (الحقول المتوقعة) للتأكد أن invoke مطابق.
2) تعديل `src/lib/modon-api.js`:
   - حذف/تعطيل `edgeFunctionUrl` و `authToken` الثابتين
   - استيراد `supabase` من `./customSupabaseClient` (نفس نمط الوسيط)
   - استبدال fetch المباشر بـ `supabase.functions.invoke('modon-proxy')`
   - توحيد معالجة الأخطاء (قراءة `error.context` إن وجدت + رسائل data.msg)
3) تعديل `src/contexts/AlWaseetContext.jsx` داخل `syncAndApplyOrders`:
   - إزالة الاعتماد على متغير غير معرّف
   - إرجاع `allOrders`
   - إصلاح message/count
4) (اختياري لكن مفيد) إضافة “فحص سريع” عند مزامنة الموظفين:
   - إذا كان `partner_name === 'modon'` و token موجود، اعمل call تجريبي سريع، وإذا فشل أعطِ سبب واضح

---

## التحقق بعد التنفيذ (مهم جداً)
### 1) متابعة الموظفين (الصورة المرفقة)
- افتح طلب مدن ثم اضغط “تحقق الآن”
- يجب أن تختفي رسالة التحذير الحمراء الخاصة بـ MODON
- يجب أن تتحدّث “آخر تحديث” للطلب إذا كان هناك تغيير

### 2) صفحة الطلبات
- ادخل صفحة الطلبات (بدون أي مزامنة تلقائية)
- راقب أن طلبات modon تتغير حالاتها مثل الوسيط عند الدخول أو عند الضغط على زر المزامنة

### 3) Network/Console (للتأكد التقني)
- يجب أن ترى استدعاء إلى:
  - `.../functions/v1/modon-proxy` عبر `supabase.functions.invoke`
  - وليس URL ثابت لمشروع آخر
- وتأكد أن Response يعود `status: true` أو تظهر رسالة MODON الفعلية إن كان هناك خطأ من API.

---

## ملاحظات مهمة (منع تداخل الشركاء)
سنحافظ على مبدأ العزل:
- أي تحديث لطلبات مدن يتم تطبيقه فقط على الطلبات التي `delivery_partner = 'modon'`
- وأي تحديث للوسيط فقط على `delivery_partner = 'alwaseet'`

---

## الملفات التي سيتم تعديلها
1) `src/lib/modon-api.js` (السبب الرئيسي)
2) `src/contexts/AlWaseetContext.jsx` (إصلاح syncAndApplyOrders + تحسين الاستقرار)

---

## المخاطر المحتملة وكيف نعالجها
- إذا كانت `modon-proxy` تتطلب headers مختلفة أو CORS: باستخدام `supabase.functions.invoke` لن نواجه مشكلة CORS عادة.
- إذا كان token منتهي: سنُظهر رسالة واضحة، ويمكن الاعتماد على تجديد التوكن التلقائي الموجود عند قرب الانتهاء.

