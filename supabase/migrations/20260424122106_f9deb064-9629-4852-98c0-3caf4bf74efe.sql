-- 1) Add new columns for advanced sync features
ALTER TABLE public.auto_sync_schedule_settings
  ADD COLUMN IF NOT EXISTS orders_working_hours_start TIME DEFAULT '08:00:00',
  ADD COLUMN IF NOT EXISTS orders_working_hours_end TIME DEFAULT '20:00:00',
  ADD COLUMN IF NOT EXISTS orders_max_per_sync INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS smart_sync_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS frontend_employee_followup_sync BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS employee_invoice_sync_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS invoice_sync_days TEXT[] DEFAULT ARRAY['mon','tue','wed','thu','fri','sat','sun'],
  ADD COLUMN IF NOT EXISTS sync_timeout_seconds INTEGER DEFAULT 300;

-- 2) Helper function to check if current user is admin/manager via user_roles
CREATE OR REPLACE FUNCTION public.is_admin_or_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id
      AND ur.is_active = true
      AND r.name IN ('super_admin', 'admin', 'department_manager')
  );
$$;

-- 3) Fix update_orders_sync_schedule
CREATE OR REPLACE FUNCTION public.update_orders_sync_schedule(
  p_enabled boolean DEFAULT NULL,
  p_sync_times text[] DEFAULT NULL,
  p_working_hours_only boolean DEFAULT NULL,
  p_working_hours_start time DEFAULT NULL,
  p_working_hours_end time DEFAULT NULL,
  p_max_per_sync integer DEFAULT NULL,
  p_smart_sync_enabled boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings_id uuid;
BEGIN
  IF NOT public.is_admin_or_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: only admins or managers can update sync schedule';
  END IF;

  SELECT id INTO v_settings_id FROM public.auto_sync_schedule_settings LIMIT 1;
  
  IF v_settings_id IS NULL THEN
    INSERT INTO public.auto_sync_schedule_settings DEFAULT VALUES RETURNING id INTO v_settings_id;
  END IF;

  UPDATE public.auto_sync_schedule_settings
  SET
    orders_sync_enabled = COALESCE(p_enabled, orders_sync_enabled),
    orders_sync_times = COALESCE(p_sync_times, orders_sync_times),
    orders_working_hours_only = COALESCE(p_working_hours_only, orders_working_hours_only),
    orders_working_hours_start = COALESCE(p_working_hours_start, orders_working_hours_start),
    orders_working_hours_end = COALESCE(p_working_hours_end, orders_working_hours_end),
    orders_max_per_sync = COALESCE(p_max_per_sync, orders_max_per_sync),
    smart_sync_enabled = COALESCE(p_smart_sync_enabled, smart_sync_enabled),
    updated_at = now()
  WHERE id = v_settings_id;

  RETURN jsonb_build_object('success', true, 'id', v_settings_id);
END;
$$;

-- 4) Fix update_tokens_renewal_settings
CREATE OR REPLACE FUNCTION public.update_tokens_renewal_settings(
  p_auto_renew boolean DEFAULT NULL,
  p_check_time time DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings_id uuid;
BEGIN
  IF NOT public.is_admin_or_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: only admins or managers can update token settings';
  END IF;

  SELECT id INTO v_settings_id FROM public.auto_sync_schedule_settings LIMIT 1;
  
  IF v_settings_id IS NULL THEN
    INSERT INTO public.auto_sync_schedule_settings DEFAULT VALUES RETURNING id INTO v_settings_id;
  END IF;

  UPDATE public.auto_sync_schedule_settings
  SET
    tokens_auto_renew_enabled = COALESCE(p_auto_renew, tokens_auto_renew_enabled),
    tokens_check_time = COALESCE(p_check_time, tokens_check_time),
    updated_at = now()
  WHERE id = v_settings_id;

  RETURN jsonb_build_object('success', true, 'id', v_settings_id);
END;
$$;

-- 5) Fix update_frontend_sync_settings (expanded)
CREATE OR REPLACE FUNCTION public.update_frontend_sync_settings(
  p_login_sync boolean DEFAULT NULL,
  p_orders_page_auto_sync boolean DEFAULT NULL,
  p_employee_page_auto_sync boolean DEFAULT NULL,
  p_employee_followup_sync boolean DEFAULT NULL,
  p_employee_invoice_sync boolean DEFAULT NULL,
  p_notifications_enabled boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings_id uuid;
BEGIN
  IF NOT public.is_admin_or_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: only admins or managers can update frontend sync settings';
  END IF;

  SELECT id INTO v_settings_id FROM public.auto_sync_schedule_settings LIMIT 1;
  
  IF v_settings_id IS NULL THEN
    INSERT INTO public.auto_sync_schedule_settings DEFAULT VALUES RETURNING id INTO v_settings_id;
  END IF;

  UPDATE public.auto_sync_schedule_settings
  SET
    frontend_login_sync = COALESCE(p_login_sync, frontend_login_sync),
    frontend_orders_page_auto_sync = COALESCE(p_orders_page_auto_sync, frontend_orders_page_auto_sync),
    frontend_employee_page_auto_sync = COALESCE(p_employee_page_auto_sync, frontend_employee_page_auto_sync),
    frontend_employee_followup_sync = COALESCE(p_employee_followup_sync, frontend_employee_followup_sync),
    employee_invoice_sync_enabled = COALESCE(p_employee_invoice_sync, employee_invoice_sync_enabled),
    notifications_enabled = COALESCE(p_notifications_enabled, notifications_enabled),
    updated_at = now()
  WHERE id = v_settings_id;

  RETURN jsonb_build_object('success', true, 'id', v_settings_id);
END;
$$;

-- 6) Update get_unified_sync_settings to include new columns
CREATE OR REPLACE FUNCTION public.get_unified_sync_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.auto_sync_schedule_settings%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.auto_sync_schedule_settings LIMIT 1;
  
  IF v_row.id IS NULL THEN
    INSERT INTO public.auto_sync_schedule_settings DEFAULT VALUES RETURNING * INTO v_row;
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;