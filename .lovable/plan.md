

# إصلاح عدم ظهور طلبات الربح الصفري في أرشيف التسوية

## المشكلة

في `EmployeeFollowUpPage.jsx` توجد **3 نقاط** تمنع ظهور طلبات `no_rule_settled` في أرشيف التسوية:

1. **السطر 573**: استبعاد مبكر غير مشروط - أي طلب بحالة `no_rule_settled` يُستبعد من القائمة بالكامل، حتى عند تفعيل أرشيف التسوية:
```javascript
if (profitRecord?.status === 'no_rule_archived' || profitRecord?.status === 'no_rule_settled') {
  return false; // ← يُستبعد دائماً، حتى في الأرشيف!
}
```

2. **السطر 637-638**: أرشيف التسوية يعرض فقط `settled`، ولا يشمل `no_rule_settled`:
```javascript
if (showSettlementArchive) {
  archiveMatch = isSettled; // isSettled = profitRecord?.status === 'settled' فقط
}
```

3. **السطر 947**: عدّاد أرشيف التسوية يحسب فقط `settled`، فلا يظهر العدد الصحيح:
```javascript
return employeeMatch && profitRecord?.status === 'settled';
```

## الإصلاح

### في `src/pages/EmployeeFollowUpPage.jsx`:

**1) السطر 571-575** - تعديل الاستبعاد المبكر ليسمح بـ `no_rule_settled` عند تفعيل الأرشيف:
```javascript
if (profitRecord?.status === 'no_rule_archived') {
  return false;
}
if (profitRecord?.status === 'no_rule_settled' && !showSettlementArchive) {
  return false;
}
```

**2) السطر 631 + 637-638** - توسيع تعريف `isSettled` ليشمل `no_rule_settled`:
```javascript
const isSettled = profitRecord?.status === 'settled' || profitRecord?.status === 'no_rule_settled';
```
هذا يكفي لأن السطر 637-638 يستخدم `isSettled` مباشرة.

**3) السطر 946-947** - تحديث عدّاد `settledOrdersCount`:
```javascript
return employeeMatch && (profitRecord?.status === 'settled' || profitRecord?.status === 'no_rule_settled');
```

### النتيجة
- طلبات سارة (وغيرها) ذات الربح 0 ستظهر في أرشيف التسوية
- العدّاد سيعكس العدد الصحيح
- لن تظهر في القائمة الرئيسية (تبقى مخفية عند عدم تفعيل الأرشيف)

