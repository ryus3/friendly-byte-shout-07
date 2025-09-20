-- إصلاح مشاكل حركات النقد وأرصدة القاصات
-- 1. تصحيح رصيد قاصة الأعظمية إلى الصفر
UPDATE public.cash_sources 
SET current_balance = 0.00,
    updated_at = now()
WHERE name = 'قاصة الأعظمية';

-- 2. تصحيح جدول الأرباح - إزالة رسوم التوصيل من الإيراد الإجمالي
UPDATE public.profits 
SET total_revenue = 21000.00,
    updated_at = now()
WHERE order_id IN (
  SELECT id FROM public.orders WHERE order_number = 'ORD000010'
);

-- 3. إنشاء دالة للتحقق من تطابق أرصدة القاصات مع حركاتها
CREATE OR REPLACE FUNCTION public.validate_cash_source_balances()
RETURNS TABLE(
  cash_source_name text,
  recorded_balance numeric,
  calculated_balance numeric,
  difference numeric,
  is_valid boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.name,
    cs.current_balance,
    COALESCE(SUM(
      CASE 
        WHEN cm.movement_type = 'in' THEN cm.amount 
        ELSE -cm.amount 
      END
    ), 0) + cs.initial_balance as calc_balance,
    cs.current_balance - (
      COALESCE(SUM(
        CASE 
          WHEN cm.movement_type = 'in' THEN cm.amount 
          ELSE -cm.amount 
        END
      ), 0) + cs.initial_balance
    ) as diff,
    ABS(cs.current_balance - (
      COALESCE(SUM(
        CASE 
          WHEN cm.movement_type = 'in' THEN cm.amount 
          ELSE -cm.amount 
        END
      ), 0) + cs.initial_balance
    )) < 0.01 as valid
  FROM public.cash_sources cs
  LEFT JOIN public.cash_movements cm ON cs.id = cm.cash_source_id
  WHERE cs.is_active = true
  GROUP BY cs.id, cs.name, cs.current_balance, cs.initial_balance
  ORDER BY cs.name;
END;
$$;

-- 4. تحسين دالة إنشاء حركة النقد عند استلام الفاتورة
CREATE OR REPLACE FUNCTION public.create_invoice_cash_movement(
  p_order_id uuid,
  p_amount numeric,
  p_description text DEFAULT 'استلام فاتورة'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cash_source_id uuid;
  v_movement_id uuid;
  v_current_balance numeric;
  v_order_number text;
BEGIN
  -- الحصول على رقم الطلب
  SELECT order_number INTO v_order_number
  FROM public.orders
  WHERE id = p_order_id;

  -- الحصول على القاصة الرئيسية
  SELECT id, current_balance INTO v_cash_source_id, v_current_balance
  FROM public.cash_sources
  WHERE name = 'قاصة رئيسية' AND is_active = true
  LIMIT 1;

  IF v_cash_source_id IS NULL THEN
    RAISE EXCEPTION 'لم يتم العثور على القاصة الرئيسية';
  END IF;

  -- إنشاء حركة النقد
  INSERT INTO public.cash_movements (
    cash_source_id,
    amount,
    movement_type,
    description,
    reference_type,
    reference_id,
    balance_before,
    balance_after,
    created_by,
    effective_at
  ) VALUES (
    v_cash_source_id,
    p_amount,
    'in',
    p_description || ' - طلب ' || COALESCE(v_order_number, p_order_id::text),
    'order_revenue',
    p_order_id,
    v_current_balance,
    v_current_balance + p_amount,
    COALESCE(auth.uid(), '91484496-b887-44f7-9e5d-be9db5567604'::uuid),
    now()
  ) RETURNING id INTO v_movement_id;

  -- تحديث رصيد القاصة
  UPDATE public.cash_sources
  SET current_balance = v_current_balance + p_amount,
      updated_at = now()
  WHERE id = v_cash_source_id;

  RETURN v_movement_id;
END;
$$;