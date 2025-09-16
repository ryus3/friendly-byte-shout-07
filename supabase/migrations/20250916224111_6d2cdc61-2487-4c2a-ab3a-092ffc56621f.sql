-- حذف جميع دوال process_telegram_order المكررة والاحتفاظ فقط بالدالة الصحيحة ذات الـ 3 معاملات

-- حذف الدالة ذات الـ 12 معامل (الأقدم)
DROP FUNCTION IF EXISTS public.process_telegram_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_customer_city text,
  p_customer_province text,
  p_total_amount numeric,
  p_items jsonb,
  p_telegram_chat_id bigint,
  p_city_id integer,
  p_region_id integer,
  p_employee_code text,
  p_source text
);

-- حذف الدالة ذات الـ 11 معامل 
DROP FUNCTION IF EXISTS public.process_telegram_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_customer_city text,
  p_customer_province text,
  p_total_amount numeric,
  p_items jsonb,
  p_telegram_chat_id bigint,
  p_city_id integer,
  p_region_id integer,
  p_employee_code text
);

-- حذف الدالة ذات الـ 10 معاملات
DROP FUNCTION IF EXISTS public.process_telegram_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_customer_city text,
  p_customer_province text,
  p_total_amount numeric,
  p_items jsonb,
  p_telegram_chat_id bigint,
  p_city_id integer,
  p_region_id integer
);

-- إصلاح ai_orders التي لديها created_by = null بربطها بالموظف الصحيح
UPDATE public.ai_orders 
SET created_by = (
  SELECT tec.user_id 
  FROM public.telegram_employee_codes tec 
  WHERE tec.telegram_chat_id = ai_orders.telegram_chat_id 
    AND tec.is_active = true
  LIMIT 1
)
WHERE created_by IS NULL 
  AND telegram_chat_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.telegram_employee_codes tec 
    WHERE tec.telegram_chat_id = ai_orders.telegram_chat_id 
      AND tec.is_active = true
  );

RAISE NOTICE 'تم حذف الدوال المكررة وإصلاح البيانات الموجودة';