-- ============================================
-- حذف جميع النسخ المتعددة من الدالة
-- ============================================
DROP FUNCTION IF EXISTS public.update_invoice_sync_schedule(boolean, text, text, text);
DROP FUNCTION IF EXISTS public.update_invoice_sync_schedule(boolean, text, time without time zone, time without time zone);
DROP FUNCTION IF EXISTS public.update_invoice_sync_schedule(text, text);

-- ============================================
-- إنشاء نسخة واحدة نظيفة
-- ============================================
CREATE OR REPLACE FUNCTION public.update_invoice_sync_schedule(
  p_morning_time TEXT DEFAULT '09:00',
  p_evening_time TEXT DEFAULT '21:00'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- تحديث جداول الكرون عبر الدالة المركزية
  SELECT public.admin_manage_invoice_cron(
    'update_schedule',
    p_morning_time,
    p_evening_time
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- منح الصلاحيات
GRANT EXECUTE ON FUNCTION public.update_invoice_sync_schedule(TEXT, TEXT) TO authenticated;