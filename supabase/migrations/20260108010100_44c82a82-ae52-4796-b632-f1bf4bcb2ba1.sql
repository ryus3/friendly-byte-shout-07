-- إصلاح دالة الجدولة لتدعم الدقائق
CREATE OR REPLACE FUNCTION public.update_invoice_sync_schedule(
  p_enabled boolean,
  p_frequency text DEFAULT 'twice_daily',
  p_morning_time time DEFAULT '09:00'::time,
  p_evening_time time DEFAULT '21:00'::time
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  morning_hour integer;
  morning_minute integer;
  evening_hour integer;
  evening_minute integer;
  result jsonb;
BEGIN
  -- ✅ استخراج الساعة والدقيقة معاً
  morning_hour := EXTRACT(HOUR FROM p_morning_time)::integer;
  morning_minute := EXTRACT(MINUTE FROM p_morning_time)::integer;
  evening_hour := EXTRACT(HOUR FROM p_evening_time)::integer;
  evening_minute := EXTRACT(MINUTE FROM p_evening_time)::integer;
  
  -- تعطيل جميع الـ jobs القديمة المتضاربة
  UPDATE cron.job SET active = false
  WHERE jobname IN (
    'auto-sync-invoices-morning',
    'auto-sync-invoices-evening',
    'invoices-daily-sync',
    'daily-alwaseet-sync'
  );
  
  IF p_enabled THEN
    -- تفعيل الـ jobs الذكية
    IF p_frequency = 'twice_daily' THEN
      -- ✅ تحديث morning job مع الدقائق
      UPDATE cron.job 
      SET schedule = format('%s %s * * *', morning_minute, morning_hour), active = true
      WHERE jobname = 'smart-invoice-sync-morning';
      
      -- ✅ تحديث evening job مع الدقائق
      UPDATE cron.job 
      SET schedule = format('%s %s * * *', evening_minute, evening_hour), active = true
      WHERE jobname = 'smart-invoice-sync-evening';
    ELSE
      -- مرة واحدة يومياً (morning فقط)
      UPDATE cron.job 
      SET schedule = format('%s %s * * *', morning_minute, morning_hour), active = true
      WHERE jobname = 'smart-invoice-sync-morning';
      
      UPDATE cron.job SET active = false
      WHERE jobname = 'smart-invoice-sync-evening';
    END IF;
  ELSE
    -- تعطيل الكل
    UPDATE cron.job SET active = false
    WHERE jobname LIKE 'smart-invoice-sync%';
  END IF;
  
  -- تحديث إعدادات invoice_sync_settings
  INSERT INTO invoice_sync_settings (
    id, 
    daily_sync_enabled, 
    sync_frequency, 
    morning_sync_time, 
    evening_sync_time,
    updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000001',
    p_enabled,
    p_frequency,
    p_morning_time::text,
    p_evening_time::text,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    daily_sync_enabled = EXCLUDED.daily_sync_enabled,
    sync_frequency = EXCLUDED.sync_frequency,
    morning_sync_time = EXCLUDED.morning_sync_time,
    evening_sync_time = EXCLUDED.evening_sync_time,
    updated_at = NOW();
  
  result := jsonb_build_object(
    'success', true,
    'enabled', p_enabled,
    'frequency', p_frequency,
    'morning_time', p_morning_time::text,
    'evening_time', p_evening_time::text,
    'morning_schedule', format('%s %s * * *', morning_minute, morning_hour),
    'evening_schedule', format('%s %s * * *', evening_minute, evening_hour)
  );
  
  RETURN result;
END;
$$;