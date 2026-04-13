

## خطة إصلاح 3 مشاكل

### المشكلة 1: الأرباح تظهر 5,000 خطأ (المصاريف 0 صحيح)

**السبب المؤكد**: في `EmployeeFinancialCenterPage.jsx` سطر 168-171، `totalRevenue` يحسب **كل** حركات `movement_type === 'in'` كإيرادات. حركة `expense_refund` بمبلغ 5,000 (إرجاع المصروف المحذوف) تُحسب كإيراد مبيعات!

بيانات قاصة سارة الفعلية:
- حركة خروج: مصروف "تجربة" = 5,000 (expense)
- حركة خروج: شراء بضاعة = 1,000 (purchase)
- حركة دخول: إرجاع مصروف محذوف = 5,000 (expense_refund)

المصاريف العامة = 5000 - 5000 = 0 ← صحيح (تم إصلاحه سابقاً)
لكن المبيعات = 5000 ← خطأ! لأنها تحسب expense_refund كإيراد

**الإصلاح**: تعديل فلتر `totalRevenue` في سطر 168-171 لاستثناء `expense_refund` من الإيرادات:
```javascript
const revenueMovements = cashMovements.filter(m =>
  m.movement_type === 'in' && 
  m.reference_type !== 'expense_refund' &&
  filterByDate(m.created_at)
);
```

بعد الإصلاح: المبيعات = 0، مجمل الربح = 0، صافي الربح (مع المشتريات) = -1000

---

### المشكلة 2: كاش المدن يعرض 0 مناطق

**سببان**:

1. **واجهة العرض**: `CitiesCacheManager.jsx` يستخدم `regions` (الذي يبقى فارغاً دائماً) بدل `allRegions` (الذي يحتوي 6232 منطقة). السطر 223 يعرض `syncInfo?.regions_count || regions?.length || 0` - وبما أن `syncInfo.regions_count = 0` (من آخر مزامنة فاشلة) و `regions.length = 0` (لأن regions state لا يُملأ أبداً)، يظهر 0.

2. **دالة المزامنة**: آخر مزامنة ناجحة بأرقام حقيقية (18 مدينة، 6232 منطقة) كانت في 29 مارس. جميع المزامنات بعد 11 أبريل تُسجل `cities_count: 0, regions_count: 0` مع `success: true`. السبب: الدالة تستخدم `directFetch` الجديد الذي قد يفشل صامتاً، أو أن `syncLogId` يكون `null` بسبب خطأ في الإدخال.

**الإصلاح**:
- **`CitiesCacheManager.jsx`**: استخدام `allRegions` بدل `regions`، وعرض عدد المناطق من `allRegions.length` كـ fallback
- **`update-cities-cache/index.ts`**: إضافة `delivery_partner: 'alwaseet'` صريحاً في insert السجل، وإضافة logging عند فشل الإدخال

---

### المشكلة 3: التأكد من جلب المدن/المناطق من الكاش

`useCitiesCache.js` يجلب المدن والمناطق من `cities_master` و `regions_master` (قاعدة البيانات المحلية) وليس من API الخارجي ← هذا صحيح وسليم.

`AlWaseetContext.jsx` تم تعديله سابقاً ليجلب من الكاش أولاً ← يحتاج تأكيد فقط.

---

### ملخص الملفات:
1. `src/pages/EmployeeFinancialCenterPage.jsx` - استثناء expense_refund من الإيرادات
2. `src/components/cities-cache/CitiesCacheManager.jsx` - استخدام allRegions بدل regions
3. `supabase/functions/update-cities-cache/index.ts` - إصلاح تسجيل المزامنة

