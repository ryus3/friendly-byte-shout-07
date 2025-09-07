-- الحل الجذري: إصلاح نظام الفواتير المحلية وتدفق الحالات

-- 1. تعديل trigger استلام الفواتير للسماح بالطلبات المحلية
CREATE OR REPLACE FUNCTION public.handle_receipt_received_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- When invoice receipt toggles true
  IF NEW.receipt_received = true AND COALESCE(OLD.receipt_received, false) = false THEN
    -- للطلبات المحلية: إنشاء رقم فاتورة داخلي تلقائي
    IF LOWER(COALESCE(NEW.delivery_partner, '')) IN ('محلي', 'local', '') OR NEW.delivery_partner IS NULL THEN
      -- إنشاء رقم فاتورة داخلي إذا لم يكن موجوداً
      IF NEW.delivery_partner_invoice_id IS NULL OR TRIM(NEW.delivery_partner_invoice_id) = '' THEN
        NEW.delivery_partner_invoice_id := 'LOCAL-' || COALESCE(NEW.order_number, NEW.id::text);
      END IF;
    ELSE
      -- للطلبات الخارجية: التحقق من وجود رقم فاتورة فعلي
      IF NEW.delivery_partner_invoice_id IS NULL OR TRIM(NEW.delivery_partner_invoice_id) = '' THEN
        RAISE WARNING 'محاولة تعيين receipt_received = true بدون رقم فاتورة للطلب %', COALESCE(NEW.order_number, NEW.id::text);
        NEW.receipt_received := false;
        RETURN NEW;
      END IF;
    END IF;

    -- Stamp metadata if missing
    IF NEW.receipt_received_at IS NULL THEN
      NEW.receipt_received_at := now();
    END IF;
    IF NEW.receipt_received_by IS NULL THEN
      NEW.receipt_received_by := COALESCE(auth.uid(), NEW.created_by);
    END IF;

    -- للطلبات المحلية: البقاء في حالة delivered حتى يتم دفع المستحقات
    -- فقط طلبات المدير تنتقل مباشرة إلى completed
    IF NEW.created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid THEN
      IF NEW.status = 'delivered' THEN
        NEW.status := 'completed';
        RAISE NOTICE 'تم تحويل طلب المدير % من delivered إلى completed عند استلام الفاتورة %', 
                     COALESCE(NEW.order_number, NEW.id::text), NEW.delivery_partner_invoice_id;
      END IF;
    END IF;
  END IF;

  -- When invoice receipt is set to false, clear the timestamp and related data
  IF NEW.receipt_received = false AND COALESCE(OLD.receipt_received, false) = true THEN
    NEW.receipt_received_at := NULL;
    NEW.receipt_received_by := NULL;
    -- Clear invoice ID when receipt is marked as not received
    NEW.delivery_partner_invoice_id := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. إنشاء trigger لحساب الأرباح تلقائياً عند استلام الفاتورة
CREATE OR REPLACE FUNCTION public.auto_calculate_profit_on_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  employee_profit_amount NUMERIC := 0;
  manager_profit_amount NUMERIC := 0;
  total_profit_amount NUMERIC := 0;
  order_item RECORD;
  profit_rule RECORD;
  existing_profit_id UUID;
BEGIN
  -- فقط عند تغيير receipt_received إلى true
  IF NEW.receipt_received = true AND COALESCE(OLD.receipt_received, false) = false THEN
    
    -- التحقق من وجود سجل أرباح موجود
    SELECT id INTO existing_profit_id
    FROM public.profits 
    WHERE order_id = NEW.id;
    
    -- إذا كان هناك سجل موجود، لا نفعل شيئاً
    IF existing_profit_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    
    -- حساب أرباح كل منتج في الطلب
    FOR order_item IN 
      SELECT oi.product_id, oi.variant_id, oi.quantity, oi.unit_price, oi.total_price,
             p.name as product_name
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = NEW.id
    LOOP
      -- البحث عن قاعدة ربح مطابقة
      SELECT * INTO profit_rule
      FROM employee_profit_rules epr
      WHERE epr.employee_id = NEW.created_by
        AND (
          (epr.rule_type = 'product_specific' AND epr.product_id = order_item.product_id)
          OR (epr.rule_type = 'category_based' AND epr.category_id IN (
            SELECT pc.category_id FROM product_categories pc WHERE pc.product_id = order_item.product_id
          ))
          OR epr.rule_type = 'default'
        )
        AND epr.is_active = true
      ORDER BY 
        CASE epr.rule_type
          WHEN 'product_specific' THEN 1
          WHEN 'category_based' THEN 2
          WHEN 'default' THEN 3
        END
      LIMIT 1;
      
      -- إذا وجدت قاعدة، احسب الربح
      IF profit_rule IS NOT NULL THEN
        IF profit_rule.calculation_type = 'percentage' THEN
          employee_profit_amount := employee_profit_amount + 
            (order_item.total_price * profit_rule.percentage_value / 100);
        ELSIF profit_rule.calculation_type = 'fixed_amount' THEN
          employee_profit_amount := employee_profit_amount + 
            (profit_rule.fixed_amount * order_item.quantity);
        END IF;
      END IF;
    END LOOP;
    
    -- حساب إجمالي الربح (مبسط - الإيرادات ناقص التكاليف)
    total_profit_amount := NEW.final_amount; -- يمكن تحسينه لاحقاً بطرح التكاليف الفعلية
    manager_profit_amount := total_profit_amount - employee_profit_amount;
    
    -- إنشاء سجل الأرباح
    INSERT INTO public.profits (
      order_id,
      employee_id,
      total_revenue,
      total_cost,
      profit_amount,
      employee_percentage,
      employee_profit,
      status
    ) VALUES (
      NEW.id,
      NEW.created_by,
      NEW.final_amount,
      0, -- يمكن تحسينه لاحقاً
      total_profit_amount,
      CASE WHEN total_profit_amount > 0 THEN (employee_profit_amount / total_profit_amount * 100) ELSE 0 END,
      employee_profit_amount,
      'pending'
    );
    
    RAISE NOTICE 'تم إنشاء سجل أرباح للطلب %: ربح الموظف = %, إجمالي الربح = %', 
                 NEW.order_number, employee_profit_amount, total_profit_amount;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- إنشاء trigger جديد
DROP TRIGGER IF EXISTS auto_calculate_profit_on_receipt ON orders;
CREATE TRIGGER auto_calculate_profit_on_receipt
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_profit_on_receipt();

-- 3. إصلاح الطلب RYUS-299923
UPDATE public.orders 
SET 
  status = 'delivered',
  delivery_partner_invoice_id = 'LOCAL-RYUS-299923',
  receipt_received = false,
  receipt_received_at = NULL,
  receipt_received_by = NULL,
  updated_at = now()
WHERE order_number = 'RYUS-299923';

-- حذف سجل الأرباح الخاطئ إن وجد
DELETE FROM public.profits 
WHERE order_id = (SELECT id FROM public.orders WHERE order_number = 'RYUS-299923');

RAISE NOTICE 'تم إصلاح الطلب RYUS-299923 وإعادته إلى حالة delivered';