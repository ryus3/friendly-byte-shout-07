## الفحص العميق — ماذا حدث بالضبط

تتبعت الطلب من النقر على "موافقة" حتى رد API مدن باستخدام لوغ `modon-proxy` وقاعدة البيانات. النتيجة: **الطلب فعلاً ذهب إلى مدن** (وليس للوسيط)، والحساب `ryus-brand` صالح وعامل، والتوكن لم يُخلط بين الشركات. لكن مدن نفسها ردت بخطأ، ثم proxy أساء فهم الرد.

### السبب الجذري الحقيقي (مكوَّن من جزأين)

**الجزء 1 — خلل في `modon-proxy`:**
عند استدعاء `create-order`، ردت API مدن بـ:
```
HTTP 400, errNum: 21, msg: "ليس لديك صلاحية الوصول"
```
الـ proxy يفترض أن **أي** `errNum:21` يعني "لا توجد فواتير" (وهو صحيح فقط لـ endpoint الفواتير)، فيحوّل الرد قسراً إلى `status:true, errNum:'21', data:[]`. عند `createModonOrder` يفشل شرط النجاح (`errNum==='S000'`) فيرمي `data.msg` = "ليس لديك صلاحية الوصول" — وهي صياغة مطابقة حرفياً لرسالة الوسيط، فظن المستخدم أن الطلب ذهب للوسيط. **لم يذهب — ذهب لمدن، ومدن رفضته**.

**الجزء 2 — لماذا رفضت مدن الطلب؟**
الطلب الذكي خزّن `region_id=11833` (canonical id داخلي). resolver وجد المنطقة بالاسم "حي الجامعه نفق الشرطة" وأعاد `region_external_id=546` لمدن. لكن مدن ردت errNum:21 على هذا الـ region — على الأرجح لأن:
- كاش مدن لم يُزامَن منذ 4 أيام (آخر تحديث 2026-04-25)
- أو region 546 لا ينتمي فعلاً لـ city 1 في API مدن الحالية (تغيرت الأرقام)

أي رفض لمدن لـ region/city = `errNum:21 + "ليس لديك صلاحية الوصول"`. لذلك أي طلب مدن تكون فيه أرقام المنطقة قديمة سيفشل بهذه الرسالة المضللة.

### الريلتايم — لم أعبث به وهو سليم

تحققت من:
- `ai_orders` ضمن publication `supabase_realtime` ✅
- `replica_identity = full` ✅
- `SuperAPI.setupRealtimeSubscriptions` يشترك على ai_orders ويبث `aiOrderCreated` ✅
- `AiOrdersManager` و`AiOrderCard` يستمعان للحدث

السبب الأرجح لتأخر ظهور الطلبات في الكرت/النافذة هو طلبات لم تُنشأ أصلاً (فشلت في المرحلة أعلاه، فلم يحدث `INSERT` على `ai_orders`). لذا تظهر النافذة فارغة ولا event يُطلَق.

---

## الحل (4 إصلاحات منطقية، صفر تخريب)

### 1) إصلاح `modon-proxy` — تمييز errNum:21 حسب الـ endpoint
علاج جذري: فقط endpoints الفواتير (`merchant-invoices`, `merchant-invoices/orders`) تعتبر errNum:21 = "لا فواتير". أي endpoint آخر (خصوصاً `create-order`) يجب أن يُمرَّر الخطأ كـ `status:false` مع رسالة واضحة:

```ts
// supabase/functions/modon-proxy/index.ts (~ سطر 128-143)
if (response.status === 400) {
  const isInvoicesEndpoint = endpoint?.includes('merchant-invoices');
  
  if ((data.errNum === 21 || data.errNum === '21') && isInvoicesEndpoint) {
    // فواتير فقط: errNum:21 = لا فواتير = حالة طبيعية
    return jsonResponse({ status: true, errNum: '21', msg: data.msg, data: [] });
  }
  
  // أي errNum:21 على create-order/edit-order = خطأ حقيقي في city/region/طلب
  return jsonResponse({
    status: false,
    errNum: data.errNum || 'E400',
    msg: data.errNum === 21 || data.errNum === '21'
      ? `مدن رفضت الطلب: ${data.msg || ''}. تأكد من تحديث كاش المحافظات/المناطق لشركة مدن.`
      : (data.msg || 'طلب غير صالح'),
    httpStatus: 400
  });
}
```

### 2) رسالة خطأ واضحة في `createModonOrder`
لما يفشل create-order، أعرض للمستخدم رسالة عربية تخبره بسبب الفشل وكيف يحلّه:

```js
// src/lib/modon-api.js — داخل createModonOrder
if (data.status === true && (data.errNum === 'S000' || data.errNum === '0')) { ... }

// خطأ city/region من مدن
if (data.errNum === 21 || data.errNum === '21') {
  throw new Error('مدن رفضت المحافظة/المنطقة. حدّث كاش مدن من إدارة الكاش ثم أعد المحاولة.');
}
throw new Error(data.msg || 'فشل إنشاء الطلب في مدن');
```

### 3) Pre-check في `approveAiOrder` — لا نضرب API مدن لو كاشها قديم
إذا كان كاش مدن قديماً (>3 أيام) والمحافظة المُحلَّة هي بغداد + منطقة فرعية، أعرض تنبيهاً للمستخدم بدلاً من إرسال طلب يفشل:

```js
// src/contexts/SuperProvider.jsx بعد resolver، قبل createModonOrder
if (destination === 'modon') {
  const { data: lastSync } = await supabase
    .from('region_delivery_mappings')
    .select('updated_at')
    .eq('delivery_partner', 'modon')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  const cacheAgeMs = lastSync ? Date.now() - new Date(lastSync.updated_at).getTime() : Infinity;
  const cacheStaleHours = cacheAgeMs / (1000 * 60 * 60);
  
  if (cacheStaleHours > 72) {
    devLog.warn(`⚠️ كاش مدن قديم (${Math.round(cacheStaleHours)} ساعة)`);
    // لا نمنع الإرسال (قد ينجح)، فقط نسجل تحذيراً
  }
}
```
هذا تحذير فقط — لا يمنع الطلب لأنه قد ينجح؛ الإصلاح الجوهري في خطوتي 1 و2.

### 4) تأكيد الفور Realtime على البطاقة + النافذة
الريلتايم على DB سليم. أضمن في الـ UI أن الحدث `aiOrderCreated` يُحدِّث:
- عداد البطاقة في الـ Dashboard
- قائمة `AiOrdersManager`

```jsx
// src/components/dashboard/AiOrdersManager.jsx — useEffect إضافي
useEffect(() => {
  const onCreated = (e) => {
    refreshAll?.(); // أو optimistic add مباشرة من e.detail
  };
  window.addEventListener('aiOrderCreated', onCreated);
  return () => window.removeEventListener('aiOrderCreated', onCreated);
}, [refreshAll]);
```
(سأتحقق من الموجود فعلاً قبل الإضافة لتجنب التكرار.)

---

## ضمانات (لا تخريب)

- **لا تعديل** على `setActivePartner`, `getTokenForUser`, `delivery_partner_tokens`, RLS، أو منطق المخزون.
- **لا تعديل** على ريلتايم publication أو `replica_identity`.
- **لا تعديل** على بوت تليغرام أو على `resolve_partner_location`.
- **لا تعديل** على alwaseet-proxy أو alwaseet-api (مساره يعمل بشكل صحيح).
- التغيير في `modon-proxy` محصور في فرع HTTP 400 + errNum:21، ومُفصَّل بـ endpoint — لن يكسر سلوك الفواتير الحالي.
- التغيير في `modon-api.js` و`SuperProvider.jsx` رسائل واضحة فقط.

## كيفية التعرف على التوكن لكل طلب (إجابة سؤالك)

النظام **بالفعل** يفعل ذلك بدقة الآن (تم في الجولة السابقة):
- `approveAiOrder(orderId, destination, account)` يأخذ destination و account من نافذة الموافقة (مهما كان الافتراضي).
- يجلب توكن من `delivery_partner_tokens` بالتطابق الصارم على `(user_id, partner_name=destination, account_username=account, is_active, expires_at>now)`.
- يستدعي `ModonAPI` أو `AlWaseetAPI` حسب `destination` فقط.
- لا fallback عبر شركات.

لإضافة شركة توصيل ثالثة مستقبلاً: تُضاف صفوف في `city_delivery_mappings` و`region_delivery_mappings` بـ `delivery_partner='شركة_جديدة'`، يُكتب `xxx-api.js` و`xxx-proxy/index.ts`، ويُضاف فرع في `approveAiOrder` و`AiOrderDestinationSelector`. لا تغيير على نواة المنطق.

## الملفات المُعدَّلة

- `supabase/functions/modon-proxy/index.ts` — تمييز errNum:21 حسب endpoint
- `src/lib/modon-api.js` — رسالة خطأ واضحة في `createModonOrder`
- `src/contexts/SuperProvider.jsx` — تحذير كاش مدن القديم (لوغ فقط)
- `src/components/dashboard/AiOrdersManager.jsx` — تأكيد listener `aiOrderCreated` (لو ناقص)

## بعد التطبيق

1. سيتضح للمستخدم بدقة سبب رفض مدن (مع توجيه لتحديث الكاش).
2. لن تُخلط رسائل الوسيط ومدن مرة أخرى.
3. الحالة الحالية (region 11833 = "حي الجامعه نفق الشرطة"): يُنصح بزر "تحديث كاش مدن" من واجهة إدارة شركات التوصيل لتزامن الأرقام الجديدة قبل إعادة محاولة الطلب.