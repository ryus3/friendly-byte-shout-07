

# خطة إصلاح تناقض كارت "مستحقات معلقة"

## المشكلة
كارت "مستحقات معلقة" يعرض 7,000 د.ع لكن عند الضغط عليه تظهر 0 طلبات.

## السبب
تناقض بين حساب المبلغ وفلتر عرض الطلبات:

| المكان | المنطق |
|--------|--------|
| **حساب المبلغ** (سطر 907) | `isPendingStatus()` = يشمل `pending` + `invoice_received` + `settlement_requested` |
| **فلتر الطلبات** (سطر 622-626) | يشترط `status === 'pending'` فقط + `employee_profit > 0` + `receipt_received === true` |

المبلغ 7,000 على الأرجح يأتي من طلبات بحالة `invoice_received` أو `settlement_requested`، لكن الفلتر يبحث فقط عن حالة `pending` الصرفة.

## الحل
توحيد المنطق: عند الضغط على كارت "مستحقات معلقة"، يجب أن يعرض **نفس الطلبات** التي حُسب منها المبلغ.

### تعديل واحد في `src/pages/EmployeeFollowUpPage.jsx`

**سطر 622-627** - توسيع فلتر `pending` ليطابق `isPendingStatus`:
```javascript
// قبل:
} else if (filters.profitStatus === 'pending') {
  profitStatusMatch = profitRecord?.status === 'pending' && 
                     profitRecord?.employee_profit > 0 &&
                     order.receipt_received === true;
}

// بعد:
} else if (filters.profitStatus === 'pending') {
  profitStatusMatch = isPendingStatus(profitRecord?.status) && 
                     profitRecord?.employee_profit > 0 &&
                     order.receipt_received === true;
}
```

## النتيجة
- المبلغ في الكارت والطلبات المعروضة ستكون من نفس المصدر
- الطلبات ذات حالة `invoice_received` و `settlement_requested` ستظهر أيضاً عند الضغط على الكارت

