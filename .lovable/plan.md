

# خطة إصلاح مشكلتين

## المشكلة الأولى: كارت "مستحقات معلقة" يعرض 7,000 ولا تظهر طلبات

**السبب الجذري**: حساب المبلغ في `pendingDues` (سطر 900-914) لا يستبعد الطلبات المؤرشفة (`isarchived = true`)، لكن فلتر عرض القائمة (سطر 631, 645) يستبعدها. فالطلب مؤرشف يدوياً ولذلك يُحسب ماله ولا يُعرض.

**الحل**: إضافة شرط استبعاد الطلبات المؤرشفة يدوياً من حساب `pendingDues`.

### تعديل في `src/pages/EmployeeFollowUpPage.jsx` (سطر 900-914)

```javascript
const pendingDues = statsOrders
  .filter(order => order.receipt_received === true)
  .reduce((sum, order) => {
    // ✅ استبعاد الطلبات المؤرشفة يدوياً من المستحقات المعلقة
    const isManuallyArchived = (order.isarchived === true || order.isArchived === true || order.is_archived === true) && order.status !== 'completed';
    if (isManuallyArchived) return sum;
    
    const profitRecord = profits?.find(p => p.order_id === order.id);
    let employeeProfit = 0;
    if (profitRecord && isPendingStatus(profitRecord.status)) {
      employeeProfit = profitRecord.employee_profit || 0;
    }
    return sum + employeeProfit;
  }, 0);
```

---

## المشكلة الثانية: طلبات بربح 0 تظهر كـ"غير مدفوع" في صفحة أرباحي

الصورة IMG_1101 تُظهر طلبات بحالة "معلق" وربح الموظف = 0 د.ع تظهر للموظف في فلتر "غير مدفوع (معلق + جاهز)". هذه طلبات لا يوجد فيها استحقاق فلا معنى لعرضها كمستحقات غير مدفوعة.

**الحل**: في فلتر `not_settled` بصفحة الأرباح، استبعاد الطلبات التي `employee_profit = 0` بالإضافة لاستبعاد حالات `no_rule_archived`.

### تعديل في `src/pages/ProfitsSummaryPage.jsx` (سطر 485-491)

```javascript
if (filters.profitStatus === 'not_settled') {
  filtered = filtered.filter(p => {
    const status = p.profitStatus || 'pending';
    // استبعاد المدفوع والمسوى تلقائياً
    if (status === 'settled' || status === 'no_rule_settled' || status === 'no_rule_archived') return false;
    // ✅ استبعاد طلبات بربح 0 - لا يوجد استحقاق للموظف
    if ((p.profit || 0) <= 0) return false;
    return true;
  });
}
```

---

## ملخص التعديلات

| الملف | التعديل |
|-------|---------|
| `EmployeeFollowUpPage.jsx` | استبعاد الطلبات المؤرشفة من حساب pendingDues |
| `ProfitsSummaryPage.jsx` | استبعاد طلبات الربح الصفري + `no_rule_archived` من فلتر "غير مدفوع" |

## النتيجة
- كارت "مستحقات معلقة" سيعرض 0 (لأن الطلب الوحيد مؤرشف)
- الموظف لن يرى طلبات بربح 0 في "غير مدفوع"
- لا تأثير على أرشيف التسوية أو الطلبات المدفوعة

