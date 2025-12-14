-- ========================================
-- 1. إصلاح دالة notify_new_order() 
-- ========================================
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_record RECORD;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- إنشاء عنوان ورسالة الإشعار
  notification_title := 'طلب ذكي جديد';
  notification_message := 'تم استلام طلب ذكي جديد برقم ' || COALESCE(NEW.id::text, 'غير معروف');
  
  -- إرسال إشعار لجميع المديرين والأدمن باستخدام user_roles + roles
  FOR admin_record IN 
    SELECT DISTINCT ur.user_id 
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    JOIN profiles p ON ur.user_id = p.user_id
    WHERE r.name IN ('super_admin', 'admin', 'manager', 'deputy_admin')
      AND ur.is_active = true
      AND p.is_active = true
  LOOP
    INSERT INTO notifications (user_id, title, message, type, data, created_at)
    VALUES (
      admin_record.user_id,
      notification_title,
      notification_message,
      'new_ai_order',
      jsonb_build_object(
        'ai_order_id', NEW.id,
        'source', NEW.source,
        'status', NEW.status,
        'total_amount', NEW.total_amount
      ),
      NOW()
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- ========================================
-- 2. إصلاح دالة audit_inventory_accuracy()
-- ========================================
DROP FUNCTION IF EXISTS public.audit_inventory_accuracy();

CREATE OR REPLACE FUNCTION public.audit_inventory_accuracy()
RETURNS TABLE (
  product_id uuid,
  variant_id uuid,
  product_name text,
  color_name text,
  size_value text,
  current_quantity integer,
  current_reserved integer,
  current_sold integer,
  calculated_reserved bigint,
  calculated_sold bigint,
  reserved_difference bigint,
  sold_difference bigint,
  issue_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH reserved_calc AS (
    -- حساب المحجوز من الطلبات النشطة
    SELECT 
      oi.variant_id as v_id,
      COALESCE(SUM(oi.quantity), 0)::bigint as calc_reserved
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.delivery_status NOT IN ('4', '17')
      AND o.isarchived = false
      AND COALESCE(o.order_type, '') != 'return'
      AND COALESCE(oi.item_direction, 'outgoing') != 'incoming'
      AND NOT (o.order_type = 'partial_delivery' AND oi.item_status = 'delivered')
    GROUP BY oi.variant_id
  ),
  sold_calc AS (
    -- حساب المباع من الطلبات المسلمة
    SELECT 
      oi.variant_id as v_id,
      COALESCE(SUM(oi.quantity), 0)::bigint as calc_sold
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE (
      (o.delivery_status = '4' AND COALESCE(o.order_type, '') != 'return')
      OR (o.order_type = 'partial_delivery' AND oi.item_status = 'delivered')
    )
    AND COALESCE(oi.item_direction, 'outgoing') != 'incoming'
    GROUP BY oi.variant_id
  )
  SELECT 
    inv.product_id,
    inv.id as variant_id,
    p.name as product_name,
    inv.color_name,
    inv.size_value,
    inv.quantity as current_quantity,
    inv.reserved_quantity as current_reserved,
    inv.sold_quantity as current_sold,
    COALESCE(rc.calc_reserved, 0) as calculated_reserved,
    COALESCE(sc.calc_sold, 0) as calculated_sold,
    COALESCE(rc.calc_reserved, 0) - inv.reserved_quantity as reserved_difference,
    COALESCE(sc.calc_sold, 0) - inv.sold_quantity as sold_difference,
    CASE 
      WHEN COALESCE(rc.calc_reserved, 0) != inv.reserved_quantity 
           AND COALESCE(sc.calc_sold, 0) != inv.sold_quantity 
        THEN 'complex'
      WHEN COALESCE(rc.calc_reserved, 0) != inv.reserved_quantity 
        THEN 'reserved_mismatch'
      WHEN COALESCE(sc.calc_sold, 0) != inv.sold_quantity 
        THEN 'sold_mismatch'
      WHEN inv.reserved_quantity < 0 OR inv.sold_quantity < 0 
        THEN 'negative_values'
      ELSE 'ok'
    END as issue_type
  FROM inventory inv
  JOIN products p ON inv.product_id = p.id
  LEFT JOIN reserved_calc rc ON inv.id = rc.v_id
  LEFT JOIN sold_calc sc ON inv.id = sc.v_id
  WHERE p.is_active = true
  ORDER BY 
    CASE 
      WHEN COALESCE(rc.calc_reserved, 0) != inv.reserved_quantity 
           OR COALESCE(sc.calc_sold, 0) != inv.sold_quantity 
        THEN 0 
      ELSE 1 
    END,
    p.name;
END;
$$;

-- ========================================
-- 3. تحديث دالة fix_inventory_discrepancies()
-- ========================================
DROP FUNCTION IF EXISTS public.fix_inventory_discrepancies();

CREATE OR REPLACE FUNCTION public.fix_inventory_discrepancies()
RETURNS TABLE (
  fixed_variant_id uuid,
  product_name text,
  color_name text,
  size_value text,
  old_reserved integer,
  new_reserved bigint,
  old_sold integer,
  new_sold bigint,
  fix_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  fixes_count integer := 0;
BEGIN
  -- جلب جميع التناقضات من دالة التدقيق
  FOR rec IN 
    SELECT * FROM audit_inventory_accuracy() 
    WHERE issue_type != 'ok'
  LOOP
    -- تحديث المخزون
    UPDATE inventory
    SET 
      reserved_quantity = rec.calculated_reserved::integer,
      sold_quantity = rec.calculated_sold::integer
    WHERE id = rec.variant_id;
    
    -- تسجيل العملية في سجل العمليات
    INSERT INTO inventory_operations_log (
      inventory_id,
      product_id,
      operation_type,
      source_type,
      quantity_change,
      reserved_before,
      reserved_after,
      sold_before,
      sold_after,
      stock_before,
      stock_after,
      available_before,
      available_after,
      notes,
      created_at
    ) VALUES (
      rec.variant_id,
      rec.product_id,
      'audit_correction',
      'audit',
      0,
      rec.current_reserved,
      rec.calculated_reserved::integer,
      rec.current_sold,
      rec.calculated_sold::integer,
      rec.current_quantity,
      rec.current_quantity,
      rec.current_quantity - rec.current_reserved,
      rec.current_quantity - rec.calculated_reserved::integer,
      'تصحيح تلقائي من فحص دقة المخزون - النوع: ' || rec.issue_type,
      NOW()
    );
    
    fixes_count := fixes_count + 1;
    
    -- إرجاع النتيجة
    fixed_variant_id := rec.variant_id;
    product_name := rec.product_name;
    color_name := rec.color_name;
    size_value := rec.size_value;
    old_reserved := rec.current_reserved;
    new_reserved := rec.calculated_reserved;
    old_sold := rec.current_sold;
    new_sold := rec.calculated_sold;
    fix_type := rec.issue_type;
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$;