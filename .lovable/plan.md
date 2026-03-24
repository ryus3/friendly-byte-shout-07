

# إصلاح مشكلتين: خطأ حفظ قاعدة الربح + عدم ظهور كل المنتجات في التليغرام

## المشكلة 1: خطأ حفظ قاعدة "كامل الربح"

**السبب**: سياسة RLS على جدول `employee_profit_rules` تتطلب صلاحية `manage_profit_settlement`. المستخدم الحالي (المدير) قد لا يملك هذه الصلاحية بالتحديد، أو أن الـ policy من نوع `ALL` بدون `WITH CHECK` مما يعني أن الـ INSERT يفشل.

**التحقق**: السياسة الحالية:
```
policy: "المديرون يديرون قواعد الأرباح"
cmd: ALL
qual: check_user_permission(auth.uid(), 'manage_profit_settlement')
with_check: NULL
```

عندما `with_check` يكون NULL في policy نوع ALL، PostgreSQL يستخدم `qual` كـ check condition أيضاً. المشكلة أن المستخدم الذي يحاول الحفظ قد لا يملك صلاحية `manage_profit_settlement`.

**الحل**: سأتحقق من المستخدم الحالي وصلاحياته، وإذا لزم الأمر سأوسّع السياسة لتشمل `manage_all_data` أو أدوار المديرين. أو سأضيف الصلاحية للدور المناسب.

**التعديل**: Migration لتحديث RLS policy لتشمل المديرين (`super_admin`, `admin`) مباشرة بجانب صلاحية `manage_profit_settlement`.

## المشكلة 2: التليغرام يعرض فقط جزء من المنتجات

**السبب واضح في الكود** (سطر 1050-1051):
```typescript
// أخذ أول 8 منتجات
const products = Array.from(uniqueProducts.values()).slice(0, 8);
```

و fallback أيضاً `.limit(8)`. لديك 13 منتج لكن البوت يعرض فقط 8 + زر "المزيد" الذي **لا يعمل** (لا يوجد handler لـ `more_products` في الكود).

**الحل**: رفع الحد من 8 إلى عرض جميع المنتجات (13 منتج يمكن عرضهم بسهولة في Telegram inline keyboard - الحد الأقصى 100 زر). وإزالة منطق "المزيد" غير المُنفّذ.

## الملفات والتعديلات

| الملف | التعديل |
|-------|---------|
| Migration SQL | تحديث RLS policy على `employee_profit_rules` لتشمل المديرين |
| `supabase/functions/telegram-bot/index.ts` | رفع حد المنتجات من 8 → 50، وإزالة `.limit(8)` من fallback |

## التفاصيل التقنية

### RLS Fix (Migration)
```sql
DROP POLICY IF EXISTS "المديرون يديرون قواعد الأرباح" ON employee_profit_rules;
CREATE POLICY "المديرون يديرون قواعد الأرباح" ON employee_profit_rules
FOR ALL TO authenticated
USING (
  check_user_permission(auth.uid(), 'manage_profit_settlement')
  OR check_user_permission(auth.uid(), 'manage_all_data')
)
WITH CHECK (
  check_user_permission(auth.uid(), 'manage_profit_settlement')
  OR check_user_permission(auth.uid(), 'manage_all_data')
);
```

### Telegram Fix
```typescript
// بدلاً من slice(0, 8):
const products = Array.from(uniqueProducts.values()).slice(0, 50);
// وإزالة .limit(8) من fallback
```

ثم إعادة نشر edge function `telegram-bot`.

