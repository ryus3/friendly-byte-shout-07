
# خطة إصلاح مزامنة طلبات مدن

## المشكلة المكتشفة

### نتائج الفحص المباشر:

| البيان | من API مدن | في قاعدة البيانات | الحالة |
|--------|-----------|-------------------|--------|
| السعر | 30,000 | 33,000 | لم يُحدّث |
| المنطقة | بيرش | بانك ستي | لم يُحدّث |
| الحالة | 1 | 1 | متطابق |

### السبب الجذري (3 مشاكل):

**1. مزامنة العنوان مشروطة بتغيير الحالة**
```
السطور 261-269 داخل block:
if (statusChangedCheck) {
  // ... تحديث الحالة ...
  
  // ✅ مزامنة خفيفة للمدينة والمنطقة (فقط عند تغيير الحالة)
  if (waseetOrder.city_name && ...) {
    updates.customer_city = waseetOrder.city_name;
  }
}
```
**المشكلة:** إذا لم تتغير الحالة = لا تتم مزامنة العنوان أبداً!

**2. التحديث لا يحفظ عند وجود الحساب فقط**
```typescript
// السطر 316 - الشرط:
if (statusChanged || priceChanged || accountChanged) {
  // ... إضافة للتقرير ...
}

// السطر 351-355 - التحديث:
await supabase.from('orders').update(updates).eq('id', localOrder.id);
```
**المشكلة:** عندما يتغير السعر فقط (بدون حالة)، الـ `updates` object يحتوي على `final_amount`، لكن **لا يتم تسجيل التغيير في التقرير** لأن شرط الدخول للـ block يتطلب `statusChanged || priceChanged`.

**3. السعر لا يُحفظ فعلاً!**
الـ API response أظهر:
```json
{"changes": [{"changes": ["السعر: 33000 → 30000 د.ع"]}], "updated": 1}
```
لكن قاعدة البيانات لا تزال تُظهر `33000`!

هذا يعني أن **الـ update statement ينفّذ لكن لا يُحفظ** - قد يكون بسبب خطأ صامت أو RLS.

---

## التحقق الإضافي المطلوب

قبل الإصلاح، سأتحقق من:
1. هل يوجد RLS على جدول orders يمنع التحديث؟
2. هل الـ update يُرجع خطأ صامت؟

---

## الإصلاحات المطلوبة

### إصلاح 1: نقل مزامنة العنوان خارج شرط الحالة
```typescript
// قبل: داخل if (statusChangedCheck)
// بعد: مستقل تماماً

// مزامنة العنوان دائماً (بغض النظر عن تغيير الحالة)
if (waseetOrder.city_name && localOrder.customer_city !== waseetOrder.city_name) {
  updates.customer_city = waseetOrder.city_name;
  changesList.push(`المدينة: ${localOrder.customer_city} → ${waseetOrder.city_name}`);
}
if (waseetOrder.region_name && localOrder.customer_province !== waseetOrder.region_name) {
  updates.customer_province = waseetOrder.region_name;
  changesList.push(`المنطقة: ${localOrder.customer_province} → ${waseetOrder.region_name}`);
}
// إضافة: مزامنة location (العنوان التفصيلي)
if (waseetOrder.location && localOrder.customer_address !== waseetOrder.location) {
  updates.customer_address = waseetOrder.location;
}
```

### إصلاح 2: إضافة متغير addressChanged
```typescript
let statusChanged = false;
let priceChanged = false;
let accountChanged = false;
let addressChanged = false;  // ✅ جديد

// ... في مكان مزامنة العنوان ...
if (waseetOrder.city_name && localOrder.customer_city !== waseetOrder.city_name) {
  updates.customer_city = waseetOrder.city_name;
  addressChanged = true;
  changesList.push(...);
}

// ... تحديث الشرط ...
if (statusChanged || priceChanged || accountChanged || addressChanged) {
  // الآن يُسجل التغيير
}
```

### إصلاح 3: التحقق من نتيجة التحديث
```typescript
// قبل:
await supabase.from('orders').update(updates).eq('id', localOrder.id);

// بعد:
const { error: updateError } = await supabase
  .from('orders')
  .update(updates)
  .eq('id', localOrder.id);

if (updateError) {
  console.error(`❌ فشل تحديث الطلب ${localOrder.order_number}:`, updateError);
}
```

---

## التحقق من التوكن التلقائي (إجابة على سؤالك)

**هل التوكن يتجدد تلقائياً لمدن؟**
✅ نعم! بعد آخر تعديل، دالة `refresh-delivery-partner-tokens` تدعم كلا الشركتين:
```typescript
.in('partner_name', ['alwaseet', 'modon'])

const loginResult = tokenRecord.partner_name === 'modon'
  ? await loginToModon(username, password)
  : await loginToAlWaseet(username, password);
```

**هل المزامنة تعرف أي طلب لأي شركة؟**
✅ نعم! الفصل موجود وآمن:
```typescript
if (waseetOrder._partner !== localOrder.delivery_partner) {
  console.warn(`⚠️ تم تجاهل الطلب - تداخل بين الشركات!`);
  continue;
}
```

---

## ملخص التعديلات

| الملف | التعديل |
|-------|---------|
| `supabase/functions/sync-order-updates/index.ts` | 1. نقل مزامنة العنوان خارج شرط الحالة |
|  | 2. إضافة `addressChanged` flag |
|  | 3. تحديث شرط الدخول للتقرير |
|  | 4. التحقق من نتيجة التحديث |
|  | 5. مزامنة `location` → `customer_address` |

---

## تسلسل التنفيذ

1. تعديل Edge Function
2. Deploy
3. تشغيل المزامنة يدوياً للاختبار
4. التحقق من قاعدة البيانات أن القيم تحدثت فعلاً

---

## الملاحظة عن الـ cron job

لاحظت أن `last_run_at` في جدول `auto_sync_schedule_settings` = `null`!

هذا يعني أن الـ **cron job** (`sync-order-updates-scheduled`) الذي يعمل كل دقيقة **لا يُطابق الأوقات المحددة** (`09:00`, `23:45`).

الدالة `check_and_run_sync()` تستخدم `TO_CHAR(NOW(), 'HH24:MI')` بتوقيت **UTC** بينما الأوقات المحفوظة بتوقيت **بغداد**.

لكن هذا ليس المشكلة الرئيسية الآن - المشكلة هي أن **التحديثات لا تُحفظ حتى عند تشغيلها يدوياً**.
