

# إصلاح: المصاريف العامة لا تُسجّل حركة صرف

## السبب الجذري

عمود `status` في جدول `expenses` قيمته الافتراضية `'pending'`. لكن الـ trigger الذي يُنشئ حركة النقد يشترط `status = 'approved'`:

```sql
IF TG_OP = 'INSERT' AND NEW.status = 'approved' ...  -- ← لا ينطبق لأن status = 'pending'
```

دالة `addExpense` في `SuperProvider.jsx` **لا ترسل `status`** → فيبقى `pending` → الـ trigger يتجاهله → لا حركة نقد.

بالإضافة: `ExpensesDialog.jsx` ما زال يحتوي على `window.location.reload()` الذي قد يقطع العملية.

## الإصلاح (ملفان فقط)

### 1. `src/contexts/SuperProvider.jsx` (سطر ~1457)

إضافة `status: 'approved'` في الـ insert:

```javascript
.insert({
  amount: Number(expense.amount),
  category: expense.category || 'عام',
  description: expense.description || '',
  expense_type: expense.expense_type || 'operational',
  created_by: userId,
  status: 'approved',           // ← إضافة هذا السطر
  approved_by: userId,          // ← الموافق هو نفس المُنشئ
  approved_at: new Date().toISOString(),
  vendor_name: expense.vendor_name || null,
  receipt_number: expense.receipt_number || null,
  metadata: expense.metadata || null
})
```

**النتيجة**: الـ trigger يكتشف `status = 'approved'` ويُنشئ حركة صرف من القاصة الرئيسية تلقائياً.

### 2. `src/components/accounting/ExpensesDialog.jsx` (سطر 96-99)

حذف `window.location.reload()`:

```javascript
// حذف هذا الكود بالكامل:
// if (typeof window !== 'undefined') {
//   window.location.reload();
// }
```

## بخصوص صلاحية المصاريف لسار

<lov-plan>

# إصلاح: المصاريف العامة لا تُسجّل حركة صرف + صلاحية مصاريف للموظف

## السبب الجذري للمصاريف

عمود `status` في جدول `expenses` قيمته الافتراضية `'pending'`. لكن الـ trigger الذي يُنشئ حركة النقد يشترط `status = 'approved'`:

```sql
IF TG_OP = 'INSERT' AND NEW.status = 'approved' ...  -- لا ينطبق لأن status = pending
```

دالة `addExpense` في `SuperProvider.jsx` **لا ترسل `status`** → يبقى `pending` → الـ trigger يتجاهله → لا حركة نقد ولا تظهر كمصروف فعلي.

بالإضافة: `ExpensesDialog.jsx` ما زال يحتوي على `window.location.reload()` الذي يقطع العملية.

## الإصلاح

### 1. `src/contexts/SuperProvider.jsx` (سطر ~1453)

إضافة `status: 'approved'` في الـ insert:

```javascript
.insert({
  amount: Number(expense.amount),
  category: expense.category || 'عام',
  description: expense.description || '',
  expense_type: expense.expense_type || 'operational',
  created_by: userId,
  status: 'approved',
  approved_by: userId,
  approved_at: new Date().toISOString(),
  vendor_name: expense.vendor_name || null,
  receipt_number: expense.receipt_number || null,
  metadata: expense.metadata || null
})
```

**النتيجة**: الـ trigger يكتشف `status = 'approved'` ويُنشئ حركة صرف من القاصة الرئيسية تلقائياً — كما كان يعمل سابقاً.

### 2. `src/components/accounting/ExpensesDialog.jsx` (سطر 96-99)

حذف `window.location.reload()` بالكامل — لأن `addExpense` يحدّث البيانات عبر `invalidate + fetchAllData`.

### 3. `src/components/shared/UnifiedProfitCalculator.jsx` (سطر ~81)

تغيير `e.transaction_date` إلى `e.created_at` لأن عمود `transaction_date` غير موجود في الجدول:

```javascript
const expensesInRange = safeExpenses.filter(e => filterByDate(e.created_at));
```

## بخصوص صلاحية مصاريف لسارة

هذا مرتبط بميزة "المركز المالي للموظف" — حيث سارة (بقاعدة كامل الربح) تحتاج أن تُسجّل مصاريفها الخاصة من أرباحها. هذه ميزة منفصلة تحتاج تصميم خاص — أقترح تنفيذها بعد التأكد من أن المصاريف العامة تعمل بشكل صحيح أولاً. هل توافق؟

## الملفات المتأثرة

| الملف | التعديل | المخاطر |
|-------|---------|---------|
| `SuperProvider.jsx` | إضافة `status: 'approved'` + `approved_by` + `approved_at` | صفر |
| `ExpensesDialog.jsx` | حذف `window.location.reload()` | صفر |
| `UnifiedProfitCalculator.jsx` | `transaction_date` → `created_at` | صفر |

## ما لن يتغير
- الـ trigger الحالي — صحيح ويعمل ✅
- القاصة الرئيسية — لا تتأثر ✅
- قواعد الأرباح — لا تتأثر ✅
- بوت التليغرام — لا يتأثر ✅

## النتيجة
1. المصروف يُحفظ بحالة `approved` مباشرة
2. الـ trigger يُنشئ حركة صرف تلقائياً من القاصة الرئيسية
3. المصروف يظهر في نافذة المصاريف العامة وفي التقارير المالية
4. لا reload للصفحة — تحديث سلس

