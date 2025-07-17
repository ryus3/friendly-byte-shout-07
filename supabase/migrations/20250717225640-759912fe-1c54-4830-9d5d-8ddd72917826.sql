-- إضافة مفتاح خارجي مفقود لجدول telegram_employee_codes
ALTER TABLE public.telegram_employee_codes 
ADD CONSTRAINT telegram_employee_codes_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;