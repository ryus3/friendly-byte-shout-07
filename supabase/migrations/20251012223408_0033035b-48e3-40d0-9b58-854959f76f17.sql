-- ✅ تحديث دالة should_release_stock_for_order للتحقق من حالة 21 قبل 17

CREATE OR REPLACE FUNCTION public.should_release_stock_for_order(
  p_status text, 
  p_delivery_status text DEFAULT NULL::text, 
  p_delivery_partner text DEFAULT NULL::text,
  p_order_id uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_has_status_21 boolean := false;
BEGIN
  -- للطلبات المحلية
  IF p_delivery_partner IS NULL OR p_delivery_partner = 'محلي' THEN
    RETURN p_status IN ('completed', 'delivered', 'returned_in_stock');
  END IF;

  -- لطلبات الوسيط - التحقق من الحالة الخاصة
  IF LOWER(p_delivery_partner) = 'alwaseet' THEN
    -- حالة 4 (تم التسليم للزبون) - تحرير فوري
    IF p_delivery_status::text = '4' THEN
      RETURN true;
    END IF;
    
    -- حالة 17 (تم الإرجاع للتاجر) - التحقق من حالة 21 أولاً
    IF p_delivery_status::text = '17' AND p_order_id IS NOT NULL THEN
      -- التحقق من أن الطلب مرّ بحالة 21 (return_pending)
      SELECT EXISTS (
        SELECT 1 
        FROM order_status_history 
        WHERE order_id = p_order_id 
        AND (new_delivery_status = '21' OR new_status = 'return_pending')
      ) INTO v_has_status_21;
      
      -- أيضاً التحقق من الحالة الحالية
      IF NOT v_has_status_21 THEN
        SELECT EXISTS (
          SELECT 1 
          FROM orders 
          WHERE id = p_order_id 
          AND (delivery_status = '21' OR status = 'return_pending')
        ) INTO v_has_status_21;
      END IF;
      
      -- فقط إذا مرّ بحالة 21، يُحرّر المخزون
      RETURN v_has_status_21;
    END IF;
    
    -- حالات أخرى
    RETURN false;
  END IF;

  -- لشركات التوصيل الأخرى
  IF p_delivery_status IS NOT NULL THEN
    RETURN p_delivery_status ~* 'تسليم|مسلم|deliver|راجع.*المخزن|return.*stock|تم.*الارجاع.*التاجر';
  END IF;

  -- الحالة الافتراضية
  RETURN p_status IN ('completed', 'delivered', 'returned_in_stock');
END;
$function$;

-- ✅ إنشاء دالة مساعدة للتحقق من حالة 21
CREATE OR REPLACE FUNCTION public.check_status_21_before_17(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_has_status_21 boolean;
BEGIN
  -- التحقق من وجود الحالة 21 في السجل
  SELECT EXISTS (
    SELECT 1 
    FROM order_status_history 
    WHERE order_id = p_order_id 
    AND new_delivery_status = '21'
  ) INTO v_has_status_21;
  
  RETURN v_has_status_21;
END;
$function$;