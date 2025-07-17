-- إنشاء trigger لتوليد رمز التليغرام تلقائياً مع كل موظف جديد
CREATE OR REPLACE FUNCTION public.auto_generate_telegram_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    new_code TEXT;
BEGIN
    -- توليد رمز تليغرام للمستخدم الجديد
    IF NEW.status = 'active' THEN
        new_code := public.generate_employee_telegram_code(NEW.user_id);
        
        -- إدراج الكود في جدول رموز التليغرام
        INSERT INTO public.employee_telegram_codes (user_id, telegram_code)
        VALUES (NEW.user_id, new_code)
        ON CONFLICT (user_id) DO UPDATE SET
            telegram_code = EXCLUDED.telegram_code,
            updated_at = now();
    END IF;
    
    RETURN NEW;
END;
$function$;

-- إنشاء trigger يعمل عند إدراج أو تحديث المستخدم
DROP TRIGGER IF EXISTS auto_generate_telegram_code_trigger ON public.profiles;
CREATE TRIGGER auto_generate_telegram_code_trigger
    AFTER INSERT OR UPDATE OF status ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_generate_telegram_code();