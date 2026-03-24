

# إصلاح: عرض قواعد الأرباح بعد الحفظ + جرد التصنيفات في التليغرام

## المشكلة 1: القاعدة تُحفظ لكن لا تظهر في القائمة

**السبب**: بعد حفظ القاعدة، الكود يستدعي `fetchAllData()` مباشرة. لكن `fetchAllData` تقرأ من الكاش أولاً (صالح لمدة 30 ثانية). فتُرجع البيانات القديمة بدون القاعدة الجديدة.

**الإصلاح**: في `SuperProvider.jsx`، إضافة `superAPI.invalidate('all_data')` قبل `fetchAllData()` داخل دالة `setEmployeeProfitRule`:

```javascript
// سطر ~2833 الحالي:
await fetchAllData();

// يصبح:
superAPI.invalidate('all_data');
await fetchAllData();
```

**الملف**: `src/contexts/SuperProvider.jsx` - تعديل سطر واحد فقط

---

## المشكلة 2: جرد التصنيف يعرض منتج واحد بدل الكل

**السبب المؤكد من قاعدة البيانات**:
- التصنيفات مرتبطة بالمنتجات عبر جدول وسيط `product_categories`
- 11 من 13 منتج `category_id = NULL` على جدول `products` مباشرة
- دالة `smart_inventory_search` تستخدم `LEFT JOIN categories cat ON p.category_id = cat.id`
- فعند البحث عن "رجالي"، لا تجد إلا المنتجات التي لها `category_id` مباشر (2 فقط)

**نفس المشكلة للمواسم**: الدالة تستخدم `product_seasons_occasions` (صحيح)، لكن التصنيفات تستخدم الطريقة الخاطئة.

**الإصلاح**: Migration لتحديث `smart_inventory_search` لاستخدام `product_categories` بدل `p.category_id`:

```sql
-- بدلاً من:
LEFT JOIN categories cat ON p.category_id = cat.id

-- يصبح:
LEFT JOIN product_categories pc ON p.id = pc.product_id
LEFT JOIN categories cat ON pc.category_id = cat.id
```

مع تحديث فلترة الصلاحيات أيضاً لاستخدام `pc.category_id` بدل `p.category_id`.

**الملف**: Migration SQL جديدة فقط

---

## الملفات المتأثرة

| الملف | التعديل | المخاطر |
|-------|---------|---------|
| `src/contexts/SuperProvider.jsx` | سطر واحد: invalidate قبل fetchAllData | صفر |
| Migration SQL | تحديث JOIN في smart_inventory_search | صفر - لا يمس بيانات |

## ما لن يتغير
- `EmployeeProfitsManager.jsx` ✅
- `telegram-bot/index.ts` ✅
- القواعد المحفوظة ✅
- منطق حساب الأرباح ✅
- حد عرض المنتجات (50) ✅

## النتيجة
1. قاعدة "كامل الربح" تظهر فوراً بعد الحفظ
2. جرد "رجالي" يعرض 7 منتجات (كل المنتجات الرجالية)
3. جرد "نسائي" يعرض 6 منتجات (كل المنتجات النسائية)
4. جرد الموسم يعمل بنفس الطريقة الصحيحة

