-- تحديث دالة إضافة ربح المدير للقاصة الرئيسية لتحسب الربح الصافي فقط
CREATE OR REPLACE FUNCTION public.add_manager_profit_to_main_cash()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  main_cash_source_id uuid;
  net_order_profit numeric;
  order_record RECORD;
BEGIN
  -- فقط عند تغيير receipt_received إلى true
  IF OLD.receipt_received IS DISTINCT FROM NEW.receipt_received 
     AND NEW.receipt_received = true THEN
    
    -- الحصول على معرف القاصة الرئيسية
    SELECT id INTO main_cash_source_id 
    FROM public.cash_sources 
    WHERE name = 'القاصة الرئيسية' AND is_active = true;
    
    IF main_cash_source_id IS NULL THEN
      RAISE WARNING 'القاصة الرئيسية غير موجودة';
      RETURN NEW;
    END IF;
    
    -- حساب صافي ربح الطلب (سعر البيع - تكلفة المنتج) بدون طرح المصاريف العامة
    SELECT COALESCE(SUM(
      (oi.unit_price * oi.quantity) - 
      (COALESCE(pv.cost_price, p.cost_price, 0) * oi.quantity)
    ), 0) INTO net_order_profit
    FROM public.order_items oi
    LEFT JOIN public.products p ON oi.product_id = p.id
    LEFT JOIN public.product_variants pv ON oi.variant_id = pv.id
    WHERE oi.order_id = NEW.id;
    
    -- إضافة الربح الصافي للقاصة الرئيسية إذا كان موجوداً
    IF net_order_profit > 0 THEN
      PERFORM public.update_cash_source_balance(
        main_cash_source_id,
        net_order_profit,
        'in',
        'realized_profit',
        NEW.id,
        'ربح صافي محقق من الطلب رقم ' || NEW.order_number,
        NEW.created_by
      );
      
      RAISE NOTICE 'تم إضافة الربح الصافي % للقاصة الرئيسية للطلب %', net_order_profit, NEW.order_number;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;