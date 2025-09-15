-- إصلاح مشكلة عدم إنشاء الإيراد تلقائياً للطلبات المسلمة
-- التحقق من الطلب المحدد وإنشاء سجل الربح إن لم يكن موجود

DO $$
DECLARE
  v_order_id UUID := 'f13c79f6-6b07-4d09-ab52-e7ef83cbbb1a';
  v_profit_exists BOOLEAN;
  v_order_record RECORD;
BEGIN
  -- فحص إذا كان سجل الربح موجود
  SELECT EXISTS(SELECT 1 FROM profits WHERE order_id = v_order_id) INTO v_profit_exists;
  
  IF NOT v_profit_exists THEN
    -- الحصول على بيانات الطلب
    SELECT * INTO v_order_record FROM orders WHERE id = v_order_id;
    
    IF v_order_record.id IS NOT NULL THEN
      -- إنشاء سجل الربح باستخدام التريغر
      UPDATE orders 
      SET status = 'delivered', updated_at = now()
      WHERE id = v_order_id;
      
      RAISE NOTICE 'تم إنشاء سجل الربح للطلب %', v_order_record.order_number;
    END IF;
  ELSE
    RAISE NOTICE 'سجل الربح موجود مسبقاً للطلب %', v_order_id;
  END IF;
END $$;