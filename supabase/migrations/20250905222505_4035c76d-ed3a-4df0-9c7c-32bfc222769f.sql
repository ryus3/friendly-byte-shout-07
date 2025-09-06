-- تنفيذ نظام مزامنة شامل وموحد للفواتير
-- 1. إنشاء جدول لحفظ آخر مزامنة لكل موظف (Delta Syncing)
CREATE TABLE IF NOT EXISTS public.employee_invoice_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  last_sync_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_invoice_date TIMESTAMP WITH TIME ZONE,
  invoices_synced INTEGER DEFAULT 0,
  sync_type TEXT DEFAULT 'automatic', -- automatic, manual, targeted
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. إنشاء جدول لإعدادات مزامنة الفواتير
CREATE TABLE IF NOT EXISTS public.invoice_sync_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_sync_enabled BOOLEAN DEFAULT true,
  daily_sync_time TIME DEFAULT '09:00:00',
  lookback_days INTEGER DEFAULT 30, -- عدد الأيام للبحث في API
  auto_cleanup_enabled BOOLEAN DEFAULT true,
  keep_invoices_per_employee INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- إدخال الإعدادات الافتراضية
INSERT INTO public.invoice_sync_settings (id) 
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- 3. دالة محسنة لـ upsert الفواتير مع تنظيف تلقائي (10 فقط)
CREATE OR REPLACE FUNCTION public.upsert_alwaseet_invoice_list_with_strict_cleanup(
  p_invoices jsonb,
  p_employee_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_item jsonb;
  v_id text;
  v_amount numeric;
  v_count int;
  v_status text;
  v_merchant_id text;
  v_updated_at timestamptz;
  v_upserts int := 0;
  v_deleted int := 0;
BEGIN
  IF p_invoices IS NULL OR jsonb_typeof(p_invoices) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  -- 1. إدخال/تحديث الفواتير
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_invoices)
  LOOP
    v_id := v_item->>'id';
    v_amount := COALESCE((v_item->>'merchant_price')::numeric, 0);
    v_count := COALESCE((v_item->>'delivered_orders_count')::int, 0);
    v_status := v_item->>'status';
    v_merchant_id := v_item->>'merchant_id';
    v_updated_at := COALESCE(NULLIF(v_item->>'updated_at','')::timestamptz, now());

    INSERT INTO public.delivery_invoices (
      external_id, partner, amount, orders_count, status, merchant_id,
      issued_at, last_api_updated_at, raw, owner_user_id
    ) VALUES (
      v_id, 'alwaseet', v_amount, v_count, v_status, v_merchant_id,
      v_updated_at, v_updated_at, v_item, p_employee_id
    )
    ON CONFLICT (external_id, partner) DO UPDATE SET
      amount = EXCLUDED.amount,
      orders_count = EXCLUDED.orders_count,
      status = EXCLUDED.status,
      merchant_id = EXCLUDED.merchant_id,
      issued_at = COALESCE(EXCLUDED.issued_at, public.delivery_invoices.issued_at, now()),
      last_api_updated_at = COALESCE(EXCLUDED.last_api_updated_at, public.delivery_invoices.last_api_updated_at),
      raw = EXCLUDED.raw,
      owner_user_id = COALESCE(public.delivery_invoices.owner_user_id, EXCLUDED.owner_user_id),
      updated_at = now();

    v_upserts := v_upserts + 1;
  END LOOP;

  -- 2. تنظيف صارم: الاحتفاظ بآخر 10 فواتير فقط لهذا الموظف
  WITH ranked_invoices AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY owner_user_id 
             ORDER BY COALESCE(issued_at, created_at) DESC, created_at DESC
           ) as rn
    FROM public.delivery_invoices
    WHERE owner_user_id = p_employee_id
      AND partner = 'alwaseet'
  ),
  deleted AS (
    DELETE FROM public.delivery_invoices 
    WHERE id IN (
      SELECT id FROM ranked_invoices WHERE rn > 10
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM deleted;

  -- 3. تحديث سجل المزامنة
  INSERT INTO public.employee_invoice_sync_log (
    employee_id, last_sync_at, invoices_synced, sync_type
  ) VALUES (
    p_employee_id, now(), v_upserts, 'automatic'
  )
  ON CONFLICT (employee_id) DO UPDATE SET
    last_sync_at = now(),
    invoices_synced = EXCLUDED.invoices_synced,
    sync_type = EXCLUDED.sync_type,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true, 
    'processed', v_upserts,
    'deleted_old', v_deleted,
    'kept_per_employee', 10,
    'message', format('تم معالجة %s فاتورة وحذف %s فاتورة قديمة، الاحتفاظ بآخر 10 فواتير', v_upserts, v_deleted)
  );
END;
$function$;

-- 4. دالة مزامنة مستهدفة لفاتورة واحدة مفقودة (الضمان)
CREATE OR REPLACE FUNCTION public.sync_missing_invoice_targeted(
  p_invoice_id text,
  p_employee_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_exists boolean := false;
BEGIN
  -- التحقق من وجود الفاتورة
  SELECT EXISTS(
    SELECT 1 FROM public.delivery_invoices 
    WHERE external_id = p_invoice_id AND partner = 'alwaseet'
  ) INTO v_exists;

  IF v_exists THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'الفاتورة موجودة بالفعل',
      'invoice_id', p_invoice_id,
      'action', 'no_action_needed'
    );
  END IF;

  -- إدخال السجل لمزامنة مستهدفة للضمان
  INSERT INTO public.employee_invoice_sync_log (
    employee_id, last_sync_at, invoices_synced, sync_type
  ) VALUES (
    p_employee_id, now(), 0, 'targeted_missing'
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم تسجيل طلب مزامنة مستهدفة للفاتورة المفقودة',
    'invoice_id', p_invoice_id,
    'action', 'sync_requested'
  );
END;
$function$;

-- 5. دالة للحصول على آخر مزامنة لموظف (Delta Syncing)
CREATE OR REPLACE FUNCTION public.get_employee_last_sync(p_employee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_last_sync timestamptz;
  v_settings record;
BEGIN
  -- جلب آخر مزامنة
  SELECT last_sync_at INTO v_last_sync
  FROM public.employee_invoice_sync_log
  WHERE employee_id = p_employee_id
  ORDER BY last_sync_at DESC
  LIMIT 1;

  -- جلب الإعدادات
  SELECT * INTO v_settings
  FROM public.invoice_sync_settings
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'last_sync_at', v_last_sync,
    'needs_sync', COALESCE(v_last_sync < now() - interval '1 hour', true),
    'settings', row_to_json(v_settings)
  );
END;
$function$;

-- 6. إعداد RLS للجداول الجديدة
ALTER TABLE public.employee_invoice_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_sync_settings ENABLE ROW LEVEL SECURITY;

-- سياسات RLS لسجل المزامنة
CREATE POLICY "المستخدمون يرون سجلات مزامنتهم"
ON public.employee_invoice_sync_log FOR SELECT
USING (employee_id = auth.uid() OR is_admin_or_deputy());

CREATE POLICY "المديرون يديرون سجلات المزامنة"
ON public.employee_invoice_sync_log FOR ALL
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());

-- سياسات RLS لإعدادات المزامنة
CREATE POLICY "المستخدمون يرون إعدادات المزامنة"
ON public.invoice_sync_settings FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "المديرون يديرون إعدادات المزامنة"
ON public.invoice_sync_settings FOR ALL
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());

-- 7. إعداد الفهارس للأداء
CREATE INDEX IF NOT EXISTS idx_employee_invoice_sync_log_employee_id 
ON public.employee_invoice_sync_log(employee_id, last_sync_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_invoices_owner_issued_at 
ON public.delivery_invoices(owner_user_id, issued_at DESC) 
WHERE partner = 'alwaseet';