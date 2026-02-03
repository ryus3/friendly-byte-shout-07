

# تحليل: لماذا المزامنة اليدوية تزامن الوسيط فقط ولا تزامن مدن؟

## المشكلة الجذرية المكتشفة

### 1. دالة `fastSyncPendingOrders` - **مُثبتة على الوسيط فقط!** ❌

| السطر | الكود الحالي | المشكلة |
|-------|-------------|---------|
| 2713 | `.eq('delivery_partner', 'alwaseet')` | **جلب طلبات الوسيط فقط!** |

```javascript
// src/contexts/AlWaseetContext.jsx - السطر 2713
const { data: pendingOrders, error: pendingErr } = await scopeOrdersQuery(
  supabase
    .from('orders')
    .select('...')
    .eq('delivery_partner', 'alwaseet')  // ❌ المشكلة هنا!
    .in('status', targetStatuses)
).limit(200);
```

### 2. دالة `syncAndApplyOrders` - **تستخدم الوسيط فقط!** ❌

| السطر | الكود الحالي | المشكلة |
|-------|-------------|---------|
| 3428 | `AlWaseetAPI.getMerchantOrders(token)` | **API الوسيط فقط!** |

```javascript
// src/contexts/AlWaseetContext.jsx - السطر 3428
const waseetOrders = await AlWaseetAPI.getMerchantOrders(token);
// ❌ لا يتم استدعاء ModonAPI.getMerchantOrders
```

### 3. دالة `syncVisibleOrdersBatch` - **تعمل بشكل صحيح!** ✅

هذه الدالة تدعم كلا الشركتين:
```javascript
// السطر 669-704
if (employeeTokenData.partner_name === 'modon') {
  merchantOrders = await ModonAPI.getMerchantOrders(employeeTokenData.token);
} else {
  // الوسيط
  merchantOrders = await AlWaseetAPI.getOrdersByIdsBulk(...);
}
```

---

## ملخص المشاكل

| الدالة | تُستخدم في | تدعم الوسيط | تدعم مدن |
|--------|----------|-------------|----------|
| `fastSyncPendingOrders` | عند دخول صفحة الطلبات | ✅ | ❌ |
| `syncAndApplyOrders` | زر المزامنة الشاملة | ✅ | ❌ |
| `syncVisibleOrdersBatch` | المزامنة التلقائية | ✅ | ✅ |

---

## الحل المقترح

### التعديل 1: `fastSyncPendingOrders` - دعم كلا الشركتين

```javascript
// قبل (السطر 2713):
.eq('delivery_partner', 'alwaseet')

// بعد:
.in('delivery_partner', ['alwaseet', 'modon'])
```

**+ إضافة:** استدعاء `ModonAPI.getMerchantOrders` للطلبات التي تنتمي لمدن.

### التعديل 2: `syncAndApplyOrders` - دعم كلا الشركتين

```javascript
// بعد جلب طلبات الوسيط، إضافة جلب طلبات مدن:
let modonOrders = [];
const modonTokenData = await getTokenForUser(user?.id, null, 'modon');
if (modonTokenData?.token) {
  modonOrders = await ModonAPI.getMerchantOrders(modonTokenData.token);
}
```

---

## التأثير المتوقع

| قبل | بعد |
|-----|-----|
| دخول صفحة الطلبات يزامن الوسيط فقط | دخول صفحة الطلبات يزامن **الوسيط + مدن** |
| زر المزامنة الشاملة يزامن الوسيط فقط | زر المزامنة الشاملة يزامن **الوسيط + مدن** |
| المزامنة التلقائية تزامن الكل ✅ | نفسه ✅ |

---

## الملفات المطلوب تعديلها

| الملف | الدوال | التعديل |
|-------|--------|---------|
| `src/contexts/AlWaseetContext.jsx` | `fastSyncPendingOrders` | دعم `.in(['alwaseet', 'modon'])` + استدعاء ModonAPI |
| `src/contexts/AlWaseetContext.jsx` | `syncAndApplyOrders` | جلب طلبات مدن بالإضافة للوسيط |

---

## ملاحظة تقنية

سبب عدم وجود هذه المشكلة في المزامنة التلقائية:
- `syncVisibleOrdersBatch` يعتمد على الطلبات الظاهرة في الشاشة
- يتحقق من `order.delivery_partner` لكل طلب
- يستدعي API المناسب (`ModonAPI` أو `AlWaseetAPI`) تلقائياً

