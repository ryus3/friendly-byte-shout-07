-- إنشاء جدول سجل أعمال المخزون لمنع التكرار
CREATE TABLE IF NOT EXISTS public.order_stock_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  action_type TEXT NOT NULL, -- 'reserve', 'release', 'finalize'
  status TEXT NOT NULL,
  delivery_status TEXT,
  delivery_partner TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID DEFAULT auth.uid(),
  UNIQUE(order_id, action_type) -- منع التكرار لنفس الطلب ونفس العملية
);

-- السماح للمستخدمين المصرح لهم بإدارة سجل أعمال المخزون
ALTER TABLE public.order_stock_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage stock actions" 
ON public.order_stock_actions FOR ALL 
USING (auth.uid() IS NOT NULL);

-- إصلاح الطلب 101264291 الحالي (إرجاع وحدة واحدة)
DO $$
DECLARE
  v_order_id UUID;
  v_variant_id UUID;
  v_current_qty INTEGER;
  v_current_reserved INTEGER;
BEGIN
  -- البحث عن الطلب
  SELECT id INTO v_order_id 
  FROM public.orders 
  WHERE order_number = '101264291' OR tracking_number = '101264291' 
  LIMIT 1;
  
  IF v_order_id IS NOT NULL THEN
    -- البحث عن المتغير المتأثر (Barcelona XL)
    SELECT pv.id, inv.quantity, COALESCE(inv.reserved_quantity, 0)
    INTO v_variant_id, v_current_qty, v_current_reserved
    FROM public.order_items oi
    JOIN public.product_variants pv ON oi.variant_id = pv.id
    JOIN public.products p ON pv.product_id = p.id
    JOIN public.inventory inv ON pv.id = inv.variant_id
    WHERE oi.order_id = v_order_id
      AND p.name ILIKE '%barcelona%'
      AND pv.size_id = (SELECT id FROM public.sizes WHERE name = 'XL')
    LIMIT 1;
    
    IF v_variant_id IS NOT NULL THEN
      -- إرجاع وحدة واحدة للمخزون
      UPDATE public.inventory 
      SET quantity = quantity + 1,
          reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - 1),
          updated_at = now()
      WHERE variant_id = v_variant_id;
      
      RAISE NOTICE 'تم إصلاح المخزون للطلب 101264291: المتغير % - الكمية من % إلى %', 
        v_variant_id, v_current_qty, v_current_qty + 1;
    END IF;
  END IF;
END $$;

-- تحديث دالة update_order_reservation_status لمنع التكرار
CREATE OR REPLACE FUNCTION public.update_order_reservation_status(
  p_order_id UUID,
  p_new_status TEXT,
  p_new_delivery_status TEXT DEFAULT NULL,
  p_delivery_partner TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_action_type TEXT;
  v_should_release BOOLEAN;
  v_should_keep BOOLEAN;
  v_order_items CURSOR FOR 
    SELECT oi.variant_id, oi.quantity, p.name as product_name
    FROM order_items oi
    JOIN product_variants pv ON oi.variant_id = pv.id
    JOIN products p ON pv.product_id = p.id
    WHERE oi.order_id = p_order_id;
  v_item RECORD;
  v_processed_items INTEGER := 0;
  v_action_id UUID;
BEGIN
  -- حماية من التنفيذ المتزامن لنفس الطلب
  PERFORM pg_advisory_xact_lock(hashtext(p_order_id::text));
  
  -- تحديد نوع العملية
  v_should_release := should_release_stock_for_order(p_new_status, p_new_delivery_status, p_delivery_partner);
  v_should_keep := should_keep_reservation_for_order(p_new_status, p_new_delivery_status, p_delivery_partner);
  
  IF v_should_release THEN
    v_action_type := 'finalize'; -- خصم نهائي
  ELSIF v_should_keep THEN
    v_action_type := 'reserve'; -- حجز
  ELSE
    v_action_type := 'release'; -- إفراج
  END IF;
  
  -- التحقق من عدم تنفيذ نفس العملية مسبقاً
  INSERT INTO public.order_stock_actions (
    order_id, action_type, status, delivery_status, delivery_partner
  ) VALUES (
    p_order_id, v_action_type, p_new_status, p_new_delivery_status, p_delivery_partner
  ) ON CONFLICT (order_id, action_type) DO NOTHING
  RETURNING id INTO v_action_id;
  
  -- إذا لم يتم إدراج سجل جديد، فالعملية تمت مسبقاً
  IF v_action_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'action', 'already_processed',
      'message', 'العملية تمت مسبقاً لهذا الطلب'
    );
  END IF;
  
  -- تنفيذ العملية على عناصر الطلب
  FOR v_item IN v_order_items LOOP
    IF v_should_release THEN
      -- خصم نهائي من المخزون
      PERFORM public.finalize_stock_item(v_item.variant_id, v_item.quantity);
    ELSIF v_should_keep THEN
      -- حجز المخزون
      PERFORM public.reserve_stock_item(v_item.variant_id, v_item.quantity);
    ELSE
      -- إفراج عن المخزون المحجوز
      PERFORM public.release_stock_item(v_item.variant_id, v_item.quantity);
    END IF;
    v_processed_items := v_processed_items + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'action', v_action_type,
    'items_processed', v_processed_items,
    'should_release', v_should_release,
    'should_keep', v_should_keep
  );
END;
$$;

-- تحسين دالة finalize_stock_item لمنع الكميات السالبة
CREATE OR REPLACE FUNCTION public.finalize_stock_item(p_variant_id UUID, p_quantity INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_current_quantity INTEGER;
  v_current_reserved INTEGER;
BEGIN
  -- الحصول على الكميات الحالية
  SELECT quantity, COALESCE(reserved_quantity, 0)
  INTO v_current_quantity, v_current_reserved
  FROM public.inventory
  WHERE variant_id = p_variant_id;
  
  -- التحقق من وجود السجل
  IF NOT FOUND THEN
    RAISE WARNING 'المتغير % غير موجود في المخزون', p_variant_id;
    RETURN FALSE;
  END IF;
  
  -- التأكد من عدم وجود كميات سالبة
  IF v_current_quantity < p_quantity THEN
    RAISE WARNING 'لا يمكن خصم % وحدة من مخزون يحتوي على % وحدة فقط للمتغير %', 
      p_quantity, v_current_quantity, p_variant_id;
    RETURN FALSE;
  END IF;
  
  -- الخصم النهائي مع الحماية من السالب
  UPDATE public.inventory
  SET 
    quantity = GREATEST(0, quantity - p_quantity),
    reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - p_quantity),
    updated_at = now()
  WHERE variant_id = p_variant_id
    AND quantity >= p_quantity; -- شرط إضافي للأمان
  
  -- التحقق من نجاح التحديث
  IF NOT FOUND THEN
    RAISE WARNING 'فشل في خصم المخزون للمتغير % - ربما تم تعديله بواسطة عملية أخرى', p_variant_id;
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;