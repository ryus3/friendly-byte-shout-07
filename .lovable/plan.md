

# خطة إظهار طلبات الربح الصفري في أرشيف التسوية

## المشكلة
الطلبات التي ربح الموظف فيها = 0 (حالة `no_rule_archived` أو `no_rule_settled`) يتم **استبعادها بالكامل** من صفحة متابعة الموظفين في السطر 573، فلا تظهر في أي مكان - لا في الطلبات العادية ولا في أرشيف التسوية.

المطلوب: هذه الطلبات يجب أن تظهر **فقط** في أرشيف التسوية لأنها مُسوّاة تلقائياً (لا يوجد مبلغ يُطالب به الموظف).

## بخصوص أمان الموقع وخطأ البناء
- الموقع المنشور على `ryus.lovable.app` يعمل بشكل طبيعي - لا خطورة على البيانات
- خطأ `dep-C6uTJdX2.js` هو مشكلة بيئة التطوير (node_modules تالف) وليس مشكلة في الكود
- الحل: إعادة تثبيت node_modules نظيف (وهذا ما تم سابقاً ويحتاج تكرار في كل build جديد بسبب بيئة sandbox)

## التعديلات المطلوبة

### ملف واحد: `src/pages/EmployeeFollowUpPage.jsx`

**تعديل 1 - السطر 571-575**: بدلاً من استبعاد طلبات الربح الصفري بالكامل، نسمح لها بالمرور ونتركها تُفلتر لاحقاً بواسطة منطق الأرشيف:
```javascript
// قبل:
if (profitRecord?.status === 'no_rule_archived' || profitRecord?.status === 'no_rule_settled') {
  return false;
}

// بعد:
// طلبات الربح الصفري تظهر فقط في أرشيف التسوية
const isZeroProfitSettled = profitRecord?.status === 'no_rule_archived' || profitRecord?.status === 'no_rule_settled';
if (isZeroProfitSettled && !showSettlementArchive) {
  return false;
}
```

**تعديل 2 - السطر 637-638**: أرشيف التسوية يعرض أيضاً طلبات الربح الصفري:
```javascript
// قبل:
if (showSettlementArchive) {
  archiveMatch = isSettled;

// بعد:
const isZeroProfitArchived = profitRecord?.status === 'no_rule_archived' || profitRecord?.status === 'no_rule_settled';
if (showSettlementArchive) {
  archiveMatch = isSettled || isZeroProfitArchived;
```

**تعديل 3 - السطر 947**: عدّاد أرشيف التسوية يحسب أيضاً طلبات الربح الصفري:
```javascript
// قبل:
return employeeMatch && profitRecord?.status === 'settled';

// بعد:
return employeeMatch && (profitRecord?.status === 'settled' || profitRecord?.status === 'no_rule_archived' || profitRecord?.status === 'no_rule_settled');
```

## النتيجة المتوقعة
- كارت "أرشيف التسوية" سيعرض العدد الصحيح (يشمل طلبات الربح الصفري)
- عند الضغط على الكارت، تظهر الطلبات المدفوعة + طلبات الربح الصفري معاً
- الطلبات ذات الربح الصفري لن تظهر في الطلبات العادية أو المستحقات المعلقة

