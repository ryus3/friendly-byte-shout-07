-- دالة لتحديث الفاتورة الموجودة وإضافة سعر الشحن
CREATE OR REPLACE FUNCTION public.fix_existing_purchase_shipping(
  p_purchase_id uuid,
  p_shipping_cost numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  purchase_record RECORD;
  items_total numeric := 0;
BEGIN
  -- الحصول على بيانات الفاتورة
  SELECT * INTO purchase_record FROM public.purchases WHERE id = p_purchase_id;
  
  IF purchase_record IS NULL THEN
    RAISE EXCEPTION 'الفاتورة غير موجودة';
  END IF;
  
  -- حساب إجمالي المنتجات
  SELECT COALESCE(SUM((item->>'costPrice')::numeric * (item->>'quantity')::numeric), 0)
  INTO items_total
  FROM jsonb_array_elements(purchase_record.items) AS item;
  
  -- تحديث الفاتورة لتشمل تكلفة الشحن
  UPDATE public.purchases 
  SET 
    total_amount = items_total + p_shipping_cost,
    paid_amount = items_total + p_shipping_cost,
    notes = CASE 
      WHEN p_shipping_cost > 0 THEN 'شحن: ' || p_shipping_cost || ' د.ع | تاريخ: ' || purchase_record.created_at::date
      ELSE 'تاريخ: ' || purchase_record.created_at::date
    END,
    updated_at = now()
  WHERE id = p_purchase_id;
  
  -- إضافة مصروف الشحن إذا لم يكن موجود
  IF p_shipping_cost > 0 AND NOT EXISTS (
    SELECT 1 FROM public.expenses 
    WHERE receipt_number = purchase_record.purchase_number || '-SHIP'
  ) THEN
    INSERT INTO public.expenses (
      category,
      expense_type,
      description,
      amount,
      vendor_name,
      receipt_number,
      status,
      created_by
    ) VALUES (
      'شحن ونقل',
      'operational',
      'تكلفة شحن فاتورة شراء ' || purchase_record.purchase_number || ' - ' || purchase_record.supplier_name,
      p_shipping_cost,
      purchase_record.supplier_name,
      purchase_record.purchase_number || '-SHIP',
      'approved',
      purchase_record.created_by
    );
  END IF;
  
  RAISE NOTICE 'تم تحديث الفاتورة % بتكلفة شحن %', purchase_record.purchase_number, p_shipping_cost;
END;
$function$;

-- تطبيق التحديث على الفاتورة الموجودة
SELECT public.fix_existing_purchase_shipping(
  (SELECT id FROM public.purchases ORDER BY created_at DESC LIMIT 1),
  5000
);