-- ========================================
-- المرحلة 1: إضافة حالة partial_delivery لجدول orders
-- ========================================

-- إزالة القيد القديم إن وجد
ALTER TABLE orders
DROP CONSTRAINT IF EXISTS orders_status_check;

-- إضافة القيد الجديد مع الحالة الجديدة
ALTER TABLE orders
ADD CONSTRAINT orders_status_check 
CHECK (status IN (
  'pending', 'processing', 'shipped', 'delivery', 
  'delivered', 'completed', 'cancelled', 'returned', 
  'return_pending', 'return_received', 'returned_in_stock',
  'partial_delivery'
));

-- ========================================
-- المرحلة 2: إنشاء VIEW موحد لتتبع التسليمات
-- ========================================

CREATE OR REPLACE VIEW delivery_tracking AS
SELECT 
  o.id,
  o.order_number,
  o.tracking_number,
  o.delivery_partner_order_id,
  o.status,
  o.delivery_status,
  o.delivery_partner,
  o.customer_name,
  o.customer_phone,
  o.customer_city,
  o.total_amount,
  o.final_amount,
  o.delivery_fee,
  o.price_increase,
  o.price_change_type,
  
  -- إحصائيات المنتجات
  COUNT(DISTINCT oi.id) as total_items,
  SUM(CASE WHEN oi.item_status = 'delivered' THEN 1 ELSE 0 END) as delivered_items_count,
  SUM(CASE WHEN oi.item_status = 'pending_return' THEN 1 ELSE 0 END) as pending_return_items_count,
  SUM(CASE WHEN oi.item_status = 'returned' THEN 1 ELSE 0 END) as returned_items_count,
  SUM(CASE WHEN oi.item_status = 'pending' THEN 1 ELSE 0 END) as pending_items_count,
  
  -- نوع العملية
  CASE
    WHEN o.status = 'partial_delivery' THEN 'partial_delivery'
    WHEN o.status IN ('return_pending', 'return_received') THEN 'replacement'
    WHEN o.status = 'returned' THEN 'full_return'
    WHEN o.status = 'delivered' THEN 'full_delivery'
    ELSE 'in_progress'
  END as operation_type,
  
  -- حالة التسليم بالعربي
  CASE
    WHEN o.status = 'partial_delivery' THEN 'تسليم جزئي'
    WHEN o.status = 'delivered' THEN 'تم التسليم بالكامل'
    WHEN o.status = 'return_pending' THEN 'في انتظار الإرجاع'
    WHEN o.status = 'returned' THEN 'تم الإرجاع'
    WHEN o.status = 'completed' THEN 'مكتمل'
    ELSE 'قيد المعالجة'
  END as delivery_status_text,
  
  -- الأرباح
  p.total_revenue,
  p.total_cost,
  p.profit_amount as system_profit,
  p.employee_profit,
  p.status as profit_status,
  
  -- التواريخ
  o.created_at,
  o.updated_at,
  o.created_by,
  
  -- معلومات إضافية
  o.receipt_received,
  o.receipt_received_at,
  o.delivery_partner_invoice_id

FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN profits p ON o.id = p.order_id
GROUP BY o.id, p.id;

-- تفعيل RLS على الـ VIEW
ALTER VIEW delivery_tracking SET (security_invoker = on);

-- ========================================
-- المرحلة 3: إنشاء جدول partial_delivery_history
-- ========================================

CREATE TABLE IF NOT EXISTS public.partial_delivery_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  delivered_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  undelivered_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  delivered_revenue numeric NOT NULL DEFAULT 0,
  delivered_cost numeric NOT NULL DEFAULT 0,
  employee_profit numeric NOT NULL DEFAULT 0,
  system_profit numeric NOT NULL DEFAULT 0,
  delivery_fee_allocated numeric NOT NULL DEFAULT 0,
  processed_at timestamptz NOT NULL DEFAULT now(),
  processed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE public.partial_delivery_history ENABLE ROW LEVEL SECURITY;

-- Policy للقراءة
CREATE POLICY "المستخدمون يرون سجل التسليم الجزئي"
  ON public.partial_delivery_history
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Policy للإدراج
CREATE POLICY "المستخدمون يسجلون التسليم الجزئي"
  ON public.partial_delivery_history
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ========================================
-- المرحلة 4: تحسين release_stock_item
-- ========================================

CREATE OR REPLACE FUNCTION public.release_stock_item(
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- تحديث المخزون بشكل صحيح
  UPDATE inventory
  SET 
    quantity = GREATEST(0, quantity - p_quantity),
    reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
    -- ✅ الحساب الصحيح: available = (quantity بعد الخصم) - (reserved بعد الخصم)
    available_quantity = GREATEST(0, (quantity - p_quantity) - GREATEST(0, reserved_quantity - p_quantity)),
    updated_at = now()
  WHERE product_id = p_product_id
    AND variant_id = p_variant_id;
    
  RAISE NOTICE 'تم تحرير % من المخزون - المنتج % (variant: %)', 
    p_quantity, p_product_id, p_variant_id;
END;
$function$;