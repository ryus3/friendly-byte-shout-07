-- 1. إصلاح Foreign Key Constraint في applied_customer_discounts
-- إضافة ON DELETE CASCADE لحل مشكلة حذف الطلبات مع الخصومات

-- حذف الـ constraint القديم
ALTER TABLE applied_customer_discounts 
DROP CONSTRAINT IF EXISTS applied_customer_discounts_order_id_fkey;

-- إضافة constraint جديد مع CASCADE
ALTER TABLE applied_customer_discounts 
ADD CONSTRAINT applied_customer_discounts_order_id_fkey 
FOREIGN KEY (order_id) 
REFERENCES orders(id) 
ON DELETE CASCADE;

-- 2. تحديث trigger لإكمال الطلبات عند استلام الفاتورة
-- للمدير: invoice_received كافية
-- للموظفين: يجب settled

CREATE OR REPLACE FUNCTION public.complete_order_when_profit_settled_or_received()
RETURNS trigger AS $$
BEGIN
  -- عند تغيير حالة الربح إلى settled أو invoice_received
  IF NEW.status IN ('settled', 'invoice_received') 
     AND COALESCE(OLD.status, '') NOT IN ('settled', 'invoice_received') THEN
    
    UPDATE public.orders o
    SET status = 'completed', updated_at = now()
    WHERE o.id = NEW.order_id
      AND o.receipt_received = true
      AND o.status NOT IN ('completed', 'cancelled')
      -- شرط ذكي: للمدير invoice_received كافية، للموظفين يجب settled
      AND (
        -- طلبات المدير: تكتمل عند invoice_received أو settled
        (o.created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid 
         AND NEW.status IN ('settled', 'invoice_received'))
        OR
        -- طلبات الموظفين: تكتمل فقط عند settled
        (o.created_by != '91484496-b887-44f7-9e5d-be9db5567604'::uuid 
         AND NEW.status = 'settled')
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. حذف الطلبات العالقة الحالية (106768178, 106768142)
-- ملاحظة: بعد إصلاح CASCADE، سيتم حذفها تلقائياً
DELETE FROM applied_customer_discounts 
WHERE order_id IN (
  SELECT id FROM orders 
  WHERE tracking_number IN ('106768178', '106768142')
);

DELETE FROM orders 
WHERE tracking_number IN ('106768178', '106768142');