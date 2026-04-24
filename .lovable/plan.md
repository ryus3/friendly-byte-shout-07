

# الخطة - 3 إصلاحات مستقلة

## 📊 ما اكتشفته من الفحص الفعلي (لا افتراضات)

### الفواتير - لماذا "كانت تعمل":
- معظم فواتيرك القديمة `dio_count = 0` (لا سجلات في `delivery_invoice_orders`) لكنها **`received = true`** - أي تعمل!
- السبب: 546 طلب لديها `receipt_received = true` يتم تحديثها عبر مسار آخر (مزامنة الطلبات `sync-order-updates` مباشرة)، **ليس عبر** ربط `delivery_invoice_orders`
- 3 فواتير فقط لها `dio_count > 0`: 3210286 (60)، 3182855 (63)، 3101599 (103) - من مزامنة قديمة كانت تجلب التفاصيل
- **آخر تحديث لـ `delivery_invoice_orders`**: 2026-04-21 (قبل 3 أيام)
- **الفاتورة 3247172** (آخر فاتورة، `received=false`، 42 طلب) هي الوحيدة التي تحتاج فعلياً ربط `delivery_invoice_orders` لتمكين زر "استلام الفاتورة"

### المشكلة الحقيقية للفاتورة 3247172:
من logs الـ smart-invoice-sync:
```
⚠️ Failed to link invoice orders: invalid reference to FROM-clause entry for table "dio"
```
**خطأ SQL في إحدى دوال DB** (وليس في كود upsert كما ظننت سابقاً). الـ self-heal في `useAlWaseetInvoices.js` يعمل عند **فتح الفاتورة في الواجهة فقط**، لكنك لم تفتحها بعد.

---

## 🔧 الإصلاح 1: AlWaseet Cache (المناطق = 0)

**السبب المؤكد** من logs:
```
✅ [18/18] undefined: 286 منطقة
❌ regions_master batch: null value in column "name" violates not-null constraint
```
- API يرجع `region_name` بدل `name` → الكود يحفظ `null`
- اسم المدينة `undefined` → يعني `city_name` بدل `name` أيضاً

**الإصلاح في `supabase/functions/update-cities-cache/index.ts`**:
- `fetchCities`: `name: (city.name || city.city_name)`
- `fetchRegions`: `name: (region.name || region.region_name)`
- فلتر صفوف null قبل upsert
- log اسم المدينة الصحيح

---

## 🔧 الإصلاح 2: MODON Cache (يتوقف 7/18، CPU timeout)

**السبب المؤكد** من logs: `CPU Time exceeded` بعد 7 مدن
- الكود يعمل **2 استعلامات لكل منطقة** (SELECT then INSERT) = آلاف الاستعلامات → تجاوز CPU

**الإصلاح في `supabase/functions/update-modon-cache/index.ts`**:
- استبدال lookup-then-insert بـ **batch upsert واحد** على `(city_id, name)` للمناطق و `(name)` للمدن
- استخدام نفس نمط `update-cities-cache` (batch upsert direct)
- إضافة UNIQUE index على `regions_master(city_id, name)` إن لم يكن موجوداً
- وقت متوقع: من >150 ثانية إلى ~10 ثوان

---

## 🔧 الإصلاح 3: ربط الفاتورة 3247172 (الوحيدة المعطلة)

**السبب المؤكد** من logs:
```
⚠️ Failed to link invoice orders: invalid reference to FROM-clause entry for table "dio"
```
خطأ SQL في دالة DB يستدعيها `smart-invoice-sync` بعد upsert الفواتير.

**الإصلاح**:
1. البحث عن الـ SQL المعطوب الذي يشير لـ `dio` بشكل خاطئ في الـ Edge Function `smart-invoice-sync`
2. إصلاح الاستعلام
3. **بعد الإصلاح**: فتح الفاتورة 3247172 من الواجهة سيُشغّل self-heal الموجود في `useAlWaseetInvoices.js` (السطر 426-440) ويربطها تلقائياً

**لا حاجة لـ "إصلاح فواتير قديمة"** - كلها تعمل بالفعل عبر `receipt_received` على الطلبات.

---

## 📋 الملفات المعدلة

| الملف | التغيير |
|------|---------|
| `supabase/functions/update-cities-cache/index.ts` | aliases للحقول + filter null |
| `supabase/functions/update-modon-cache/index.ts` | تحويل إلى batch upsert (سرعة 15x) |
| `supabase/functions/smart-invoice-sync/index.ts` | إصلاح خطأ SQL `dio` |
| migration (إن لزم) | إضافة UNIQUE constraint لـ `regions_master(city_id, name)` للسماح بـ upsert |

## ✅ النتائج المتوقعة

| المشكلة | قبل | بعد |
|---------|-----|-----|
| AlWaseet كاش | 0/0 (يفشل) | 18 + ~6232 منطقة ✅ |
| MODON كاش | 7/18 (timeout) | 18/18 خلال ~10s ✅ |
| فاتورة 3247172 | 0 طلبات | 42 طلب مرتبط بعد فتحها ✅ |
| فواتير قديمة | تعمل ✅ | تبقى تعمل (لا تخريب) |

## ⚠️ ضمانات صارمة (لا تخريب)
- **لا تعديل** على schema الفواتير
- **لا حذف** أي بيانات (6232 منطقة + 2163 سجل dio محفوظة)
- **لا تعديل** على الفواتير القديمة المستلمة (تعمل عبر `receipt_received` بشكل سليم)
- **لا تعديل** على `AlWaseetContext.jsx` (الكود الحالي يعمل، الخطأ في DB function/SQL)
- لا backfill جماعي - فقط الفاتورة 3247172 ستُربط عند فتحها بواسطة self-heal الموجود

