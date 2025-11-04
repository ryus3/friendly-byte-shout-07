-- نظام طرح المنتجات المباعة من المخزون تلقائياً
-- يُطبق فقط عند التحول إلى delivered (حالة 4)

-- إنشاء جدول لتتبع المنتجات المباعة (sold products)
CREATE TABLE IF NOT EXISTS public.sold_products_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  variant_id UUID NOT NULL,
  quantity INTEGER NOT NULL,
  sold_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- تفعيل RLS
ALTER TABLE public.sold_products_log ENABLE ROW LEVEL SECURITY;

-- سياسة عرض سجل المبيعات
CREATE POLICY "المستخدمون المصرح لهم يرون سجل المبيعات"
ON public.sold_products_log
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- سياسة إدراج سجل المبيعات
CREATE POLICY "النظام يسجل المبيعات"
ON public.sold_products_log
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- دالة لطرح المباع من المخزون عند التحول إلى delivered
CREATE OR REPLACE FUNCTION process_delivered_order_inventory()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  current_quantity INTEGER;
BEGIN
  -- التحقق من التحول من أي حالة إلى delivered
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    
    -- معالجة كل عنصر في الطلب
    FOR item IN 
      SELECT oi.variant_id, oi.quantity, oi.item_direction
      FROM order_items oi
      WHERE oi.order_id = NEW.id
      AND oi.item_direction != 'incoming' -- استبعاد المنتجات الواردة
    LOOP
      -- الحصول على الكمية الحالية
      SELECT quantity INTO current_quantity
      FROM product_variants
      WHERE id = item.variant_id;
      
      -- طرح الكمية المباعة من المخزون (فقط إذا كانت الكمية كافية)
      IF current_quantity >= item.quantity THEN
        UPDATE product_variants
        SET 
          quantity = quantity - item.quantity,
          updated_at = NOW()
        WHERE id = item.variant_id;
        
        -- تسجيل المبيعات في الجدول
        INSERT INTO sold_products_log (order_id, variant_id, quantity)
        VALUES (NEW.id, item.variant_id, item.quantity);
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء trigger لتطبيق الدالة
DROP TRIGGER IF EXISTS trigger_process_delivered_inventory ON orders;
CREATE TRIGGER trigger_process_delivered_inventory
AFTER UPDATE ON orders
FOR EACH ROW
WHEN (NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered'))
EXECUTE FUNCTION process_delivered_order_inventory();

-- إنشاء index لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_sold_products_order_id ON sold_products_log(order_id);
CREATE INDEX IF NOT EXISTS idx_sold_products_variant_id ON sold_products_log(variant_id);

COMMENT ON TABLE sold_products_log IS 'سجل المنتجات المباعة - يُحدث تلقائياً عند تحول الطلب إلى delivered';
COMMENT ON FUNCTION process_delivered_order_inventory IS 'دالة تلقائية لطرح المباع من المخزون عند التسليم';