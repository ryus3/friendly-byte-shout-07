

# خطة إصلاح أرشيف التسوية + ميزة كامل الربح للموظف

## المشكلة الأولى: أرشيف التسوية فارغ

**السبب**: خطأ البناء المتكرر (`dep-BK3b2jBa.js`) يمنع نشر التعديلات. الموقع يعمل بنسخة قديمة لا تحتوي على إصلاحات الأرشيف.

**البيانات موجودة**: 308 طلب بحالة `no_rule_archived` + 54 بحالة `settled` = 362 طلب يجب أن يظهر في الأرشيف.

**الكود صحيح** (سطر 640):
```javascript
if (showSettlementArchive) {
  archiveMatch = isSettled || isZeroProfitArchived;
}
```

**الحل**: إصلاح بيئة البناء بتثبيت Vite من الإصدار الموجود فعلاً في الـ sandbox. سأتحقق من الإصدار المثبت وأعيد بناء chunks المفقودة.

### خطوات الإصلاح:
1. حذف `node_modules/.vite` و `node_modules/vite` فقط (وليس كل node_modules)
2. إعادة تثبيت `vite@5.4.19` مباشرة
3. التحقق من وجود ملف `dep-BK3b2jBa.js` بعد التثبيت
4. تشغيل البناء للتأكد

---

## المشكلة الثانية: ميزة "كامل الربح للموظف"

**الطلب**: موظف معين يحصل على كامل ربح المنتج (سعر البيع - سعر التكلفة) بدلاً من مبلغ ثابت.

**النظام الحالي**: جدول `employee_profit_rules` يحتوي على:
- `profit_amount` (مبلغ ثابت لكل وحدة)
- `profit_percentage` (موجود لكن غير مستخدم في الحسابات)

**الحل البسيط بدون تعقيد**: استخدام `profit_percentage = 100` كعلامة أن الموظف يأخذ كامل الربح.

### التعديلات:

**1. تعديل دالة الحساب في `SuperProvider.jsx` (سطر 1520-1538)**:
```javascript
items.forEach(item => {
  const productId = item.product_id;
  if (!productId) return;
  
  const rule = (profitRules || []).find(r => 
    r.target_id === productId &&
    r.rule_type === 'product' &&
    new Date(r.created_at) <= orderDate
  );
  
  if (rule) {
    hasAnyRule = true;
    
    if (rule.profit_percentage === 100) {
      // ✅ كامل الربح: سعر البيع - سعر التكلفة
      const sellingPrice = item.price || item.unit_price || 0;
      const costPrice = item.cost_price || item.product_variants?.cost_price || 0;
      const fullProfit = (sellingPrice - costPrice) * (item.quantity || 1);
      totalProfit += Math.max(0, fullProfit);
    } else {
      // المبلغ الثابت كالمعتاد
      totalProfit += (rule.profit_amount || 0) * (item.quantity || 1);
    }
  }
});
```

**2. تعديل واجهة إضافة القاعدة في `DepartmentManagerSettingsPage.jsx`**:
- إضافة خيار "كامل الربح" (checkbox أو toggle)
- عند التفعيل: يُرسل `profit_percentage: 100` و `profit_amount: 0`

**3. لا حاجة لتعديل قاعدة البيانات** - الحقل `profit_percentage` موجود أصلاً

### كيف يعمل:
| الإعداد | الحساب |
|---------|--------|
| `profit_amount: 500` | الموظف يأخذ 500 × الكمية |
| `profit_percentage: 100` | الموظف يأخذ (سعر البيع - التكلفة) × الكمية |

---

## ملخص التعديلات

| الملف | التعديل |
|-------|---------|
| بيئة البناء | إصلاح Vite chunks لحل خطأ `dep-BK3b2jBa.js` |
| `SuperProvider.jsx` | دعم `profit_percentage: 100` في دالة حساب الربح |
| `DepartmentManagerSettingsPage.jsx` | إضافة خيار "كامل الربح" في واجهة القواعد |

## النتيجة
- أرشيف التسوية يعود للعمل (362 طلب)
- يمكن تحديد موظف يأخذ كامل ربح المنتج بسهولة
- لا تغيير في قاعدة البيانات

