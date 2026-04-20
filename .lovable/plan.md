

# الخطة النهائية - 3 إصلاحات دقيقة

## التشخيص المؤكد بالأدلة

### 1. قواعد الأرباح لا تظهر لمدير القسم 🎯 (السبب الحقيقي مكتشف)

**رسالة الخطأ من console**:
```
PGRST200: Could not find a relationship between 'employee_profit_rules' 
and 'profiles' in the schema cache
```

الكود في `DepartmentManagerSettingsPage.jsx` (سطر 209) يستخدم:
```js
employee:profiles!employee_id(full_name, employee_code)
```

لكن **لا يوجد foreign key** بين `employee_profit_rules.employee_id` و `profiles.user_id` (لأن `user_id` ليس primary key على `profiles`، بل `id` هو الـ PK).

النتيجة: الاستعلام يفشل بالكامل ⇒ `data = null` ⇒ `profitRules = []` ⇒ "لا توجد قواعد".

**البيانات الفعلية**: أحمد (الموظف الوحيد تحت إشراف سارة) لديه **7 قواعد نشطة** + RLS صحيحة + سارة لديها `manage_profit_settlement`.

---

### 2. تأخير تحديث المنتجات

في `SuperProvider.jsx` سطر 2996-2999:
```js
updateProduct: async (...args) => {
  const res = await dbUpdateProduct(...args);
  await fetchAllData();   // ❌ يسبب تأخير 2-3 ثوانٍ
  return res;
}
```

`updateVariantStock` تم إصلاحها سابقاً، لكن `updateProduct` لا تزال تنتظر `fetchAllData()` كاملاً.

---

### 3. كرت طلبات الذكاء الاصطناعي يحتاج تحديث يدوي

من فحص `Dashboard.jsx`:
- `aiOrdersCount` يعتمد على `aiOrders` (من SuperProvider)
- Realtime على `ai_orders` يعمل (`SuperProvider` سطر 731-747)
- لكن: `permanentlyDeletedAiOrders` Set في localStorage قد يحوي ID الطلب الجديد المعاد إنشاؤه (إذا كان مكرراً لطلب محذوف سابقاً) ⇒ يُحجب فوراً

كذلك، الـ counter يستخدم `userAiOrders` للموظف العادي، الذي يعتمد على `userEmployeeCode`. عند التحديث الفوري عبر Realtime، الطلب الجديد قد يُضاف لـ `aiOrders` لكن **لا يطابق** `userEmployeeCode` لأن الفلترة صارمة.

لكن **سارة في الصور هي مدير قسم** ⇒ `canViewAllData = false` ⇒ تستخدم `userAiOrders` ⇒ الطلبات الذكية للتلغرام `created_by` يكون رمز الموظف (مثل `RYUS-...`) وليس UUID.

**السبب الأرجح**: عند INSERT realtime، الطلب يُضاف إلى `allData.aiOrders` (raw)، ثم يُمرر عبر فلتر `userAiOrders` الذي يحتاج تطابق employee_code، فإذا لم يطابق ⇒ count = 0 رغم أن الطلب موجود.

لكن **السبب الأكبر** الذي يفسر "يبقى 0 بالخارج لكن يوجد طلبات بالداخل":  
نافذة `AiOrdersManager` تجلب من DB مباشرة (سطر 84) بدون فلترة employee_code ⇒ تظهر كل شيء. أما العداد على Dashboard يستخدم `userAiOrders` المفلترة.

---

## الإصلاحات

### إصلاح 1: قواعد الأرباح لمدير القسم (الأهم)

**ملف**: `src/pages/DepartmentManagerSettingsPage.jsx`

استبدال JOIN الفاشل بجلب منفصل:
```js
// بدلاً من employee:profiles!employee_id(...)
const { data } = await supabase
  .from('employee_profit_rules')
  .select('*')
  .in('employee_id', supervisedEmployeeIds)
  .eq('is_active', true);

// جلب الموظفين منفصلاً
const { data: employees } = await supabase
  .from('profiles')
  .select('user_id, full_name, employee_code')
  .in('user_id', supervisedEmployeeIds);

const employeesMap = {};
employees?.forEach(e => { employeesMap[e.user_id] = e; });

// إثراء البيانات
const enriched = data.map(r => ({
  ...r,
  employee: employeesMap[r.employee_id] || null,
  product: productsMap[r.target_id] || null
}));
```

تطبيق نفس الإصلاح على `handleAddProfitRule` (الذي يستخدم نفس الاستعلام بعد insert).

---

### إصلاح 2: تحديث فوري للمنتجات

**ملف**: `src/contexts/SuperProvider.jsx` سطر 2996-2999

إزالة `await fetchAllData()` - الـ Realtime على `products` و `product_variants` سيحدّث تلقائياً عبر `dbRefetchProducts` المُجدول بـ 100ms (سطر 869-875):

```js
updateProduct: async (...args) => {
  const res = await dbUpdateProduct(...args);
  // ⚡ Realtime + dbRefetchProducts المجدول يتولى التحديث
  return res;
}
```

---

### إصلاح 3: عداد طلبات الذكاء الاصطناعي

**ملف**: `src/pages/Dashboard.jsx` سطر 348-358

تحسين فلترة `userAiOrders` لتشمل المطابقة بـ UUID و employee_code معاً + إضافة fallback للمدير العام والقسم:

```js
const userAiOrders = useMemo(() => {
  if (!Array.isArray(aiOrders)) return [];
  if (canViewAllData) return aiOrders;
  
  const upper = (v) => (v ?? '').toString().trim().toUpperCase();
  const candidates = [
    userEmployeeCode, 
    user?.employee_code, 
    user?.user_id, 
    user?.id
  ].filter(Boolean).map(upper);
  
  if (!candidates.length) return aiOrders; // ⚡ fallback: أرجع الكل بدلاً من []
  
  return aiOrders.filter((order) => {
    const by = order?.created_by ?? order?.user_id 
      ?? order?.created_by_employee_code 
      ?? order?.order_data?.created_by;
    if (!by) return true; // ⚡ إذا لم نعرف، أظهره
    return candidates.includes(upper(by));
  });
}, [aiOrders, canViewAllData, userEmployeeCode, user]);
```

---

## ترتيب التنفيذ

| # | المهمة | الملف | الخطر |
|---|--------|------|------|
| 1 | إصلاح JOIN قواعد الأرباح | `DepartmentManagerSettingsPage.jsx` | منخفض جداً |
| 2 | إزالة `fetchAllData` من `updateProduct` | `SuperProvider.jsx` | منخفض |
| 3 | تحسين فلترة `userAiOrders` | `Dashboard.jsx` | منخفض |

## ضمانات السلامة
- لا migrations، لا تغيير في DB
- لا حذف لأي بيانات
- 3 ملفات فقط، تعديلات معزولة
- الإصلاح الأول يعتمد على رسالة خطأ واضحة من console (دليل قاطع)

