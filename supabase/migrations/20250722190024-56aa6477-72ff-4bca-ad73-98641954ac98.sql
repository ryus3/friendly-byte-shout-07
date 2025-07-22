-- إنشاء جدول تتبع تكاليف المشتريات بالوقت لنظام FIFO
CREATE TABLE public.purchase_cost_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  variant_id UUID,
  purchase_id UUID NOT NULL,
  quantity INTEGER NOT NULL,
  remaining_quantity INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL,
  purchase_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- إضافة المفاتيح الخارجية
ALTER TABLE public.purchase_cost_history 
ADD CONSTRAINT fk_purchase_cost_product 
FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.purchase_cost_history 
ADD CONSTRAINT fk_purchase_cost_variant 
FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;

ALTER TABLE public.purchase_cost_history 
ADD CONSTRAINT fk_purchase_cost_purchase 
FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE CASCADE;

-- إنشاء فهارس للأداء
CREATE INDEX idx_purchase_cost_product_variant ON public.purchase_cost_history(product_id, variant_id);
CREATE INDEX idx_purchase_cost_date ON public.purchase_cost_history(purchase_date);
CREATE INDEX idx_purchase_cost_remaining ON public.purchase_cost_history(remaining_quantity) WHERE remaining_quantity > 0;

-- تمكين RLS
ALTER TABLE public.purchase_cost_history ENABLE ROW LEVEL SECURITY;

-- إنشاء سياسات RLS
CREATE POLICY "Authenticated users can manage purchase cost history" 
ON public.purchase_cost_history 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- وظيفة محدثة لإضافة سجل تكلفة عند الشراء
CREATE OR REPLACE FUNCTION public.add_purchase_cost_record(
  p_product_id UUID,
  p_variant_id UUID,
  p_purchase_id UUID,
  p_quantity INTEGER,
  p_unit_cost NUMERIC,
  p_purchase_date TIMESTAMP WITH TIME ZONE
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.purchase_cost_history (
    product_id,
    variant_id,
    purchase_id,
    quantity,
    remaining_quantity,
    unit_cost,
    purchase_date
  ) VALUES (
    p_product_id,
    p_variant_id,
    p_purchase_id,
    p_quantity,
    p_quantity, -- remaining_quantity يبدأ بنفس الكمية
    p_unit_cost,
    p_purchase_date
  );
  
  RAISE NOTICE 'تم إضافة سجل تكلفة: منتج=%, متغير=%, كمية=%, تكلفة=%', 
               p_product_id, p_variant_id, p_quantity, p_unit_cost;
END;
$$;

-- وظيفة حساب متوسط التكلفة FIFO
CREATE OR REPLACE FUNCTION public.calculate_fifo_cost(
  p_product_id UUID,
  p_variant_id UUID,
  p_quantity_sold INTEGER
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cost_record RECORD;
  total_cost NUMERIC := 0;
  remaining_to_sell INTEGER := p_quantity_sold;
  quantity_from_batch INTEGER;
BEGIN
  -- التكرار عبر سجلات التكلفة بترتيب تاريخ الشراء (FIFO)
  FOR cost_record IN 
    SELECT id, remaining_quantity, unit_cost
    FROM public.purchase_cost_history
    WHERE product_id = p_product_id 
    AND (p_variant_id IS NULL OR variant_id = p_variant_id)
    AND remaining_quantity > 0
    ORDER BY purchase_date ASC
  LOOP
    -- تحديد الكمية المطلوب بيعها من هذه الدفعة
    quantity_from_batch := LEAST(remaining_to_sell, cost_record.remaining_quantity);
    
    -- إضافة التكلفة
    total_cost := total_cost + (quantity_from_batch * cost_record.unit_cost);
    
    -- تحديث الكمية المتبقية في الدفعة
    UPDATE public.purchase_cost_history 
    SET remaining_quantity = remaining_quantity - quantity_from_batch,
        updated_at = now()
    WHERE id = cost_record.id;
    
    -- تقليل الكمية المطلوب بيعها
    remaining_to_sell := remaining_to_sell - quantity_from_batch;
    
    -- إذا تم بيع الكمية المطلوبة، توقف
    IF remaining_to_sell <= 0 THEN
      EXIT;
    END IF;
  END LOOP;
  
  -- إذا لم تكن هناك كمية كافية، إرجاع خطأ
  IF remaining_to_sell > 0 THEN
    RAISE WARNING 'لا توجد كمية كافية في المخزون للبيع. المطلوب: %, المتاح من التكلفة: %', 
                  p_quantity_sold, p_quantity_sold - remaining_to_sell;
  END IF;
  
  RETURN total_cost;
END;
$$;

-- تحديث وظيفة تحديث المخزون من المشتريات لتشمل تسجيل التكاليف
CREATE OR REPLACE FUNCTION public.update_variant_stock_from_purchase_with_cost(
  p_sku TEXT,
  p_quantity_change INTEGER,
  p_cost_price NUMERIC,
  p_purchase_id UUID,
  p_purchase_date TIMESTAMP WITH TIME ZONE
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  variant_record RECORD;
  product_record RECORD;
  inventory_record RECORD;
  color_id UUID;
  size_id UUID;
  base_product_name TEXT;
  current_user_id UUID;
BEGIN
  RAISE NOTICE 'بدء معالجة SKU مع تتبع التكلفة: %, الكمية: %, السعر: %', p_sku, p_quantity_change, p_cost_price;
  
  -- الحصول على معرف المستخدم الحالي
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    SELECT user_id INTO current_user_id FROM public.profiles WHERE is_active = true LIMIT 1;
    IF current_user_id IS NULL THEN
      RAISE EXCEPTION 'لا يوجد مستخدمون نشطون في النظام';
    END IF;
  END IF;
  
  -- البحث عن المتغير بالباركود/SKU
  SELECT pv.*, p.id as product_id, p.name as product_name
  INTO variant_record
  FROM public.product_variants pv
  JOIN public.products p ON pv.product_id = p.id
  WHERE pv.barcode = p_sku OR pv.sku = p_sku
  LIMIT 1;
  
  -- إذا لم يوجد المتغير، إنشاء منتج ومتغير جديد
  IF variant_record IS NULL THEN
    RAISE NOTICE 'لم يوجد متغير للـ SKU %, سيتم إنشاء منتج ومتغير جديد', p_sku;
    
    base_product_name := COALESCE(NULLIF(TRIM(SPLIT_PART(p_sku, '-', 1)), ''), 'منتج جديد');
    
    -- إنشاء أو البحث عن اللون والحجم الافتراضي
    SELECT id INTO color_id FROM public.colors WHERE name = 'افتراضي' LIMIT 1;
    IF color_id IS NULL THEN
      INSERT INTO public.colors (name, hex_code) VALUES ('افتراضي', '#808080') RETURNING id INTO color_id;
    END IF;
    
    SELECT id INTO size_id FROM public.sizes WHERE name = 'افتراضي' LIMIT 1;
    IF size_id IS NULL THEN
      INSERT INTO public.sizes (name, type) VALUES ('افتراضي', 'letter') RETURNING id INTO size_id;
    END IF;
    
    -- إنشاء منتج جديد
    INSERT INTO public.products (
      name, cost_price, base_price, is_active, created_by
    ) VALUES (
      base_product_name, p_cost_price, p_cost_price * 1.3, true, current_user_id
    ) RETURNING * INTO product_record;
    
    -- إنشاء متغير جديد
    INSERT INTO public.product_variants (
      product_id, color_id, size_id, barcode, sku, price, cost_price, is_active
    ) VALUES (
      product_record.id, color_id, size_id, p_sku, p_sku, p_cost_price * 1.3, p_cost_price, true
    ) RETURNING *, product_record.id as product_id INTO variant_record;
    
  ELSE
    -- تحديث سعر التكلفة للمتغير الموجود
    UPDATE public.product_variants 
    SET cost_price = p_cost_price, price = GREATEST(price, p_cost_price * 1.2), updated_at = now()
    WHERE id = variant_record.id;
    
    UPDATE public.products 
    SET cost_price = p_cost_price, updated_at = now()
    WHERE id = variant_record.product_id;
  END IF;
  
  -- إضافة سجل تكلفة جديد
  PERFORM public.add_purchase_cost_record(
    variant_record.product_id,
    variant_record.id,
    p_purchase_id,
    p_quantity_change,
    p_cost_price,
    p_purchase_date
  );
  
  -- تحديث المخزون
  SELECT * INTO inventory_record
  FROM public.inventory
  WHERE product_id = variant_record.product_id AND variant_id = variant_record.id;
  
  IF inventory_record IS NULL THEN
    INSERT INTO public.inventory (
      product_id, variant_id, quantity, min_stock, reserved_quantity, last_updated_by
    ) VALUES (
      variant_record.product_id, variant_record.id, GREATEST(0, p_quantity_change), 0, 0, current_user_id
    );
  ELSE
    UPDATE public.inventory 
    SET quantity = GREATEST(0, quantity + p_quantity_change), updated_at = now(), last_updated_by = current_user_id
    WHERE product_id = variant_record.product_id AND variant_id = variant_record.id;
  END IF;
  
  RAISE NOTICE 'تمت معالجة SKU % بنجاح مع تسجيل التكلفة', p_sku;
END;
$$;

-- تحديث وظيفة الحذف الشامل للفواتير لتشمل سجلات التكلفة
CREATE OR REPLACE FUNCTION public.delete_purchase_completely(p_purchase_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  purchase_record RECORD;
  item_record RECORD;
  affected_rows INTEGER := 0;
  result_data jsonb := '{}';
BEGIN
  -- الحصول على تفاصيل الفاتورة أولاً
  SELECT * INTO purchase_record FROM public.purchases WHERE id = p_purchase_id;
  
  IF purchase_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الفاتورة غير موجودة');
  END IF;
  
  RAISE NOTICE 'بدء حذف فاتورة رقم: %', purchase_record.purchase_number;
  
  -- 1. استرداد المبلغ للمصدر النقدي إذا كان محدد
  IF purchase_record.cash_source_id IS NOT NULL THEN
    PERFORM public.update_cash_source_balance(
      purchase_record.cash_source_id, purchase_record.total_amount, 'in', 'purchase_refund',
      p_purchase_id, 'استرداد مبلغ فاتورة محذوفة رقم ' || purchase_record.purchase_number,
      purchase_record.created_by
    );
    RAISE NOTICE 'تم استرداد المبلغ: % للمصدر النقدي', purchase_record.total_amount;
  END IF;
  
  -- 2. تقليل كمية المخزون للعناصر
  FOR item_record IN 
    SELECT pi.*, pv.barcode, pv.sku
    FROM public.purchase_items pi
    LEFT JOIN public.product_variants pv ON pi.variant_id = pv.id
    WHERE pi.purchase_id = p_purchase_id
  LOOP
    UPDATE public.inventory 
    SET quantity = GREATEST(0, quantity - item_record.quantity), updated_at = now()
    WHERE product_id = item_record.product_id AND variant_id = item_record.variant_id;
    
    RAISE NOTICE 'تم تقليل مخزون المنتج: % بكمية: %', 
      COALESCE(item_record.barcode, item_record.sku, 'غير محدد'), item_record.quantity;
  END LOOP;
  
  -- 3. حذف سجلات التكلفة المرتبطة بالفاتورة
  DELETE FROM public.purchase_cost_history WHERE purchase_id = p_purchase_id;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RAISE NOTICE 'تم حذف % سجل تكلفة', affected_rows;
  
  -- 4. حذف المصاريف المرتبطة بالفاتورة
  DELETE FROM public.expenses 
  WHERE receipt_number = purchase_record.purchase_number
     OR receipt_number = purchase_record.purchase_number || '-SHIP'
     OR receipt_number = purchase_record.purchase_number || '-TRANSFER';
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RAISE NOTICE 'تم حذف % مصروف مرتبط بالفاتورة', affected_rows;
  
  -- 5. حذف المعاملات المالية المرتبطة
  DELETE FROM public.financial_transactions 
  WHERE reference_id = p_purchase_id AND reference_type = 'purchase';
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RAISE NOTICE 'تم حذف % معاملة مالية', affected_rows;
  
  -- 6. حذف عناصر الفاتورة
  DELETE FROM public.purchase_items WHERE purchase_id = p_purchase_id;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RAISE NOTICE 'تم حذف % عنصر من الفاتورة', affected_rows;
  
  -- 7. حذف الفاتورة نفسها
  DELETE FROM public.purchases WHERE id = p_purchase_id;
  
  RAISE NOTICE 'تم حذف الفاتورة رقم: % نهائياً', purchase_record.purchase_number;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم حذف الفاتورة رقم ' || purchase_record.purchase_number || ' وجميع متعلقاتها بنجاح',
    'purchase_number', purchase_record.purchase_number,
    'refunded_amount', purchase_record.total_amount
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'خطأ في حذف الفاتورة: %', SQLERRM;
    RETURN jsonb_build_object('success', false, 'error', 'خطأ في حذف الفاتورة: ' || SQLERRM);
END;
$$;