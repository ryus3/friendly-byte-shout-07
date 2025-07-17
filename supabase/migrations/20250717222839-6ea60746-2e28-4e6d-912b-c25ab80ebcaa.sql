-- إنشاء دالة محدثة لتوليد رموز التليغرام بأحرف إنجليزية فقط
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
    -- الحصول على بيانات المستخدم
    SELECT username, full_name INTO user_username, user_full_name
    FROM public.profiles
    WHERE user_id = p_user_id;
    
    IF user_username IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير موجود';
    END IF;
    
    -- تحويل النص للأحرف الإنجليزية (أول 3 أحرف من اسم المستخدم)
    short_code := UPPER(LEFT(user_username, 3));
    
    -- توليد رقم عشوائي من 3 أرقام
    random_number := LPAD((RANDOM() * 999)::INTEGER::TEXT, 3, '0');
    
    -- إنشاء الكود الأساسي
    employee_code := short_code || random_number;
    final_code := employee_code;
    
    -- التأكد من عدم تكرار الكود
    WHILE EXISTS (SELECT 1 FROM public.employee_telegram_codes WHERE telegram_code = final_code) LOOP
        counter := counter + 1;
        random_number := LPAD((RANDOM() * 999)::INTEGER::TEXT, 3, '0');
        final_code := short_code || random_number;
        
        -- منع اللوب اللانهائي
        IF counter > 100 THEN
            -- إضافة رقم إضافي إذا فشلت المحاولات
            final_code := short_code || LPAD((RANDOM() * 9999)::INTEGER::TEXT, 4, '0');
            EXIT;
        END IF;
    END LOOP;
    
    -- إدراج أو تحديث الكود
    INSERT INTO public.employee_telegram_codes (user_id, telegram_code)
    VALUES (p_user_id, final_code)
    ON CONFLICT (user_id) DO UPDATE SET
        telegram_code = EXCLUDED.telegram_code,
        updated_at = now();
    
    RETURN final_code;
END;
$function$;

-- تحديث الأكواد الحالية للأحرف الإنجليزية
UPDATE employee_telegram_codes 
SET telegram_code = public.generate_employee_telegram_code(user_id)
WHERE user_id IS NOT NULL;