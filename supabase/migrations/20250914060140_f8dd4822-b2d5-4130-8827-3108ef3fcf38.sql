-- إصلاح النظام المالي ورموز التليغرام

-- 1. إنشاء رمز تليغرام للموظف sara
INSERT INTO public.telegram_employee_codes (user_id, employee_code, is_active)
SELECT 
    'f10d8ed9-24d3-45d6-a310-d45db5a747a0'::uuid,
    'EMP003',
    true
WHERE NOT EXISTS (
    SELECT 1 FROM public.telegram_employee_codes 
    WHERE user_id = 'f10d8ed9-24d3-45d6-a310-d45db5a747a0'::uuid
);

-- 2. تسجيل الإيراد المفقود للطلب 101264291
DO $$
DECLARE
  v_order_id UUID := 'f13c79f6-6b07-4d09-ab52-e7ef83cbbb1a';
  v_order_record RECORD;
  main_cash_source_id UUID;
  v_revenue_amount NUMERIC;
BEGIN
  -- الحصول على بيانات الطلب
  SELECT * INTO v_order_record 
  FROM orders 
  WHERE id = v_order_id AND receipt_received = true;
  
  IF v_order_record.id IS NOT NULL THEN
    -- حساب الإيراد المتوقع (المبلغ النهائي - رسوم التوصيل)
    v_revenue_amount := v_order_record.final_amount - COALESCE(v_order_record.delivery_fee, 0);
    
    -- التحقق من عدم وجود معاملة مالية مسبقة لهذا الطلب
    IF NOT EXISTS (
      SELECT 1 FROM financial_transactions 
      WHERE reference_type = 'order_completion' 
      AND reference_id = v_order_id
    ) THEN
      
      -- الحصول على القاصة الرئيسية
      SELECT id INTO main_cash_source_id
      FROM cash_sources 
      WHERE name = 'القاصة الرئيسية' AND is_active = true
      LIMIT 1;
      
      IF main_cash_source_id IS NOT NULL THEN
        -- تسجيل معاملة الإيراد (15,000)
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
          v_order_id,
          v_revenue_amount,
          'إيراد الطلب رقم ' || COALESCE(v_order_record.order_number, v_order_record.tracking_number) || ' - إصلاح إيراد مفقود',
          v_order_record.created_by
        );
        
        -- تحديث رصيد القاصة بإضافة الإيراد
        UPDATE cash_sources 
        SET current_balance = current_balance + v_revenue_amount,
            updated_at = now()
        WHERE id = main_cash_source_id;
        
        RAISE NOTICE 'تم تسجيل إيراد الطلب % بمبلغ % دينار', v_order_record.tracking_number, v_revenue_amount;
      END IF;
    ELSE
      RAISE NOTICE 'الطلب % لديه معاملة مالية مسجلة مسبقاً', v_order_record.tracking_number;
    END IF;
  ELSE
    RAISE NOTICE 'الطلب غير موجود أو لم يتم استلام فاتورته';
  END IF;
END $$;