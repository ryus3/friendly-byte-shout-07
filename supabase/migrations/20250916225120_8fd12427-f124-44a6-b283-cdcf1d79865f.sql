-- حذف الدوال المكررة المتبقية من process_telegram_order
-- الاحتفاظ فقط بالدالة الصحيحة ذات الـ 3 معاملات

-- حذف الدالة ذات الـ 8 معاملات
DROP FUNCTION IF EXISTS public.process_telegram_order(
  p_order_data jsonb,
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_total_amount numeric,
  p_items jsonb,
  p_telegram_chat_id bigint,
  p_employee_code text
);

-- حذف الدالة ذات الـ 10 معاملات
DROP FUNCTION IF EXISTS public.process_telegram_order(
  p_order_data jsonb,
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_total_amount numeric,
  p_items jsonb,
  p_telegram_chat_id bigint,
  p_employee_code text,
  p_city_id integer,
  p_region_id integer
);