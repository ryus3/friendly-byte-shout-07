

# خطة إصلاح طلب ORD000808

## الوضع الحالي
الطلب مؤرشف خطأً ومسجّل عليه `settled_at` رغم عدم وجود أي تسوية فعلية. الموظف عبدالله يستحق 7,000 د.ع.

## التعديل المطلوب - Migration واحد

```sql
-- إزالة settled_at الخاطئ وإلغاء الأرشفة
UPDATE profits 
SET settled_at = NULL 
WHERE order_id = '8caaa28a-004e-