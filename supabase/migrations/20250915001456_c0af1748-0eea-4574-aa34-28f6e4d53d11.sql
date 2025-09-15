-- إصلاح المشاكل الموجودة في النظام

-- 1. إصلاح رمز التليغرام للموظف sara ليكون حسب النظام الصحيح
UPDATE public.telegram_employee_codes 
SET employee_code = 'SAR747a0',
    updated_at = now()
WHERE user_id = 'f10d8ed9-24d3-45d6-a310-d45db5a747a0';

-- 2. إصلاح النظام المالي - تعديل الدالة لتعمل مع 'delivered' أيضاً
CREATE OR REPLACE FUNCTION public.record_order_revenue_on_receipt()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  main_cash_id UUID;
  actual_revenue NUMERIC;
BEGIN
  -- عند تحديد أن الفاتورة استُلمت (سواء كان delivered أو completed)
  IF NEW.receipt_received = true AND OLD.receipt_received = false 
     AND NEW.status IN ('delivered', 'completed') THEN
    
    -- الحصول على معرف القاصة الرئيسية
    SELECT id INTO main_cash_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
    
    -- حساب الإيراد الفعلي (بدون رسوم التوصيل)
    actual_revenue := COALESCE(NEW.final_amount, NEW.total_amount, 0) - COALESCE(NEW.delivery_fee, 0);
    
    -- التأكد من عدم وجود معاملة مسبقة لنفس الطلب
    IF NOT EXISTS (
      SELECT 1 FROM financial_transactions 
      WHERE reference_type = 'order_completion' AND reference_id = NEW.id
    ) THEN
      -- تسجيل المعاملة المالية
      INSERT INTO financial_transactions (
        transaction_type,
        reference_type,
        reference_id,
        amount,
        description,
        created_by
      ) VALUES (
        'order_revenue',
        'order_completion',
        NEW.id,
        actual_revenue,
        'إيراد الطلب رقم ' || COALESCE(NEW.order_number, NEW.tracking_number) || ' (بدون رسوم التوصيل)',
        COALESCE(NEW.receipt_received_by, NEW.created_by)
      );
    END IF;
    
    -- إضافة الإيراد للقاصة الرئيسية
    IF main_cash_id IS NOT NULL AND actual_revenue > 0 THEN
      PERFORM public.update_cash_source_balance(
        main_cash_id,
        actual_revenue,
        'in',
        'order_revenue',
        NEW.id,
        'إيراد طلب رقم ' || COALESCE(NEW.order_number, NEW.tracking_number) || ' (بدون رسوم التوصيل)',
        COALESCE(NEW.receipt_received_by, NEW.created_by)
      );
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 3. إصلاح المخزون للطلب 101590092 (إضافة قطعة واحدة مفقودة)
UPDATE inventory 
SET quantity = quantity + 1,
    updated_at = now()
WHERE variant_id = 'c8a0c849-a8d7-4d76-80a7-3866b0f51476'; -- برشلونة ازرق XXL

-- 4. إنشاء حركة نقدية للطلب 101264291 المفقودة
DO $$
DECLARE
  main_cash_id UUID := 'f70cfbb5-343a-4a2d-9e36-489beaf29392';
  order_revenue NUMERIC := 15000;
  order_id UUID := 'f13c79f6-6b07-4d09-ab52-e7ef83cbbb1a';
BEGIN
  -- التأكد من عدم وجود حركة نقدية مسبقة
  IF NOT EXISTS (
    SELECT 1 FROM cash_movements 
    WHERE reference_type = 'order_revenue' AND reference_id = order_id
  ) THEN
    
    -- تسجيل حركة الإيراد في النقد
    INSERT INTO cash_movements (
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
      order_revenue,
      'in',
      'order_revenue',
      order_id,
      'إيراد الطلب رقم ORD000013 (إصلاح حركة مفقودة)',
      5164000 - order_revenue, -- الرصيد قبل الإضافة
      5164000, -- الرصيد الحالي
      'fba59dfc-451c-4906-8882-ae4601ff34d4'::uuid
    );
    
    RAISE NOTICE 'تم إضافة حركة الإيراد المفقودة للطلب ORD000013';
  END IF;
END $$;