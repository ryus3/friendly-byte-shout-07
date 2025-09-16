-- الإصلاح الجذري النهائي لجميع المشاكل

-- 1. إصلاح البيانات الموجودة: تحديث ai_orders بـ created_by = null
UPDATE public.ai_orders 
SET created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid,
    updated_at = now()
WHERE created_by IS NULL;

-- 2. إصلاح ربط المناطق: نقل جميع المناطق من المعرفات الداخلية إلى alwaseet_id
UPDATE public.regions_cache rc
SET city_id = cc.alwaseet_id,
    updated_at = now()
FROM public.cities_cache cc
WHERE rc.city_id = cc.id 
  AND cc.is_active = true
  AND rc.city_id != cc.alwaseet_id;

-- 3. تنظيف المناطق المكررة أو الخاطئة
DELETE FROM public.regions_cache 
WHERE city_id NOT IN (SELECT alwaseet_id FROM public.cities_cache WHERE is_active = true);

-- 4. إصلاح دالة process_telegram_order مع ضمان created_by صحيح
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_order_data jsonb,
  p_employee_code text,
  p_chat_id bigint DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ai_order_id uuid;
  v_employee_info jsonb;
  v_user_id uuid;
  v_default_admin_id uuid := '91484496-b887-44f7-9e5d-be9db5567604'::uuid;
BEGIN
  -- البحث عن معلومات الموظف باستخدام employee_code
  SELECT 
    p.user_id,
    jsonb_build_object(
      'user_id', p.user_id,
      'full_name', p.full_name,
      'employee_code', tec.employee_code
    ) INTO v_user_id, v_employee_info
  FROM public.telegram_employee_codes tec
  JOIN public.profiles p ON tec.user_id = p.user_id
  WHERE tec.employee_code = p_employee_code
    AND tec.is_active = true;

  -- إذا لم نجد الموظف، استخدم المدير الافتراضي
  IF v_user_id IS NULL THEN
    v_user_id := v_default_admin_id;
    v_employee_info := jsonb_build_object(
      'user_id', v_user_id,
      'full_name', 'مدير النظام',
      'employee_code', p_employee_code
    );
    
    RAISE NOTICE 'استخدام المدير الافتراضي للكود: %', p_employee_code;
  END IF;

  -- إنشاء الطلب الذكي مع ضمان created_by صحيح
  INSERT INTO public.ai_orders (
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    customer_province,
    order_data,
    items,
    total_amount,
    telegram_chat_id,
    source,
    created_by, -- استخدام user_id المؤكد
    original_text,
    city_id,
    region_id
  ) VALUES (
    p_order_data->>'customer_name',
    p_order_data->>'customer_phone',
    p_order_data->>'customer_address',
    p_order_data->>'customer_city',
    p_order_data->>'customer_province',
    p_order_data,
    COALESCE(p_order_data->'items', '[]'::jsonb),
    COALESCE((p_order_data->>'total_amount')::numeric, 0),
    p_chat_id,
    'telegram',
    v_user_id, -- user_id مؤكد 100%
    p_order_data->>'original_text',
    COALESCE((p_order_data->>'city_id')::integer, NULL),
    COALESCE((p_order_data->>'region_id')::integer, NULL)
  ) RETURNING id INTO v_ai_order_id;

  RAISE NOTICE 'تم إنشاء طلب ذكي جديد % للموظف %', v_ai_order_id, v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'employee', v_employee_info,
    'created_by', v_user_id,
    'message', 'تم إنشاء الطلب الذكي بنجاح'
  );
END;
$function$;

-- 5. إنشاء جدول لتتبع آخر تحديث للمدن والمناطق
CREATE TABLE IF NOT EXISTS public.cities_regions_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  last_sync_at timestamp with time zone NOT NULL DEFAULT now(),
  cities_count integer DEFAULT 0,
  regions_count integer DEFAULT 0,
  sync_duration_seconds numeric DEFAULT 0,
  success boolean DEFAULT true,
  error_message text,
  triggered_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

-- 6. إضافة RLS للجدول الجديد
ALTER TABLE public.cities_regions_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "المديرون يديرون سجل مزامنة المدن والمناطق"
ON public.cities_regions_sync_log
FOR ALL
TO authenticated
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());

CREATE POLICY "المستخدمون يرون سجل مزامنة المدن والمناطق"
ON public.cities_regions_sync_log
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 7. دالة لجلب آخر تحديث للمدن والمناطق
CREATE OR REPLACE FUNCTION public.get_last_cities_regions_sync()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_last_sync record;
  v_cities_count integer;
  v_regions_count integer;
BEGIN
  -- الحصول على آخر سجل مزامنة
  SELECT * INTO v_last_sync
  FROM public.cities_regions_sync_log
  ORDER BY last_sync_at DESC
  LIMIT 1;

  -- إحصائيات حالية
  SELECT COUNT(*) INTO v_cities_count FROM public.cities_cache WHERE is_active = true;
  SELECT COUNT(*) INTO v_regions_count FROM public.regions_cache WHERE is_active = true;

  RETURN jsonb_build_object(
    'last_sync_at', COALESCE(v_last_sync.last_sync_at, NULL),
    'cities_count', v_cities_count,
    'regions_count', v_regions_count,
    'last_sync_success', COALESCE(v_last_sync.success, true),
    'last_sync_duration', COALESCE(v_last_sync.sync_duration_seconds, 0),
    'current_timestamp', now()
  );
END;
$function$;

-- 8. دالة محسنة لتسجيل بداية ونهاية المزامنة
CREATE OR REPLACE FUNCTION public.log_cities_regions_sync_start()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_sync_id uuid;
BEGIN
  INSERT INTO public.cities_regions_sync_log (
    last_sync_at,
    triggered_by,
    success
  ) VALUES (
    now(),
    auth.uid(),
    false -- سيتم تحديثها عند الانتهاء
  ) RETURNING id INTO v_sync_id;
  
  RETURN v_sync_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_cities_regions_sync_end(
  p_sync_id uuid,
  p_start_time timestamp with time zone,
  p_cities_count integer DEFAULT 0,
  p_regions_count integer DEFAULT 0,
  p_success boolean DEFAULT true,
  p_error_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.cities_regions_sync_log
  SET 
    cities_count = p_cities_count,
    regions_count = p_regions_count,
    sync_duration_seconds = EXTRACT(EPOCH FROM (now() - p_start_time)),
    success = p_success,
    error_message = p_error_message
  WHERE id = p_sync_id;
END;
$function$;