-- إضافة حركات نقدية للأرباح المحققة وإصلاح النظام
DO $$
DECLARE
  main_cash_id UUID;
  profit_record RECORD;
  total_realized_profits NUMERIC := 0;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_id FROM public.cash_sources WHERE name = 'القاصة الرئيسية';
  
  -- حذف أي حركات أرباح مكررة
  DELETE FROM public.cash_movements 
  WHERE cash_source_id = main_cash_id 
  AND reference_type = 'realized_profit';
  
  -- إضافة حركات نقدية للأرباح المحققة
  FOR profit_record IN 
    SELECT 
      p.id,
      p.order_id,
      o.order_number,
      p.profit_amount - p.employee_profit as manager_profit,
      p.status,
      p.created_at
    FROM public.profits p
    JOIN public.orders o ON p.order_id = o.id
    WHERE o.status = 'completed' 
    AND o.receipt_received = true
    AND p.status = 'invoice_received'
  LOOP
    -- إضافة حركة نقدية للربح المحقق
    INSERT INTO public.cash_movements (
      cash_source_id,
      amount,
      movement_type,
      reference_type,
      reference_id,
      description,
      balance_before,
      balance_after,
      created_by
    ) VALUES (
      main_cash_id,
      profit_record.manager_profit,
      'in',
      'realized_profit',
      profit_record.order_id,
      'ربح محقق من طلب ' || profit_record.order_number,
      0, -- سيتم تحديثه
      0, -- سيتم تحديثه
      '91484496-b887-44f7-9e5d-be9db5567604'::uuid
    );
    
    total_realized_profits := total_realized_profits + profit_record.manager_profit;
    
    RAISE NOTICE 'تم إضافة ربح محقق: % للطلب %', profit_record.manager_profit, profit_record.order_number;
  END LOOP;
  
  -- تحديث الرصيد الأرصدة في حركات النقد
  UPDATE public.cash_movements 
  SET 
    balance_before = 5000000,
    balance_after = 5000000 + amount
  WHERE cash_source_id = main_cash_id 
  AND reference_type = 'realized_profit';
  
  -- تحديث رصيد القاصة الرئيسية ليشمل الأرباح
  UPDATE public.cash_sources 
  SET current_balance = 5000000 + total_realized_profits,
      updated_at = now()
  WHERE id = main_cash_id;
  
  RAISE NOTICE 'تم تحديث النظام: رأس المال=5000000, أرباح محققة=%, الرصيد الإجمالي=%', 
               total_realized_profits, (5000000 + total_realized_profits);
END $$;