-- ========================================
-- المرحلة 2 - الخطوة 1: Trigger لخصم المخزون عند حالة 21
-- ========================================

CREATE OR REPLACE FUNCTION public.debit_replacement_outgoing_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  item_record RECORD;
  ai_order_record RECORD;
BEGIN
  -- عندما يتغير delivery_status إلى 21 (تم التسليم للزبون واستلام الإرجاع منه)
  IF NEW.delivery_status = '21' AND (OLD.delivery_status IS NULL OR OLD.delivery_status != '21') THEN
    
    -- البحث عن الطلب في ai_orders للتحقق من نوع الطلب
    SELECT * INTO ai_order_record
    FROM ai_orders
    WHERE id = NEW.id
      AND order_type = 'replacement';
    
    -- إذا كان هذا طلب استبدال
    IF ai_order_record.id IS NOT NULL THEN
      
      -- خصم المنتجات الصادرة (الجديدة) من المخزون
      FOR item_record IN 
        SELECT * FROM order_items 
        WHERE order_id = NEW.id
      LOOP
        -- خصم من المخزون (sold)
        PERFORM release_stock_item(
          item_record.product_id,
          item_record.variant_id,
          item_record.quantity
        );
        
        -- تحديث حالة المنتج
        UPDATE order_items
        SET 
          item_status = 'delivered',
          quantity_delivered = quantity,
          delivered_at = now()
        WHERE id = item_record.id;
        
        RAISE NOTICE 'تم خصم منتج استبدال: % (الكمية: %)', 
          item_record.product_id, item_record.quantity;
      END LOOP;
      
      -- تسجيل في سجل الاستبدال
      INSERT INTO replacement_history (
        outgoing_order_id,
        incoming_order_id,
        original_order_id,
        replacement_pair_id,
        outgoing_items,
        status_21_at,
        processed_by
      )
      VALUES (
        NEW.id,
        ai_order_record.related_order_id,
        ai_order_record.original_order_id,
        ai_order_record.replacement_pair_id,
        (SELECT jsonb_agg(
          jsonb_build_object(
            'product_id', product_id,
            'variant_id', variant_id,
            'quantity', quantity,
            'unit_price', unit_price
          )
        ) FROM order_items WHERE order_id = NEW.id),
        now(),
        NEW.created_by
      )
      ON CONFLICT (outgoing_order_id) DO UPDATE SET
        status_21_at = now(),
        processed_by = NEW.created_by;
      
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- إنشاء Trigger
DROP TRIGGER IF EXISTS trigger_debit_replacement_outgoing ON orders;
CREATE TRIGGER trigger_debit_replacement_outgoing
  AFTER UPDATE OF delivery_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION debit_replacement_outgoing_items();

-- ========================================
-- المرحلة 2 - الخطوة 3: جدول replacement_history
-- ========================================

CREATE TABLE IF NOT EXISTS public.replacement_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  outgoing_order_id uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  incoming_order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  original_order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  replacement_pair_id uuid,
  
  -- المنتجات
  outgoing_items jsonb NOT NULL,
  incoming_items jsonb,
  
  -- التفاصيل المالية
  price_difference numeric NOT NULL DEFAULT 0,
  delivery_fee numeric NOT NULL DEFAULT 0,
  employee_profit_adjusted numeric NOT NULL DEFAULT 0,
  system_profit_adjusted numeric NOT NULL DEFAULT 0,
  
  -- التتبع
  status_21_at timestamptz,
  status_17_at timestamptz,
  processed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.replacement_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "المستخدمون يرون سجل الاستبدال"
  ON public.replacement_history
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "المستخدمون يديرون سجل الاستبدال"
  ON public.replacement_history
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Index للأداء
CREATE INDEX IF NOT EXISTS idx_replacement_history_outgoing ON replacement_history(outgoing_order_id);
CREATE INDEX IF NOT EXISTS idx_replacement_history_incoming ON replacement_history(incoming_order_id);
CREATE INDEX IF NOT EXISTS idx_replacement_history_original ON replacement_history(original_order_id);
CREATE INDEX IF NOT EXISTS idx_replacement_history_pair ON replacement_history(replacement_pair_id);

-- Trigger لتحديث updated_at
CREATE TRIGGER set_replacement_history_updated_at
  BEFORE UPDATE ON replacement_history
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();