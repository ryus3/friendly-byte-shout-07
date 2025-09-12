-- إنشاء جدول لحفظ اختيارات المناطق المعلقة في التليغرام
CREATE TABLE IF NOT EXISTS public.telegram_pending_selections (
  chat_id BIGINT PRIMARY KEY,
  selection_type TEXT NOT NULL DEFAULT 'region',
  options JSONB NOT NULL DEFAULT '[]',
  original_text TEXT,
  city_name TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- إضافة RLS policies
ALTER TABLE public.telegram_pending_selections ENABLE ROW LEVEL SECURITY;

-- السماح للـ edge functions بالوصول
CREATE POLICY "Service role can manage telegram pending selections" 
ON public.telegram_pending_selections 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- تنظيف تلقائي للاختيارات المنتهية الصلاحية
CREATE OR REPLACE FUNCTION public.cleanup_expired_telegram_selections()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.telegram_pending_selections
  WHERE expires_at < now();
END;
$$;

-- إضافة original_text إلى ai_orders إذا لم يكن موجوداً
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_orders' 
    AND column_name = 'original_text'
  ) THEN
    ALTER TABLE public.ai_orders ADD COLUMN original_text TEXT;
  END IF;
END;
$$;