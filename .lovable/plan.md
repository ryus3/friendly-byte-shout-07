

## خطة إصلاح 4 مشاكل محددة

### المشكلة 1: المصاريف العامة تظهر 5,000 عند سارة رغم حذف المصروف

**السبب**: في `EmployeeFinancialCenterPage.jsx` سطر 174-177، يحسب المصاريف فقط من حركات `movement_type === 'out' && reference_type === 'expense'` (5000 دينار). لكنه لا يخصم حركات إرجاع المصاريف المحذوفة (`movement_type === 'in' && reference_type === 'expense_refund'` = 5000 دينار). النتيجة: يعرض 5000 بدل 0.

نفس المشكلة موجودة في `UnifiedProfitDisplay.jsx` سطر 249 - يحسب المصاريف من جدول `expenses` فقط بدون خصم الإرجاعات من `cash_movements`.

**الإصلاح**:
- **`src/pages/EmployeeFinancialCenterPage.jsx`**: إضافة حساب `expense_refund` وخصمها من `totalExpenses`
- **`src/components/shared/UnifiedProfitDisplay.jsx`**: نفس المنطق - خصم حركات `expense_refund` من `generalExpenses`

---

### المشكلة 2: المدن والأحجام تُجلب من API الخارجي في كل مرة يُفتح الموقع

**السبب**: في `AlWaseetContext.jsx` سطر 4402-4418 يوجد useEffect يستدعي `fetchCities()` و `fetchPackageSizes()` مباشرة من API الوسيط عند كل تحميل. هذا غير ضروري لأن المدن والمناطق محفوظة في الكاش (18 مدينة و 6232 منطقة).

**الإصلاح**:
- **`src/contexts/AlWaseetContext.jsx`**: تغيير `fetchCities` ليجلب أولاً من `cities_master` (الكاش المحلي). فقط إذا كان الكاش فارغاً يذهب للـ API الخارجي.
- نفس الشيء لـ `fetchPackageSizes` - جلب من الكاش أولاً.

---

### المشكلة 3: تحديث كاش المدن والمناطق لا يجلب المناطق (0 منطقة)

**السبب**: دالة `update-cities-cache/index.ts` تستدعي `alwaseet-proxy` عبر `supabase.functions.invoke`. عند حظر Cloudflare، الـ proxy يرجع `{errNum: 'CF_BLOCKED', fallback: true}` - وهذا كائن بدون `.data` فيعتبره الكود "لا توجد بيانات" ويرجع مصفوفة فارغة بصمت. أيضاً حسب الذاكرة المعمارية، يجب استخدام `fetch` مباشر بدل `supabase.functions.invoke` في العمليات الطويلة.

**الإصلاح**:
- **`supabase/functions/update-cities-cache/index.ts`**: 
  - إضافة فحص `CF_BLOCKED` / `fallback` في `fetchCitiesFromAlWaseet` و `fetchRegionsFromAlWaseet`
  - عند اكتشاف الحظر: إعادة محاولة بعد 2 ثانية، ثم فشل واضح مع رسالة خطأ

---

### المشكلة 4: قواعد الربح من مدير القسم لا تُحفظ

**السبب مؤكد**: UNIQUE constraint في PostgreSQL هو `(employee_id, rule_type, target_id)`. عند إضافة قاعدة "كل المنتجات" (default)، `target_id = null`. في PostgreSQL، `NULL != NULL` في UNIQUE constraints، فالـ `upsert` مع `onConflict: 'employee_id,rule_type,target_id'` لا يجد conflict ويحاول INSERT جديد كل مرة. النتيجة: إما خطأ صامت أو عدم حفظ.

**الإصلاح**:
- **`src/pages/DepartmentManagerSettingsPage.jsx`**: 
  - للقواعد بدون منتج محدد: استخدام `select` ثم `update` أو `insert` يدوياً بدل `upsert`
  - فحص وجود قاعدة `default` للموظف أولاً، إذا وجدت: `update`، إذا لا: `insert`
  - إضافة معالجة أخطاء واضحة (عرض الخطأ الفعلي من Supabase)

---

### ملخص الملفات المطلوب تعديلها:
1. `src/pages/EmployeeFinancialCenterPage.jsx` - خصم expense_refund
2. `src/components/shared/UnifiedProfitDisplay.jsx` - خصم expense_refund  
3. `src/contexts/AlWaseetContext.jsx` - جلب المدن من الكاش المحلي أولاً
4. `supabase/functions/update-cities-cache/index.ts` - فحص CF_BLOCKED + إعادة محاولة
5. `src/pages/DepartmentManagerSettingsPage.jsx` - إصلاح حفظ قواعد الربح بـ select+update/insert

