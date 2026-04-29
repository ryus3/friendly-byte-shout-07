## ملخص الإجابة على أسئلتك

> هل اختيار شركة من نافذة الطلب الذكي يكفي؟ ولا نحتاج "افتراضية" من تسجيل الدخول؟

نعم، اختيار الشركة في نافذة الطلب الذكي **هو** المرجع الصحيح ويكفي. لا يوجد ولن يكون "منطقة افتراضية".

> كيف كان يعمل قبل أيام؟

كان `regions_master.id` فعلياً يساوي `alwaseet_id` لمعظم المناطق، فأي رقم تستخرجه كان يصلح للوسيط بالصدفة.

> لماذا تخرّب؟

عند تفعيل كاش مدن، أُدخلت **16,580 منطقة جديدة** في `regions_master` بـ `alwaseet_id = null` (لأنها تخص مدن). الآن البوت لما يبحث بالاسم في `regions_master` كاملاً يقع أحياناً على صف "مدن"، ويحفظ في `ai_orders.region_id` رقم داخلي مثل `17458` لا يفهمه الوسيط.

> الحل بدون تخريب وبدعم شركات مستقبلية؟

نعزل ID الشركة عن ID الداخلي عبر جدول `region_delivery_mappings` فقط. عند الموافقة، نترجم حسب الشركة المختارة. لا نلمس البوت ولا الكاش.

---

## ما تم اكتشافه (الفحص العميق)

**الحالة الحالية للطلب الذي يفشل:**
```
ai_orders.city_id   = 1
ai_orders.region_id = 17458   ← هذا ID داخلي لصف "مدن"
resolved_region_name = شارع مركز شرطة - الغزالية
```

نفس اسم المنطقة موجود في `regions_master` بأربعة صفوف:
```
id=650    alwaseet_id=650    ← الصف الصحيح للوسيط
id=6403   alwaseet_id=null
id=11932  alwaseet_id=null
id=17458  alwaseet_id=null   ← هذا الذي حُفظ، مربوط بمدن external_id=650
```

**سبب المشكلة في `SuperProvider.jsx` (دالة `approveAiOrder`):**
السطر 2263 يثق بـ `aiOrder.region_id` ويستخدمه كـ `regionId` للوسيط مباشرة:
```js
if (aiOrder.region_id && aiOrder.resolved_region_name && ...) {
  regionId = aiOrder.region_id;   // ← قد يكون 17458 (مدن) ويُرسل للوسيط
  ...
}
```
ثم السطر 2469-2470 يرسله للوسيط:
```js
city_id: parseInt(cityId),
region_id: parseInt(regionId),
```

**والـ fallbacks الكارثية:**
- السطر 2328-2334: إذا فشل، يستخدم **بغداد افتراضياً**.
- السطر 2410-2413 و 2420-2423: إذا فشل، يستخدم **أول منطقة في القائمة**.

هذه الـ fallbacks تخفي المشكلة وترسل طلبات لعناوين خاطئة.

---

## الحل العالمي بدون تخريب

### المبدأ الذهبي
- `regions_master.id` و `cities_master.id` = هويات داخلية canonical فقط، **لا تُرسل أبداً لشركة توصيل**.
- `region_delivery_mappings (delivery_partner, external_id)` = **المصدر الوحيد** لـ ID شركة التوصيل.
- اختيار الشركة في نافذة الطلب الذكي (`destination`) = **يقرّر أي mapping نستخدم**.

### ما سيتغير (الموقع فقط)

**1. ملف واحد: `src/contexts/SuperProvider.jsx` — دالة `approveAiOrder`**

استبدال البلوك من السطر 2262 إلى 2425 بمنطق resolver واضح:

```text
عند destination = 'alwaseet' أو 'modon':

أ) خذ partner = destination.

ب) ترجم city_id:
   1. ابحث في city_delivery_mappings
      WHERE delivery_partner = partner
        AND city_id = aiOrder.city_id   (canonical)
      → إن وُجد: استخدم external_id.
   2. إن لم يوجد، جرّب نفس الجدول حيث external_id = aiOrder.city_id::text
      (للتوافق مع طلبات قديمة محفوظة بـ external_id).
   3. إن لم يوجد، fallback اسمي:
      ابحث بالاسم resolved_city_name في cities_master
      ثم اربطه بـ city_delivery_mappings للشريك.
   4. إن فشل كل ذلك → فشل صريح، بدون "بغداد افتراضي".

ج) ترجم region_id بنفس المنطق على region_delivery_mappings
   (مع شرط إضافي: المنطقة يجب أن تنتمي لنفس canonical city_id).
   - مطلق ممنوع: استخدام أول منطقة في القائمة.
   - مطلق ممنوع: استدعاء getCities/getRegionsByCity من API الوسيط
     داخل الموافقة (يسبب WAF storm). كل الترجمة من DB cache فقط.

د) أرسل للوسيط/مدن: external_city_id, external_region_id فقط.
```

رسائل الفشل ستكون دقيقة بدلاً من "بغداد افتراضي":
```
تعذر تحديد منطقة شريك "الوسيط" للطلب:
المدينة: بغداد
المنطقة: شارع مركز شرطة - الغزالية
السبب: لا يوجد ربط (mapping) لهذه المنطقة عند الوسيط.
الإجراء: تأكد من اكتمال مزامنة كاش الوسيط من صفحة "إدارة بيانات المدن والمناطق".
```

**2. حذف نهائي للـ fallbacks الخطرة**
- إزالة بلوك "بغداد كافتراضي" (2328-2338).
- إزالة بلوكي "أول منطقة متاحة" (2410-2413، 2420-2423).
- إزالة استدعاءات `getCities` و `getRegionsByCity` من داخل `approveAiOrder` (2217، 2342). الترجمة من DB فقط.

**3. ملف SQL واحد بسيط (migration)**
لتعزيز `get_region_external_id` لتأخذ `delivery_partner` فعلياً (حالياً يتجاهله ويرجع `regions_master.alwaseet_id` فقط):
```sql
CREATE OR REPLACE FUNCTION public.get_region_external_id(
  p_region_id integer,
  p_delivery_partner text DEFAULT 'alwaseet'
) RETURNS text ...
-- يقرأ من region_delivery_mappings حسب الشريك
-- ويسقط على regions_master.alwaseet_id فقط لو الشريك = alwaseet
```
ودالة موازية `get_city_external_id` تستخدم `city_delivery_mappings` بنفس الطريقة (موجودة لكن نوحّد سلوكها).

### ما **لن** يتغير
- `supabase/functions/telegram-bot/index.ts`: **لا لمس** كما طلبت. البوت يكمل يخزّن `region_id` كما هو.
- `cities_cache` / `regions_cache` / `cities_master` / `regions_master`: لا حذف ولا تعديل بيانات.
- `city_delivery_mappings` / `region_delivery_mappings`: لا تعديل بيانات، فقط نقرأ منها.
- البوت سيظل يحفظ أحياناً ID داخلي (مثل 17458)، لكن resolver في الموقع سيعرف يترجمه عبر اسم المدينة + اسم المنطقة + الشريك المختار.

### دعم شركات مستقبلية
أي شركة جديدة (مثلاً "كرخ سبيد"):
1. تشغيل كاش الشركة الجديدة → يضيف صفوف في `region_delivery_mappings` بـ `delivery_partner='karkh'`.
2. لا تعديل في الكود. resolver يأخذ `partner` من `destination` ويعمل تلقائياً.

---

## القسم التقني المختصر

**ملفات معدّلة:**
- `src/contexts/SuperProvider.jsx`: استبدال منطق ترجمة المدينة/المنطقة في `approveAiOrder` (≈170 سطر).
- `supabase/migrations/<timestamp>_fix_partner_id_resolution.sql`: تحديث `get_region_external_id` و `get_city_external_id` لاحترام `delivery_partner` بشكل صحيح.

**ملفات غير ملموسة:**
- `supabase/functions/telegram-bot/index.ts`
- جداول البيانات (لا upserts ولا deletes)
- باقي مسارات إنشاء الطلب اليدوي (`AlWaseetUnifiedOrderCreator.jsx`) — تُبقى كما هي لأن منطقها حالياً سليم.

**اختبارات قبول:**
1. الطلب الفاشل الحالي (بغداد / شارع مركز شرطة - الغزالية، الوسيط): يجب أن يُترجم إلى `city_id=1, region_id=650` ويرسَل بنجاح.
2. نفس الطلب لو الوجهة "مدن": يجب أن يستخدم mapping مدن، لا الوسيط.
3. منطقة غير مربوطة بالشريك المختار: فشل صريح برسالة دقيقة، بدون اختيار "أول منطقة" أو "بغداد".
4. صفر استدعاءات API لـ `getCities`/`getRegionsByCity` أثناء الموافقة (يحلّ مشكلة WAF و errNum:21 من جذرها لمسار الموافقة).