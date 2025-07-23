-- تنظيف شامل ونهائي: إزالة كل التكرار والفوضى في النظام المالي

-- 1. حذف جميع triggers المضاعفة للمصاريف والفواتير
DROP TRIGGER IF EXISTS trigger_process_expense_cash_movement ON public.expenses;
DROP TRIGGER IF EXISTS process_expense_cash_movement_trigger ON public.expenses;
DROP TRIGGER IF EXISTS expense_cash_movement_trigger ON public.expenses;
DROP TRIGGER IF EXISTS trigger_handle_expense_cash_flow ON public.expenses;
DROP TRIGGER IF EXISTS handle_purchase_cash_flow_trigger ON public.purchases;

-- 2. حذف جميع الحركات المالية المضاعفة والخاطئة للفاتورة رقم 1
DELETE FROM public.cash_movements 
WHERE (description LIKE '%فاتورة رقم 1%' OR description LIKE '%فاتورة 1%') 
AND id != 'ec8c7213-1598-4471-88c3-2f2f5b3c1def'; -- نحتفظ بالاسترداد الصحيح فقط

-- 3. حذف جميع المصاريف المضاعفة للفاتورة رقم 1 
DELETE FROM public.expenses 
WHERE receipt_number IN ('1', '1-SHIP', '1-TRANSFER') 
OR description LIKE '%فاتورة رقم 1%';

-- 4. إعادة ضبط رصيد القاصة الرئيسية للقيمة الصحيحة
UPDATE public.cash_sources 
SET current_balance = 5042000.00,
    updated_at = now()
WHERE name = 'القاصة الرئيسية';

-- 5. حذف جميع الدوال المسببة للتكرار
DROP FUNCTION IF EXISTS public.process_expense_cash_movement();
DROP FUNCTION IF EXISTS public.handle_expense_cash_flow();
DROP FUNCTION IF EXISTS public.handle_purchase_cash_flow();

-- 6. إنشاء نظام نظيف وبسيط: دالة واحدة محدودة للحركات النقدية فقط
-- (بدون triggers تلقائية تسبب تكرار)

-- 7. تحديث دالة حذف الفاتورة لتكون أكثر دقة ووضوح
CREATE OR REPLACE FUNCTION public.delete_purchase_completely(p_purchase_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  purchase_record RECORD;
  item_record RECORD;
  result_data jsonb := '{}';
BEGIN
  -- الحصول على تفاصيل الفاتورة
  SELECT * INTO purchase_record FROM public.purchases WHERE id = p_purchase_id;
  
  IF purchase_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الفاتورة غير موجودة');
  END IF;
  
  RAISE NOTICE 'حذف فاتورة رقم: %', purchase_record.purchase_number;
  
  -- 1. استرداد مبلغ الفاتورة (بدون triggers)
  IF purchase_record.cash_source_id IS NOT NULL THEN
    PERFORM public.update_cash_source_balance(
      purchase_record.cash_source_id, 
      purchase_record.total_amount, 
      'in', 
      'purchase_refund',
      p_purchase_id, 
      'استرداد فاتورة محذوفة رقم ' || purchase_record.purchase_number,
      purchase_record.created_by
    );
  END IF;
  
  -- 2. تقليل المخزون
  FOR item_record IN 
    SELECT * FROM public.purchase_items WHERE purchase_id = p_purchase_id
  LOOP
    UPDATE public.inventory 
    SET quantity = GREATEST(0, quantity - item_record.quantity), 
        updated_at = now()
    WHERE product_id = item_record.product_id 
    AND variant_id = item_record.variant_id;
  END LOOP;
  
  -- 3. حذف البيانات المرتبطة (بدون triggers)
  DELETE FROM public.purchase_cost_history WHERE purchase_id = p_purchase_id;
  DELETE FROM public.financial_transactions WHERE reference_id = p_purchase_id;
  DELETE FROM public.purchase_items WHERE purchase_id = p_purchase_id;
  DELETE FROM public.purchases WHERE id = p_purchase_id;
  
  -- 4. حذف المصاريف المرتبطة يدوياً (بدون triggers)
  DELETE FROM public.expenses 
  WHERE receipt_number = purchase_record.purchase_number
     OR receipt_number = purchase_record.purchase_number || '-SHIP'
     OR receipt_number = purchase_record.purchase_number || '-TRANSFER';
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم حذف الفاتورة ' || purchase_record.purchase_number || ' نهائياً',
    'purchase_number', purchase_record.purchase_number
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- 8. إنشاء دالة بسيطة ونظيفة لإضافة المصاريف (بدون triggers تلقائية)
CREATE OR REPLACE FUNCTION public.add_purchase_expenses_manual(
  p_purchase_id UUID,
  p_purchase_number TEXT,
  p_main_amount NUMERIC,
  p_shipping_cost NUMERIC DEFAULT 0,
  p_transfer_cost NUMERIC DEFAULT 0,
  p_supplier_name TEXT DEFAULT 'غير محدد',
  p_created_by UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  main_cash_id UUID;
  current_user_id UUID;
BEGIN
  -- تحديد المستخدم
  current_user_id := COALESCE(p_created_by, auth.uid());
  
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_id 
  FROM public.cash_sources 
  WHERE name = 'القاصة الرئيسية' AND is_active = true;
  
  -- إضافة مصروف البضاعة الرئيسي
  IF p_main_amount > 0 THEN
    INSERT INTO public.expenses (
      category, expense_type, description, amount, status, 
      receipt_number, vendor_name, created_by
    ) VALUES (
      'شراء', 'purchase', 
      'مواد فاتورة ' || p_purchase_number || ' من ' || p_supplier_name,
      p_main_amount, 'approved',
      p_purchase_number, p_supplier_name, current_user_id
    );
    
    -- خصم من القاصة الرئيسية
    PERFORM public.update_cash_source_balance(
      main_cash_id, p_main_amount, 'out', 'expense', p_purchase_id,
      'مصروف: مواد فاتورة ' || p_purchase_number, current_user_id
    );
  END IF;
  
  -- إضافة مصروف الشحن إذا وجد
  IF p_shipping_cost > 0 THEN
    INSERT INTO public.expenses (
      category, expense_type, description, amount, status, 
      receipt_number, vendor_name, created_by
    ) VALUES (
      'شحن ونقل', 'shipping', 
      'شحن فاتورة ' || p_purchase_number,
      p_shipping_cost, 'approved',
      p_purchase_number || '-SHIP', p_supplier_name, current_user_id
    );
  END IF;
  
  -- إضافة مصروف التحويل إذا وجد
  IF p_transfer_cost > 0 THEN
    INSERT INTO public.expenses (
      category, expense_type, description, amount, status, 
      receipt_number, vendor_name, created_by
    ) VALUES (
      'تكاليف تحويل', 'transfer', 
      'تحويل فاتورة ' || p_purchase_number,
      p_transfer_cost, 'approved',
      p_purchase_number || '-TRANSFER', p_supplier_name, current_user_id
    );
  END IF;
  
  RETURN TRUE;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'خطأ في إضافة مصاريف الفاتورة: %', SQLERRM;
    RETURN FALSE;
END;
$function$;