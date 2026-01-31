
# خطة إصلاح: حساب الخصم والزيادة في مزامنة طلبات مدن

## المشكلة المكتشفة

### مقارنة بين الطلبين:

| الطلب | السعر الأصلي | السعر الجديد | الخصم | price_change_type |
|-------|-------------|--------------|-------|-------------------|
| **الوسيط** (ORD000802) | 28,000 | 25,000 | **3,000** ✅ | **discount** ✅ |
| **مدن** (ORD000814) | 28,000 | 25,000 | **0** ❌ | **null** ❌ |

### السبب الجذري:

**كود AlWaseetContext.jsx (السطور 3807-3822) يحسب بشكل صحيح:**
```javascript
const priceDiff = originalProductsPrice - productsPriceFromWaseet;

if (priceDiff > 0) {
  updates.discount = priceDiff;
  updates.price_increase = 0;
  updates.price_change_type = 'discount';
} else if (priceDiff < 0) {
  updates.discount = 0;
  updates.price_increase = Math.abs(priceDiff);
  updates.price_change_type = 'increase';
}
```

**كود Edge Function (السطور 289-324) لا يحسب ذلك:**
```javascript
// ❌ يحدّث فقط total_amount بدون حساب الخصم!
updates.total_amount = newTotalAmount;
// لا يوجد حساب لـ discount, price_increase, price_change_type
```

---

## الإصلاح المطلوب

### تعديل: `supabase/functions/sync-order-updates/index.ts`

**في قسم مقارنة الأسعار (السطور 281-325):**

```typescript
// Compare prices (تجاهل للطلبات الجزئية - السعر ثابت)
const currentFinalAmount = parseInt(String(localOrder.final_amount || 0));
const newFinalAmount = parseInt(String(waseetOrder.price || 0));
const currentDeliveryFee = parseInt(String(localOrder.delivery_fee || 0));
const currentTotalAmount = parseInt(String(localOrder.total_amount || 0));

// تحديث السعر للطلبات العادية فقط
if (!isPartialDelivery && newFinalAmount > 0 && currentFinalAmount !== newFinalAmount) {
  // حساب total_amount الجديد (السعر الكلي - رسوم التوصيل)
  const newTotalAmount = Math.max(0, newFinalAmount - currentDeliveryFee);
  
  // ✅ جلب السعر الأصلي للمنتجات من order_items
  const { data: orderItems } = await supabase
    .from('order_items')
    .select('unit_price, quantity')
    .eq('order_id', localOrder.id);
  
  const originalProductsTotal = (orderItems || []).reduce(
    (sum, item) => sum + (item.unit_price || 0) * (item.quantity || 1),
    0
  );
  
  // ✅ حساب الخصم/الزيادة
  const priceDiff = originalProductsTotal - newTotalAmount;
  
  if (priceDiff > 0) {
    // خصم
    updates.discount = priceDiff;
    updates.price_increase = 0;
    updates.price_change_type = 'discount';
    console.log(`🔻 خصم: ${priceDiff.toLocaleString()} د.ع`);
  } else if (priceDiff < 0) {
    // زيادة
    updates.discount = 0;
    updates.price_increase = Math.abs(priceDiff);
    updates.price_change_type = 'increase';
    console.log(`🔺 زيادة: ${Math.abs(priceDiff).toLocaleString()} د.ع`);
  } else {
    updates.discount = 0;
    updates.price_increase = 0;
    updates.price_change_type = null;
  }
  
  updates.total_amount = newTotalAmount;
  updates.sales_amount = newTotalAmount; // ✅ إضافة sales_amount أيضاً
  priceChanged = true;

  console.log(`💵 تحديث السعر: original=${originalProductsTotal}, new=${newTotalAmount}, diff=${priceDiff}`);
  
  // ... باقي الكود (تحديث الأرباح)
}
```

**إضافة الحقول المطلوبة في SELECT query (السطر ~180):**

```typescript
// قبل:
.select('id, order_number, tracking_number, ...')

// بعد: إضافة discount, price_increase, price_change_type
.select('id, order_number, tracking_number, ..., discount, price_increase, price_change_type')
```

---

## التحقق من عدم التأثير على الوسيط

**لماذا لا يتأثر الوسيط؟**

1. **AlWaseetContext.jsx** يُستخدم في:
   - المزامنة من الواجهة الأمامية (Frontend)
   - يحسب الخصم بشكل صحيح

2. **sync-order-updates Edge Function** يُستخدم في:
   - المزامنة التلقائية (cron job)
   - المزامنة اليدوية من الخادم

**بعد الإصلاح:**
- كلا المسارين سيحسبان الخصم/الزيادة بنفس الطريقة
- لن يتأثر الوسيط سلباً (سيستمر بالعمل كما هو)

---

## ملخص التعديلات

| الملف | التعديل |
|-------|---------|
| `supabase/functions/sync-order-updates/index.ts` | 1. جلب السعر الأصلي من order_items |
|  | 2. حساب priceDiff = originalProductsTotal - newTotalAmount |
|  | 3. تعيين discount, price_increase, price_change_type |
|  | 4. إضافة sales_amount للتحديث |

---

## النتيجة المتوقعة

| الميزة | قبل | بعد |
|--------|-----|-----|
| حساب الخصم (مدن) | ❌ لا يعمل | ✅ يعمل |
| حساب الزيادة (مدن) | ❌ لا يعمل | ✅ يعمل |
| price_change_type (مدن) | ❌ null | ✅ discount/increase |
| الوسيط | ✅ يعمل | ✅ يعمل (بدون تغيير) |
