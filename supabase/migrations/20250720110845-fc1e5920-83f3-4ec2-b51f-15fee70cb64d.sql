-- إعادة تفعيل النظام المالي الكامل مع جميع التريجرز والحماية

-- 1. إعادة تفعيل trigger حساب الأرباح عند استلام الفاتورة
DROP TRIGGER IF EXISTS trigger_calculate_profit_on_receipt ON public.orders;
CREATE TRIGGER trigger_calculate_profit_on_receipt
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (OLD.receipt_received IS DISTINCT FROM NEW.receipt_received AND NEW.receipt_received = true)
  EXECUTE FUNCTION public.trigger_calculate_profit_on_receipt();

-- 2. إعادة تفعيل trigger تدفق النقد للطلبات
DROP TRIGGER IF EXISTS handle_order_cash_flow_trigger ON public.orders;
CREATE TRIGGER handle_order_cash_flow_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_cash_flow();

-- 3. إعادة تفعيل trigger تدفق النقد للمشتريات  
DROP TRIGGER IF EXISTS handle_purchase_cash_flow_trigger ON public.purchases;
CREATE TRIGGER handle_purchase_cash_flow_trigger
  AFTER INSERT OR UPDATE ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_purchase_cash_flow();

-- 4. إعادة تفعيل trigger معالجة المصاريف
DROP TRIGGER IF EXISTS process_expense_cash_movement_trigger ON public.expenses;
CREATE TRIGGER process_expense_cash_movement_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.process_expense_cash_movement();

-- 5. إعادة تفعيل trigger توليد رقم الطلب
DROP TRIGGER IF EXISTS set_order_number_trigger ON public.orders;
CREATE TRIGGER set_order_number_trigger
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
  EXECUTE FUNCTION public.generate_order_number();

-- 6. إعادة تفعيل trigger توليد رقم المشتريات
DROP TRIGGER IF EXISTS auto_generate_purchase_number_trigger ON public.purchases;
CREATE TRIGGER auto_generate_purchase_number_trigger
  BEFORE INSERT ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_purchase_number();

-- 7. إعادة تفعيل trigger توليد باركود المنتجات
DROP TRIGGER IF EXISTS auto_generate_product_barcode_trigger ON public.products;
CREATE TRIGGER auto_generate_product_barcode_trigger
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_product_barcode();

-- 8. إعادة تفعيل trigger توليد باركود المتغيرات
DROP TRIGGER IF EXISTS auto_generate_variant_barcode_trigger ON public.product_variants;
CREATE TRIGGER auto_generate_variant_barcode_trigger
  BEFORE INSERT ON public.product_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_variant_barcode();

-- 9. إضافة دالة التحقق من صحة النظام المالي
CREATE OR REPLACE FUNCTION public.validate_financial_integrity()
RETURNS TABLE(
  check_name text,
  status text,
  details text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- فحص تطابق رصيد القاصة مع الحركات
  RETURN QUERY
  SELECT 
    'رصيد القاصة الرئيسية'::text as check_name,
    CASE 
      WHEN cs.current_balance = (cs.initial_balance + COALESCE(movements.total, 0))
      THEN 'صحيح'::text 
      ELSE 'خطأ'::text 
    END as status,
    'الرصيد: ' || cs.current_balance || ', المفترض: ' || (cs.initial_balance + COALESCE(movements.total, 0))::text as details
  FROM public.cash_sources cs
  LEFT JOIN (
    SELECT 
      cash_source_id,
      SUM(CASE 
        WHEN movement_type = 'in' THEN amount 
        WHEN movement_type = 'out' THEN -amount 
        ELSE 0 
      END) as total
    FROM public.cash_movements 
    GROUP BY cash_source_id
  ) movements ON cs.id = movements.cash_source_id
  WHERE cs.name = 'القاصة الرئيسية';

  -- فحص الأرباح غير المحسوبة
  RETURN QUERY
  SELECT 
    'الطلبات المستلمة بدون أرباح'::text as check_name,
    CASE 
      WHEN COUNT(*) = 0 THEN 'صحيح'::text 
      ELSE 'يحتاج مراجعة'::text 
    END as status,
    'عدد الطلبات: ' || COUNT(*)::text as details
  FROM public.orders o
  LEFT JOIN public.profits p ON o.id = p.order_id
  WHERE o.receipt_received = true 
    AND p.order_id IS NULL;

  -- فحص التريجرز المفعلة
  RETURN QUERY
  SELECT 
    'التريجرز المفعلة'::text as check_name,
    CASE 
      WHEN COUNT(*) >= 5 THEN 'صحيح'::text 
      ELSE 'ناقص'::text 
    END as status,
    'عدد التريجرز: ' || COUNT(*)::text as details
  FROM information_schema.triggers 
  WHERE trigger_schema = 'public';
END;
$$;

-- 10. إضافة دالة إعادة حساب الأرباح للطلبات المستلمة
CREATE OR REPLACE FUNCTION public.recalculate_all_received_orders()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  order_record RECORD;
  processed_count INTEGER := 0;
BEGIN
  -- معالجة جميع الطلبات المستلمة التي لا تحتوي على أرباح
  FOR order_record IN 
    SELECT o.id, o.order_number
    FROM public.orders o
    LEFT JOIN public.profits p ON o.id = p.order_id
    WHERE o.receipt_received = true 
      AND p.order_id IS NULL
  LOOP
    -- حساب الأرباح للطلب
    PERFORM public.calculate_order_profit_fixed_amounts(order_record.id);
    processed_count := processed_count + 1;
  END LOOP;
  
  RETURN 'تم معالجة ' || processed_count || ' طلب';
END;
$$;

-- 11. إنشاء فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_orders_receipt_received ON public.orders (receipt_received) WHERE receipt_received = true;
CREATE INDEX IF NOT EXISTS idx_profits_status ON public.profits (status);
CREATE INDEX IF NOT EXISTS idx_cash_movements_source_type ON public.cash_movements (cash_source_id, movement_type);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON public.orders (created_by);

-- 12. إضافة قيود الحماية
ALTER TABLE public.cash_movements 
ADD CONSTRAINT check_movement_amount_positive 
CHECK (amount > 0);

ALTER TABLE public.profits 
ADD CONSTRAINT check_profit_amounts_logical 
CHECK (total_revenue >= 0 AND total_cost >= 0 AND profit_amount = (total_revenue - total_cost));

-- 13. إنشاء جدول سجل المراجعة المالية
CREATE TABLE IF NOT EXISTS public.financial_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operation_type TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  user_id UUID,
  operation_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  description TEXT
);

-- إضافة RLS للمراجعة المالية
ALTER TABLE public.financial_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "المديرون يديرون سجل المراجعة المالية"
ON public.financial_audit_log
FOR ALL
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());

-- 14. تشغيل التحقق من سلامة النظام
SELECT * FROM public.validate_financial_integrity();