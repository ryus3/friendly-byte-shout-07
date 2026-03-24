

# إصلاح: المصاريف العامة لا تُحفظ + خطأ بناء Vercel

## الأوضاع الحالية

### 1. أرباح سارة (كامل الربح)
سارة لديها قاعدة "كامل الربح" الآن. عند استلام فاتورة لطلب أنشأته سارة:
- ربحها = سعر البيع - سعر التكلفة (كامل الهامش)
- يظهر في صفحة "أرباحي" الخاصة بها
- يظهر في المركز المالي للموظف عند المدير
- تكلفة المنتجات تُسترد للنظام (COGS)، الهامش كله لسارة

### 2. المصاريف العامة لا تُحفظ - **المشكلة الرئيسية**

**السبب المؤكد**: دالة `addExpense` في `SuperProvider.jsx` (سطر 1444-1460) هي **stub فارغ** - تعرض رسالة نجاح فقط ولا تحفظ شيئاً في قاعدة البيانات:

```javascript
const addExpense = useCallback(async (expense) => {
  // TODO: تطبيق في SuperAPI  ← هذا التعليق يؤكد أنها غير مكتملة
  toast({ title: "تمت إضافة المصروف", ... });
  return { success: true, data: expense };  // ← لا يحفظ شيئاً!
}, []);
```

**الإصلاح**: استبدال الـ stub بكود فعلي يحفظ في جدول `expenses`:

```javascript
const addExpense = useCallback(async (expense) => {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      amount: expense.amount,
      category: expense.category,
      description: expense.description,
      transaction_date: expense.transaction_date || new Date().toISOString(),
      expense_type: expense.expense_type || 'operational',
      created_by: user?.id || user?.user_id
    })
    .select()
    .single();
  
  if (error) throw error;
  
  superAPI.invalidate('all_data');
  await fetchAllData();
  
  toast({ title: "تمت إضافة المصروف", ... });
  return { success: true, data };
}, [user]);
```

### 3. خطأ Vercel: `vite: command not found` (exit 127)

**السبب**: في `vercel.json` يوجد:
```json
"env": { "NODE_ENV": "production" }
```

هذا يجعل `npm ci` يتخطى `devDependencies` حيث يوجد `vite`. فعند تشغيل `npm run build` → `vite build`، لا يجد أمر `vite`.

**الإصلاح**: إزالة `env` من `vercel.json` أو تغيير `installCommand` ليتضمن devDependencies:

```json
"installCommand": "npm ci --legacy-peer-deps --include=dev"
```

---

## الملفات المتأثرة

| الملف | التعديل | المخاطر |
|-------|---------|---------|
| `src/contexts/SuperProvider.jsx` | استبدال stub بكود حفظ فعلي (سطر 1444-1460) | صفر - نفس الواجهة |
| `vercel.json` | إضافة `--include=dev` للـ installCommand | صفر - يصلح البناء فقط |

## ما لن يتغير
- `ExpensesDialog.jsx` - يعمل بشكل صحيح، المشكلة ليست فيه
- قواعد الأرباح - تبقى كما هي
- بوت التليغرام - يبقى كما هو

