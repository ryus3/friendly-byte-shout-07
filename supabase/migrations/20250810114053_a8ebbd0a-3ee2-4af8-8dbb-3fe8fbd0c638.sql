-- Fix delete_ai_order_safe authorization (remove pr.role); enable realtime for ai_orders/orders
CREATE OR REPLACE FUNCTION public.delete_ai_order_safe(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  allowed BOOLEAN := FALSE;
  deleted_count INTEGER := 0;
BEGIN
  SELECT * INTO v_order FROM public.ai_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الطلب غير موجود');
  END IF;

  IF auth.uid() IS NOT NULL THEN
    allowed := is_admin_or_deputy() OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.user_id = auth.uid()
        AND LOWER(COALESCE(pr.employee_code, '')) = LOWER(COALESCE(v_order.created_by, ''))
    );
  END IF;

  IF NOT allowed THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح بالحذف');
  END IF;

  DELETE FROM public.ai_orders WHERE id = p_order_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN jsonb_build_object('success', deleted_count = 1);
END;
$$;

-- Ensure realtime emits full row images
ALTER TABLE public.ai_orders REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Add tables to supabase_realtime publication if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ai_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_orders;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;