

# إصلاح: نقل طلبات الربح الصفري المستلمة الفاتورة إلى أرشيف التسوية

## المشكلة
حالياً في `EmployeeFollowUpPage.jsx`:

1. **السطر 571-574**: الطلبات ذات `no_rule_archived` أو `no_rule_settled` تُستبعد نهائياً من الصفحة - لا تظهر لا في القائمة الرئيسية ولا في أرشيف التسوية
2. **السطر 637-638**: أرشيف التسوية يعرض فقط `profitRecord?.status === 'settled'` - لا يشمل `no_rule_archived` أو `no_rule_settled`
3. **السطر 947**: عداد أرشيف التسوية يحسب فقط `status === 'settled'`

**النتيجة:** طلبات كثيرة بدون أرباح للموظف (ربح = 0) ومستلمة الفاتورة "تختفي" من الصفحة بالكامل بدل أن تظهر في أرشيف التسوية.

## الحل

### تعديل ملف واحد: `src/pages/EmployeeFollowUpPage.jsx`

#### 1) إزالة الاستبعاد الشامل (السطر 571-575)
بدلاً من استبعاد `no_rule_archived` و `no_rule_settled` من كل شيء، نتركها تمر من الفلترة العامة ونوجهها لأرشيف التسوية.

**قبل:**
```javascript
if (profitRecord?.status === 'no_rule_archived' || profitRecord?.status === 'no_rule_settled') {
  return false;
}
```

**بعد:**
```javascript
// طلبات بدون ربح (no_rule_archived / no_rule_settled) تظهر فقط في أرشيف التسوية
if (profitRecord?.status === 'no_rule_archived' || profitRecord?.status === 'no_rule_settled') {
  if (!showSettlementArchive) return false;
}
```

#### 2) توسيع تعريف `isSettled` (السطر 631)
```javascript
// قبل
const isSettled = profitRecord?.status === 'settled';

// بعد - يشمل الطلبات بدون ربح أيضاً
const isSettled = profitRecord?.status === 'settled' || 
                  profitRecord?.status === 'no_rule_archived' || 
                  profitRecord?.status === 'no_rule_settled';
```

#### 3) توسيع عداد أرشيف التسوية (السطر 947)
```javascript
// قبل
return employeeMatch && profitRecord?.status === 'settled';

// بعد
return employeeMatch && (
  profitRecord?.status === 'settled' || 
  profitRecord?.status === 'no_rule_archived' || 
  profitRecord?.status === 'no_rule_settled'
);
```

## النتيجة المتوقعة
- كارت "أرشيف التسوية" سيرتفع عدده ليشمل كل الطلبات المسواة + بدون ربح
- عند الضغط على الكارت، ستظهر جميع هذه الطلبات
- الطلبات بدون ربح لن تظهر في القوائم الأخرى (مستحقات معلقة، إجمالي، إلخ)

