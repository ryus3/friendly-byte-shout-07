## التشخيص الكامل لفاتورة 3623484

### الأرقام الحقيقية حسب البيانات

| البند | القيمة |
|---|---|
| إيراد القناة (شركة التوصيل) | 950,000 |
| طلب off-channel (مكسيك) معلَّق | +25,000 عند التأكيد |
| طلب إرجاع 149776372 | −25,000 (منتج −20,000 + توصيل −5,000) |
| تكلفة المنتجات المباعة فعلاً (50 قطعة) | 600,000 |

### النتيجة الصحيحة لبطاقة "توزيع الأرباح على المالكين" (احمد)

**قبل تأكيد احمد لاستلام الـ off-channel:**
- قطع: 49
- إيراد: 980,000 (1,000,000 مفروض − 20,000 off-channel غير مؤكَّد)
- ربح خام = 980,000 − 588,000 (تكلفة 49 قطعة) = **392,000**
- ناقص خسارة الإرجاع المنسوبة لاحمد: −25,000
- **صافي ربح احمد = 367,000**

**بعد تأكيد احمد لاستلام الـ 25,000:**
- قطع: 50
- إيراد: 1,000,000
- ربح خام = 1,000,000 − 600,000 = 400,000
- ناقص خسارة الإرجاع: −25,000
- **صافي ربح احمد = 375,000** ← يطابق "صافي للمالكين 375,000" في الكرت العلوي

### السبب الحالي للخطأ

`src/lib/invoiceProfitsCalc.js`:

1. فرع `isOffChannel` يدخل البنود إلى `productMap` دائماً حتى قبل تأكيد المالك → احمد يظهر 50 قطعة / 1,000,000 من البداية.
2. طلبات الإرجاع تُجمَع في `returnsOrders` و`returnsTotalLoss` كقسم منفصل، لكن **لا تُخصم من ربح/إيراد المالك** في `byOwner`. لذلك بطاقة احمد لا تطابق "صافي للمالكين" أعلاه.

## الإصلاح (ملف واحد فقط: `src/lib/invoiceProfitsCalc.js`)

### تعديل 1 — استبعاد off-channel غير المؤكَّد من المالك

في فرع `isOffChannel`:
```js
const occRecord = offChannelByOrder.get(o.id);
const isConfirmed = !!(occRecord && (
  occRecord.cash_movement_id ||
  ['settled','confirmed','owner_confirmed'].includes(occRecord.status)
));
if (!isConfirmed) {
  // سجّل الطلب في offChannelOrders (للبطاقة الصفراء)
  offChannelOrders.push({...});
  offChannelExpectedAmount += expectedPaid;
  offChannelCount += 1;
  offChannelAbsorbedDelivery += deliveryFee;
  return; // ← لا تمرّر البنود لـ productMap ولا تضف للـ totalRevenue
}
// إذا مؤكَّد → السلوك الحالي (يدخل ضمن إيراد/قطع/ربح المالك)
```

### تعديل 2 — توزيع خسارة الإرجاع على المالك

في فرع `isFullReturn`، بدل `return` المباشر بعد دفع `returnsOrders`:
- احسب مالك المنتج المرجَع من `lineItems` (نفس منطق "owner_id ذو أعلى قيمة"):
  ```js
  const returnOwnerSums = new Map();
  lineItems.forEach((it) => {
    const ownerId = it.products?.owner_user_id || '__system__';
    const qty = Number(it.quantity) || 0;
    const price = Number(it.unit_price) || 0;
    returnOwnerSums.set(ownerId, (returnOwnerSums.get(ownerId) || 0) + qty * price);
  });
  ```
- وزّع `realRevenue` (السالب، يشمل التوصيل) نسبياً على المالكين بناءً على قيمة المنتج المرجَع، واخصمه من `byOwner[ownerId].revenue` (ينعكس مباشرة على الربح الصافي للمالك).
- إذا الكل لمالك واحد (حالة احمد): يُخصم كامل −25,000 من إيراده.

### تعديل 3 — لا مساس بالكروت العلوية

`totalRevenue`, `totalCost`, `totalProfit`, `revenueFromItems`, `netForOwners`, `returnsOrders`, `returnsTotalLoss`, `channelRevenue`, `offChannelExpectedAmount` — تبقى كما هي. التعديل **يلمس فقط `byOwner` و`productMap`**.

## التحقق المتوقع بعد التطبيق

| الحالة | قطع احمد | إيراد احمد | ربح احمد |
|---|---|---|---|
| قبل تأكيد off-channel | 49 | 955,000 (980k مفروض −25k إرجاع) | 367,000 |
| بعد تأكيد off-channel | 50 | 975,000 (1,000,000 −25,000 إرجاع) | 375,000 ✅ |

النتيجة بعد التأكيد تطابق تماماً "صافي للمالكين 375,000" في الكرت العلوي.

## ملفات متأثرة

- `src/lib/invoiceProfitsCalc.js` فقط.

لا تغييرات في قاعدة البيانات. التريغرات والإشعارات تبقى كما هي (الإشعار يصل لاحمد بعد التصحيح السابق).
