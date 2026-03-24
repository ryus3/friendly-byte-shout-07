

# إصلاح مشكلتين: خطأ حفظ "كامل الربح" + منتجات التليغرام

## المشكلة 1: لماذا القواعد العادية تعمل والربح الكامل يفشل؟

**السبب الدقيق**: قيد في قاعدة البيانات (`CHECK constraint`) يسمح فقط بـ:
```
product, category, department
```

لكن عند اختيار "افتراضي (لجميع المنتجات)" أو "كامل الربح" من الواجهة، الكود يرسل:
```
rule_type = 'default'
```

وهذا **مرفوض** من قاعدة البيانات. القواعد العادية تعمل لأنها ترسل `product` أو `category` وهي مسموحة.

**الإصلاح**: توسيع قيد قاعدة البيانات ليقبل القيم التي يستخدمها النظام فعلاً:
```sql
ALTER TABLE employee_profit_rules DROP CONSTRAINT employee_profit_rules_rule_type_check;
ALTER TABLE employee_profit_rules ADD CONSTRAINT employee_profit_rules_rule_type_check 
  CHECK (rule_type IN ('product', 'category', 'department', 'default', 'variant', 'product_type'));
```

هذا لا يمس أي بيانات موجودة ولا يغير أي منطق - فقط يوسع القيم المسموحة.

## المشكلة 2: التليغرام يعرض 8 منتجات فقط

**السبب**: الإصلاح السابق عدّل `slice(0, 50)` (تم ✅) لكن **لم يعدّل الـ fallback** الذي ما زال:
```typescript
.limit(8)  // ← سطر 1006
```

والـ RPC `get_inventory_by_permissions` معطوبة (تشير لأعمدة غير موجودة)، فالبوت يسقط دائماً للـ fallback المحدود بـ 8.

**الإصلاح**: تغيير `.limit(8)` إلى `.limit(50)` في fallback المنتجات (سطر 1006 فقط). باقي الـ limits للألوان والأحجام والفئات لا تحتاج تعديل لأنها قوائم فرعية.

## الملفات التي ستتعدل

| الملف | التعديل | المخاطر |
|-------|---------|---------|
| Migration SQL | توسيع CHECK constraint | صفر - لا يمس بيانات موجودة |
| `telegram-bot/index.ts` | `limit(8)` → `limit(50)` سطر 1006 فقط | صفر - يوسع العرض فقط |

## ما لن يتغير
- `EmployeeProfitsManager.jsx` - يبقى كما هو ✅
- `SuperProvider.jsx` - يبقى كما هو ✅
- `DepartmentManagerSettingsPage.jsx` - يبقى كما هو ✅
- القواعد الحالية المحفوظة - لن تتأثر ✅
- الموظف بدون قاعدة يبقى ربحه 0 ✅

## النتيجة
1. حفظ "كامل الربح" وأي نوع قاعدة يعمل بدون خطأ
2. القواعد العادية تبقى تعمل كالمعتاد
3. البوت يعرض كل المنتجات النشطة (حتى 50)

