

# خطة: إضافة خيار "كامل الربح" في قواعد الأرباح

## الوضع الحالي

| المكوّن | الحالة |
|---------|--------|
| `SuperProvider.jsx` - حساب `profit_percentage === 100` | ✅ موجود وصحيح |
| `DepartmentManagerSettingsPage.jsx` - toggle "كامل الربح" | ✅ موجود |
| `EmployeeProfitsManager.jsx` - نافذة قواعد الربح الرئيسية | ❌ **لا يوجد خيار كامل الربح** |
| Database trigger `auto_create_profit_record` | ❌ **يقرأ `profit_amount` فقط، يتجاهل `profit_percentage`** |

**المشكلة**: صفحة إدارة الأرباح الرئيسية (`EmployeeProfitsManager`) لا تدعم "كامل الربح"، والـ trigger يحسب 0 لأنه لا يقرأ `profit_percentage`.

## التعديلات المطلوبة

### 1. تعديل Database Trigger (Migration)

تحديث `auto_create_profit_record` لقراءة `profit_percentage` بجانب `profit_amount`:

```sql
-- السطر 83 الحالي:
SELECT profit_amount INTO v_item_profit

-- يصبح:
SELECT profit_amount, profit_percentage INTO v_item_profit, v_item_percentage

-- السطر 100 الحالي:
v_employee_profit := v_employee_profit + (COALESCE(v_item_profit, 0) * v_item.quantity);

-- يصبح:
IF COALESCE(v_item_percentage, 0) = 100 THEN
  v_employee_profit := v_employee_profit + 
    GREATEST(0, (v_item.unit_price - COALESCE(v_item_cost, 0)) * v_item.quantity);
ELSE
  v_employee_profit := v_employee_profit + (COALESCE(v_item_profit, 0) * v_item.quantity);
END IF;
```

### 2. تعديل `EmployeeProfitsManager.jsx`

إضافة Toggle "كامل الربح" في نموذج إضافة القاعدة:
- عند التفعيل: `profit_percentage = 100`, `profit_amount = 0`، وحقل المبلغ يُعطَّل
- عند إيقافه: يعود للمبلغ الثابت كالمعتاد
- عرض badge "كامل الربح" في جدول القواعد الحالية بدلاً من المبلغ عندما `profit_percentage === 100`
- تعديل validation ليقبل المبلغ 0 عند تفعيل كامل الربح

### 3. لا تعديل على باقي الملفات

- `SuperProvider.jsx` - صحيح بالفعل ✅
- `DepartmentManagerSettingsPage.jsx` - صحيح بالفعل ✅
- الموظف بدون قاعدة يبقى ربحه 0 ✅

## ملخص

| الملف | التعديل |
|-------|---------|
| Migration SQL | trigger يقرأ `profit_percentage` ويحسب الهامش الكامل |
| `EmployeeProfitsManager.jsx` | toggle + badge + validation |

**النتيجة**: المدير يستطيع من نافذة قواعد الأرباح تفعيل "كامل الربح" لأي موظف/منتج، والحساب يعمل في الكود والـ trigger معاً.

