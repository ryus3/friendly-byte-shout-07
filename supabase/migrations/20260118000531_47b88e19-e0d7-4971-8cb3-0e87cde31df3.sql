-- 1) حذف الصف المكرر (إبقاء الصف الحقيقي فقط)
DELETE FROM invoice_sync_settings 
WHERE id = '00000000-0000-0000-0000-000000000001';

-- 2) حذف الدالة القديمة
DROP FUNCTION IF EXISTS update_invoice_sync_schedule(boolean, text, text, text);

-- 3) إنشاء دالة جديدة نظيفة وبسيطة
CREATE OR REPLACE FUNCTION update_invoice_sync_schedule(
  p_enabled BOOLEAN,
  p_frequency TEXT,
  p_morning_time TEXT,
  p_evening_time TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_morning_hour INT;
  v_morning_minute INT;
  v_evening_hour INT;
  v_evening_minute INT;
  v_morning_cron TEXT;
  v_evening_cron TEXT;
  v_settings_id UUID;
BEGIN
  -- ✅ استخراج الساعة والدقيقة بشكل آمن
  v_morning_hour := EXTRACT(HOUR FROM p_morning_time::TIME);
  v_morning_minute := EXTRACT(MINUTE FROM p_morning_time::TIME);
  v_evening_hour := EXTRACT(HOUR FROM p_evening_time::TIME);
  v_evening_minute := EXTRACT(MINUTE FROM p_evening_time::TIME);
  
  -- ✅ بناء cron expressions
  v_morning_cron := v_morning_minute || ' ' || v_morning_hour || ' * * *';
  v_evening_cron := v_evening_minute || ' ' || v_evening_hour || ' * * *';
  
  -- ✅ الحصول على ID الإعدادات الموجود (أو إنشاء واحد جديد)
  SELECT id INTO v_settings_id FROM invoice_sync_settings LIMIT 1;
  
  IF v_settings_id IS NULL THEN
    -- إنشاء صف جديد إذا لم يكن موجوداً
    INSERT INTO invoice_sync_settings (
      id, daily_sync_enabled, sync_frequency, morning_sync_time, evening_sync_time, updated_at
    ) VALUES (
      gen_random_uuid(), p_enabled, p_frequency, p_morning_time::TIME, p_evening_time::TIME, now()
    )
    RETURNING id INTO v_settings_id;
  ELSE
    -- تحديث الصف الموجود
    UPDATE invoice_sync_settings SET
      daily_sync_enabled = p_enabled,
      sync_frequency = p_frequency,
      morning_sync_time = p_morning_time::TIME,
      evening_sync_time = p_evening_time::TIME,
      updated_at = now()
    WHERE id = v_settings_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'settings_id', v_settings_id,
    'enabled', p_enabled,
    'frequency', p_frequency,
    'morning_cron', v_morning_cron,
    'evening_cron', v_evening_cron
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;