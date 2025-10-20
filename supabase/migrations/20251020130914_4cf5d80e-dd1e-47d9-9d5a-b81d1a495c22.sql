-- ========================================
-- المرحلة 1: استثناء طلبات الإرجاع من استلام الفواتير
-- ========================================

CREATE OR REPLACE FUNCTION public.propagate_invoice_received_to_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_owner uuid;
  v_is_admin boolean := false;
BEGIN
  v_owner := COALESCE(NEW.owner_user_id, auth.uid());

  BEGIN
    SELECT is_admin_or_deputy() INTO v_is_admin;
  EXCEPTION WHEN OTHERS THEN
    v_is_admin := false;
  END;

  -- عندما تصبح الفاتورة مستلمة
  IF NEW.received = true AND COALESCE(OLD.received, false) = false THEN
    UPDATE public.orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, now()),
      receipt_received_by = COALESCE(o.receipt_received_by, COALESCE(v_owner, '91484496-b887-44f7-9e5d-be9db5567604'::uuid)),
      delivery_partner_invoice_id = NEW.external_id::text,
      updated_at = now()
    FROM public.delivery_invoice_orders dio
    WHERE dio.invoice_id = NEW.id
      AND dio.order_id = o.id
      AND o.receipt_received = false
      AND COALESCE(o.order_type, 'regular') != 'return'  -- ✅ استثناء طلبات الإرجاع
      AND (
        v_is_admin
        OR o.created_by = v_owner
      );

    UPDATE public.orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, now()),
      receipt_received_by = COALESCE(o.receipt_received_by, COALESCE(v_owner, '91484496-b887-44f7-9e5d-be9db5567604'::uuid)),
      delivery_partner_invoice_id = NEW.external_id::text,
      updated_at = now()
    WHERE o.delivery_partner_order_id IS NOT NULL
      AND o.delivery_partner_order_id IN (
        SELECT (dio.raw->>'id')::text
        FROM public.delivery_invoice_orders dio
        WHERE dio.invoice_id = NEW.id
      )
      AND o.receipt_received = false
      AND LOWER(COALESCE(o.delivery_partner, '')) = 'alwaseet'
      AND COALESCE(o.order_type, 'regular') != 'return'  -- ✅ استثناء طلبات الإرجاع
      AND (
        v_is_admin
        OR o.created_by = v_owner
      );
  END IF;

  -- عند إلغاء الاستلام
  IF NEW.received = false AND COALESCE(OLD.received, false) = true THEN
    UPDATE public.orders o
    SET 
      receipt_received = false,
      receipt_received_at = NULL,
      receipt_received_by = NULL,
      delivery_partner_invoice_id = NULL,
      updated_at = now()
    FROM public.delivery_invoice_orders dio
    WHERE dio.invoice_id = NEW.id
      AND dio.order_id = o.id
      AND COALESCE(o.order_type, 'regular') != 'return'
      AND (
        v_is_admin
        OR o.created_by = v_owner
      );

    UPDATE public.orders o
    SET 
      receipt_received = false,
      receipt_received_at = NULL,
      receipt_received_by = NULL,
      delivery_partner_invoice_id = NULL,
      updated_at = now()
    WHERE o.delivery_partner_order_id IS NOT NULL
      AND o.delivery_partner_order_id IN (
        SELECT (dio.raw->>'id')::text
        FROM public.delivery_invoice_orders dio
        WHERE dio.invoice_id = NEW.id
      )
      AND LOWER(COALESCE(o.delivery_partner, '')) = 'alwaseet'
      AND COALESCE(o.order_type, 'regular') != 'return'
      AND (
        v_is_admin
        OR o.created_by = v_owner
      );
  END IF;

  RETURN NEW;
END;
$function$;

-- ========================================
-- المرحلة 2: جدول return_history
-- ========================================

CREATE TABLE IF NOT EXISTS public.return_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  original_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  refund_amount numeric NOT NULL DEFAULT 0,
  delivery_fee numeric NOT NULL DEFAULT 0,
  employee_profit_deducted numeric NOT NULL DEFAULT 0,
  system_profit_deducted numeric NOT NULL DEFAULT 0,
  financial_handler_success boolean NOT NULL DEFAULT false,
  error_message text,
  status_17_at timestamptz,
  status_21_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_return_history_return_order ON public.return_history(return_order_id);
CREATE INDEX IF NOT EXISTS idx_return_history_original_order ON public.return_history(original_order_id);
CREATE INDEX IF NOT EXISTS idx_return_history_created_at ON public.return_history(created_at DESC);

-- RLS
ALTER TABLE public.return_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "المديرون يديرون سجل الإرجاعات"
  ON public.return_history
  FOR ALL
  USING (is_admin_or_deputy());

CREATE POLICY "الموظفون يرون سجلات إرجاعاتهم"
  ON public.return_history
  FOR SELECT
  USING (
    created_by = auth.uid() OR 
    is_admin_or_deputy() OR
    EXISTS (
      SELECT 1 FROM public.orders o 
      WHERE o.id = return_history.return_order_id 
      AND o.created_by = auth.uid()
    )
  );

-- Trigger للتحديث التلقائي
CREATE OR REPLACE FUNCTION public.update_return_history_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trigger_update_return_history_timestamp
  BEFORE UPDATE ON public.return_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_return_history_timestamp();

-- ========================================
-- المرحلة 2: Trigger لحالة 21 (الخصم المالي)
-- ========================================

CREATE OR REPLACE FUNCTION public.handle_return_status_21()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_original_order_id uuid;
  v_refund_amount numeric;
  v_original_profit record;
  v_employee_deduction numeric;
BEGIN
  -- التحقق من الانتقال إلى حالة 21
  IF NEW.delivery_status = '21' 
     AND COALESCE(OLD.delivery_status, '') != '21'
     AND COALESCE(NEW.order_type, 'regular') = 'return' THEN
     
    -- 1️⃣ جلب الطلب الأصلي من ai_orders
    SELECT original_order_id INTO v_original_order_id
    FROM public.ai_orders
    WHERE id = NEW.id;
    
    IF v_original_order_id IS NOT NULL THEN
      -- 2️⃣ حساب المبلغ المُسترد
      v_refund_amount := ABS(COALESCE(NEW.refund_amount, 0));
      
      -- 3️⃣ جلب معلومات الربح الأصلي
      SELECT * INTO v_original_profit
      FROM public.profits
      WHERE order_id = v_original_order_id
      LIMIT 1;
      
      IF v_original_profit.id IS NOT NULL THEN
        -- حساب خصم الموظف
        v_employee_deduction := (v_refund_amount * COALESCE(v_original_profit.employee_percentage, 0) / 100);
        
        -- 4️⃣ تحديث جدول الأرباح
        UPDATE public.profits
        SET 
          total_revenue = GREATEST(0, total_revenue - v_refund_amount),
          profit_amount = GREATEST(0, profit_amount - v_refund_amount),
          employee_profit = GREATEST(0, employee_profit - v_employee_deduction),
          updated_at = now()
        WHERE order_id = v_original_order_id;
        
        -- 5️⃣ تسجيل في accounting كـ adjustment
        INSERT INTO public.accounting (
          type,
          category,
          amount,
          description,
          reference_id,
          reference_type,
          created_by,
          created_at
        ) VALUES (
          'adjustment',
          'return_deduction',
          v_refund_amount,
          'خصم بسبب إرجاع - الطلب الأصلي: ' || COALESCE(
            (SELECT order_number FROM public.orders WHERE id = v_original_order_id),
            v_original_order_id::text
          ),
          v_original_order_id,
          'order_return',
          COALESCE(NEW.created_by, auth.uid(), '91484496-b887-44f7-9e5d-be9db5567604'::uuid),
          now()
        );
        
        -- 6️⃣ تحديث return_history
        UPDATE public.return_history
        SET 
          status_21_at = now(),
          system_profit_deducted = v_refund_amount - v_employee_deduction,
          updated_at = now()
        WHERE return_order_id = NEW.id;
        
        RAISE NOTICE 'تم خصم % من الطلب الأصلي % (حالة 21)', v_refund_amount, v_original_order_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- ربط الـ trigger بجدول orders
DROP TRIGGER IF EXISTS trigger_handle_return_status_21 ON public.orders;
CREATE TRIGGER trigger_handle_return_status_21
  AFTER UPDATE OF delivery_status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_return_status_21();