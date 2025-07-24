-- إصلاح جميع الدوال المتبقية لحل الأخطاء الأمنية

-- إصلاح دالة process_telegram_order
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, text, text, text, numeric, jsonb, bigint, text);
CREATE OR REPLACE FUNCTION public.process_telegram_order(p_order_data jsonb, p_customer_name text, p_customer_phone text DEFAULT NULL::text, p_customer_address text DEFAULT NULL::text, p_total_amount numeric DEFAULT 0, p_items jsonb DEFAULT '[]'::jsonb, p_telegram_chat_id bigint DEFAULT NULL::bigint, p_employee_code text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  order_id UUID;
BEGIN
  INSERT INTO public.ai_orders (
    order_data,
    customer_name,
    customer_phone,
    customer_address,
    total_amount,
    items,
    source,
    telegram_chat_id,
    created_by
  ) VALUES (
    p_order_data,
    p_customer_name,
    p_customer_phone,
    p_customer_address,
    p_total_amount,
    p_items,
    'telegram',
    p_telegram_chat_id,
    p_employee_code
  ) RETURNING id INTO order_id;

  INSERT INTO public.notifications (
    title,
    message,
    type,
    priority,
    data,
    user_id
  ) VALUES (
    'طلب ذكي جديد',
    'تم استلام طلب جديد من التليغرام يحتاج للمراجعة',
    'ai_order',
    'high',
    jsonb_build_object('order_id', order_id, 'source', 'telegram'),
    NULL
  );

  RETURN order_id;
END;
$function$;

-- إصلاح دالة link_telegram_user
DROP FUNCTION IF EXISTS public.link_telegram_user(text, bigint);
CREATE OR REPLACE FUNCTION public.link_telegram_user(p_employee_code text, p_telegram_chat_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.employee_telegram_codes 
  SET 
    telegram_chat_id = p_telegram_chat_id,
    linked_at = now(),
    updated_at = now()
  WHERE employee_code = p_employee_code AND is_active = true;
  
  RETURN FOUND;
END;
$function$;

-- إصلاح دالة generate_employee_telegram_code
DROP FUNCTION IF EXISTS public.generate_employee_telegram_code(uuid);
CREATE OR REPLACE FUNCTION public.generate_employee_telegram_code(p_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    user_username TEXT;
    user_full_name TEXT;
    short_code TEXT;
    random_number TEXT;
    employee_code TEXT;
    counter INTEGER := 1;
    final_code TEXT;
BEGIN
    SELECT username, full_name INTO user_username, user_full_name
    FROM public.profiles
    WHERE user_id = p_user_id;
    
    IF user_username IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير موجود';
    END IF;
    
    short_code := UPPER(LEFT(user_username, 3));
    random_number := LPAD((RANDOM() * 999)::INTEGER::TEXT, 3, '0');
    employee_code := short_code || random_number;
    final_code := employee_code;
    
    WHILE EXISTS (SELECT 1 FROM public.employee_telegram_codes WHERE telegram_code = final_code) LOOP
        counter := counter + 1;
        random_number := LPAD((RANDOM() * 999)::INTEGER::TEXT, 3, '0');
        final_code := short_code || random_number;
        
        IF counter > 100 THEN
            final_code := short_code || LPAD((RANDOM() * 9999)::INTEGER::TEXT, 4, '0');
            EXIT;
        END IF;
    END LOOP;
    
    RETURN final_code;
END;
$function$;