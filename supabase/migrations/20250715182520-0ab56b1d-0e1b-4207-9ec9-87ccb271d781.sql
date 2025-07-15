-- حذف القيد الخاطئ إذا كان موجوداً
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'ai_orders_processed_by_fkey' 
               AND table_name = 'ai_orders') THEN
        ALTER TABLE public.ai_orders DROP CONSTRAINT ai_orders_processed_by_fkey;
    END IF;
END $$;

-- إضافة القيد الصحيح
ALTER TABLE public.ai_orders 
ADD CONSTRAINT ai_orders_processed_by_fkey 
FOREIGN KEY (processed_by) REFERENCES public.profiles(user_id);