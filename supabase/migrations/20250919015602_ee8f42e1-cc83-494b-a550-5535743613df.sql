-- المرحلة 1: إصلاح رموز التليغرام - نقل الرموز الصحيحة إلى الجدول المستخدم من البوت

-- تحديث رمز المدير إلى RYU559
UPDATE public.telegram_employee_codes 
SET employee_code = 'RYU559', updated_at = now()
WHERE user_id = '91484496-b887-44f7-9e5d-be9db5567604'::uuid;

-- تحديث باقي رموز الموظفين من employee_telegram_codes
UPDATE public.telegram_employee_codes 
SET employee_code = 'AHM435', updated_at = now()
WHERE user_id = 'fba59dfc-451c-4906-8882-ae4601ff34d4'::uuid;

UPDATE public.telegram_employee_codes 
SET employee_code = 'SAR042', updated_at = now()
WHERE user_id = 'f10d8ed9-24d3-45d6-a310-d45db5a747a0'::uuid;

UPDATE public.telegram_employee_codes 
SET employee_code = 'ABO165', updated_at = now()
WHERE user_id = 'd46021fe-8cde-4575-97ac-c2661ee91527'::uuid;

-- المرحلة 2: إصلاح منطق تحرير المخزون - إنشاء trigger لتحديث الطلبات المسلمة

-- دالة تحديث حالة الطلب عند التسليم
CREATE OR REPLACE FUNCTION public.auto_update_delivered_order_status()
RETURNS TRIGGER AS $$
BEGIN
  -- عند تحديث delivery_status إلى 4 (تم التسليم للزبون)
  IF NEW.delivery_status = '4' AND (OLD.delivery_status IS NULL OR OLD.delivery_status != '4') THEN
    -- تحديث حالة الطلب إلى delivered لتحرير المخزون
    NEW.status := 'delivered';
    
    -- تسجيل في سجل التحديثات
    RAISE NOTICE 'تم تحديث الطلب % تلقائياً من % إلى delivered بسبب delivery_status = 4', 
      COALESCE(NEW.order_number, NEW.id::text), OLD.status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;