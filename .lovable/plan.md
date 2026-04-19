

# خطة إصلاح شاملة - 6 مشاكل حرجة

## التشخيص الأولي

سأبدأ بفحص حقيقي لكل مشكلة قبل التنفيذ. هذه قائمة المشاكل المؤكدة:

1. **حذف طلبات بالخطأ مرة أخرى** (138213029, 138213020 - كارثي)
2. **قواعد الأرباح لا تظهر لمدير القسم** رغم وجود 7 قواعد لأحمد
3. **شريط تقدم المناطق = 0** رغم عداد المدن يعمل
4. **تأخير تحديث المنتجات** بعد التعديل
5. **مشتريات سارة تظهر في تبويب المدير** بدون تمييز
6. **بوابة AI تتأخر + طلب موافق عليه يختفي ثم يعود**
7. **خطأ "لم يتم العثور على الملف الشخصي"**

---

## المرحلة 1: الفحص الشامل (Read-Only)

### 1.1 الحذف الكارثي
- فحص `AlWaseetContext.jsx` `performDeletionPassAfterStatusSync` - هل circuit breaker يعمل فعلاً؟
- فحص ما حدث للطلبات المحذوفة عبر استعلام SQL على activity log
- البحث عن أي مكان آخر يحذف الطلبات (triggers, edge functions, cleanup jobs)

### 1.2 قواعد الأرباح لمدير القسم
- فحص `DepartmentManagerSettingsPage.jsx` كاملاً لمعرفة كيفية الجلب والعرض
- استعلام مباشر لقواعد أحمد (employee_id = ahmed) لرؤية ما إذا كانت سارة تستطيع قراءتها
- فحص RLS الفعلي بعد migration الأخير

### 1.3 شريط تقدم المناطق
- مراجعة آخر تعديل على `update-cities-cache/index.ts` و `CitiesCacheManager`
- مقارنة مع git history لمعرفة متى توقف عداد المناطق
- فحص جدول `cities_regions_sync_log` للسجلات الأخيرة

### 1.4 تأخير المنتجات
- فحص `dbUpdateVariantStock` و `updateProduct` في `SuperAPI.js`
- التأكد من optimistic updates تعمل
- فحص معالج Realtime لـ `product_variants`

### 1.5 مشتريات سارة عند المدير
- فحص `PurchasesPage.jsx` فلترة - هل تعرض حسب المالك المالي أم الكل؟
- التأكد من تمييز مشتريات مدير القسم بصرياً

### 1.6 بوابة AI + اختفاء الطلب
- فحص `approveAiOrder` في `useAiOrders` 
- فحص معالج Realtime لـ `orders` - هل DELETE event يطلق بالخطأ؟
- فحص badge counter للطلبات الذكية

### 1.7 خطأ Profile not found
- فحص استعلامات `profiles` الأخيرة
- التحقق من race condition في تحميل البروفايل

---

## المرحلة 2: الإصلاحات

### إصلاح 1: حماية مطلقة من الحذف 🔴
**القاعدة الذهبية الجديدة (بروتوكول عالمي)**:
```text
لا يُحذف أي طلب إلا إذا:
1. API استجاب بنجاح (200) مرتين متتاليتين بفاصل 30 ثانية
2. الطلب غير موجود في الردين
3. مر على الطلب أكثر من 14 يوم
4. عدد الحذف الكلي في الجلسة < 3
5. لم يحدث أي خطأ شبكة في آخر 5 دقائق
```

**الملفات**:
- `src/contexts/AlWaseetContext.jsx`: تشديد circuit breaker
- إضافة جدول `order_deletion_audit` لتسجيل كل محاولة حذف
- migration: trigger يمنع DELETE على orders إذا لم يمر 14 يوم على آخر sync ناجح

### إصلاح 2: قواعد الأرباح تظهر لمدير القسم
- إصلاح فلترة `DepartmentManagerSettingsPage` لجلب القواعد الفعلية
- إضافة badge "من مدير القسم" في صفحة المدير العام لتمييز القواعد
- إصلاح زر فتح ملف الموظف في إعدادات القسم
- إضافة أزرار تعديل/حذف واضحة لكل قاعدة

**الملفات**:
- `src/pages/DepartmentManagerSettingsPage.jsx`
- صفحة قواعد أرباح المدير العام (سأحددها بعد البحث)

### إصلاح 3: شريط تقدم المناطق
- مراجعة `update-cities-cache/index.ts` للتأكد من تحديث `regions_count` بعد كل مدينة
- إصلاح Realtime subscription على `cities_regions_sync_log` في `CitiesCacheManager`
- نفس الإصلاح لـ MODON

### إصلاح 4: تحديث فوري للمنتجات
- optimistic update فوري في `dbUpdateVariantStock` قبل انتظار DB
- إزالة `fetchAllData()` من معالجات Realtime
- تحديث محلي مباشر في `allData.products` بناءً على Realtime payload

### إصلاح 5: تمييز مشتريات سارة
- إضافة badge "مشتريات مدير القسم" في PurchasesPage
- فلترة اختيارية: "كل المشتريات" / "مشترياتي" / "مشتريات المديرين"

### إصلاح 6: بوابة AI + الطلب المختفي
- إصلاح `approveAiOrder`: insert محلي فوري قبل realtime
- منع DELETE event الكاذب من إخفاء الطلب
- إصلاح badge counter لـ AI orders ليكون realtime مباشر

### إصلاح 7: خطأ Profile not found
- إضافة retry logic + skeleton loader أثناء تحميل البروفايل
- منع استعلامات قبل اكتمال التوثيق

---

## ترتيب التنفيذ

| # | المهمة | الأولوية | الخطر |
|---|--------|----------|------|
| 1 | حماية الحذف (migration + كود) | 🔴 كارثي | منخفض |
| 2 | قواعد الأرباح + ملف الموظف | 🔴 حرج | منخفض |
| 3 | بوابة AI + الطلب المختفي | 🔴 حرج | منخفض |
| 4 | تحديث فوري للمنتجات | 🟠 عالي | منخفض |
| 5 | شريط تقدم المناطق | 🟠 عالي | منخفض |
| 6 | تمييز مشتريات المدير | 🟡 متوسط | منخفض |
| 7 | خطأ Profile not found | 🟡 متوسط | منخفض |

---

## ضمانات السلامة

1. **لا حذف لأي بيانات** - فقط إصلاح المنطق
2. **migration واحد فقط** لحماية الحذف (audit + trigger)
3. **فحص حقيقي قبل كل تعديل** بـ SQL وقراءة الكود
4. **build check بعد كل مرحلة**
5. **التغييرات معزولة** - كل ملف يُصلح مشكلة محددة

---

## الملفات المتأثرة

| الملف | التغيير |
|------|--------|
| `src/contexts/AlWaseetContext.jsx` | تشديد circuit breaker |
| Migration جديد | جدول audit + trigger حماية + RLS قواعد الأرباح |
| `src/pages/DepartmentManagerSettingsPage.jsx` | عرض قواعد الأرباح + فتح ملف الموظف |
| صفحة قواعد المدير العام | badge تمييز قواعد مدير القسم |
| `src/components/CitiesCacheManager` | Realtime على log |
| `supabase/functions/update-cities-cache` | تحديث regions_count |
| `src/api/SuperAPI.js` | optimistic updates للمنتجات |
| `src/contexts/SuperProvider.jsx` | معالج Realtime محسن |
| `src/hooks/useAiOrders` | insert محلي بعد approve |
| `src/pages/PurchasesPage.jsx` | تمييز مشتريات المدير |

ابدأ بالمرحلة 1 (الفحص) ثم التنفيذ المرتب؟

