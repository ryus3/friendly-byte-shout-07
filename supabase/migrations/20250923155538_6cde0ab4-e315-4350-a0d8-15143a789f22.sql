-- إضافة chat_id لأحمد في employee_telegram_codes (الجدول الأساسي)
UPDATE public.employee_telegram_codes 
SET telegram_chat_id = 1998984107,
    linked_at = now()
WHERE telegram_code = 'AHM435' AND user_id = 'fba59dfc-451c-4906-8882-ae4601ff34d4'::uuid;

-- إنشاء دالة مزامنة تلقائية بين الجدولين
CREATE OR REPLACE FUNCTION public.sync_telegram_employee_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  -- عند تحديث employee_telegram_codes، نحدث telegram_employee_codes
  IF TG_TABLE_NAME = 'employee_telegram_codes' THEN
    INSERT INTO public.telegram_employee_codes (
      user_id, employee_code, is_active, telegram_chat_id, linked_at
    ) VALUES (
      NEW.user_id, NEW.telegram_code, NEW.is_active, NEW.telegram_chat_id, NEW.linked_at
    )
    ON CONFLICT (user_id) DO UPDATE SET
      employee_code = EXCLUDED.employee_code,
      is_active = EXCLUDED.is_active,
      telegram_chat_id = EXCLUDED.telegram_chat_id,
      linked_at = EXCLUDED.linked_at,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- إنشاء المحفز للمزامنة التلقائية
DROP TRIGGER IF EXISTS sync_telegram_data_trigger ON public.employee_telegram_codes;
CREATE TRIGGER sync_telegram_data_trigger
  AFTER INSERT OR UPDATE ON public.employee_telegram_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_telegram_employee_data();