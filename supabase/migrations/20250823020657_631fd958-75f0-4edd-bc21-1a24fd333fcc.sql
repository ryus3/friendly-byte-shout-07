
BEGIN;

-- 1) إضافة أعمدة اختيارية لحفظ بيانات فاتورة الوسيط على الطلب
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_partner_invoice_id text,
  ADD COLUMN IF NOT EXISTS delivery_partner_invoice_date timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_received_by uuid;

-- فهارس اختيارية لتحسين الاستعلامات
CREATE INDEX IF NOT EXISTS idx_orders_delivery_partner_invoice_id ON public.orders (delivery_partner_invoice_id);
CREATE INDEX IF NOT EXISTS idx_orders_invoice_received_at ON public.orders (invoice_received_at);

-- 2) تعديل الدالة لمنع إنشاء مصروف توصيل تلقائي لطلبات Al-Waseet
CREATE OR REPLACE FUNCTION public.auto_add_delivery_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  main_cash_id UUID;
  delivery_fee_amount NUMERIC;
BEGIN
  -- فقط عند اكتمال الطلب واستلام الفاتورة
  IF NEW.status = 'completed' AND NEW.receipt_received = true 
     AND OLD.status != 'completed' AND NEW.delivery_fee > 0 THEN
    
    -- تخطّي الشركاء الخارجيين مثل الوسيط (لا نُنشئ مصروف ولا حركة نقدية هنا)
    IF COALESCE(LOWER(NEW.delivery_partner), '') = 'alwaseet' THEN
      RETURN NEW;
    END IF;
    
    -- الحصول على معرف القاصة الرئيسية
    SELECT id INTO main_cash_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
    delivery_fee_amount := NEW.delivery_fee;
    
    -- التحقق من عدم وجود مصروف توصيل مسبق
    IF NOT EXISTS (
      SELECT 1 FROM expenses 
      WHERE receipt_number = NEW.order_number || '-DELIVERY'
    ) THEN
      -- إضافة مصروف التوصيل (محلي فقط)
      INSERT INTO expenses (
        category,
        expense_type,
        description,
        amount,
        vendor_name,
        receipt_number,
        status,
        created_by,
        approved_by,
        approved_at,
        metadata
      ) VALUES (
        'التوصيل والشحن',
        'operational',
        'رسوم توصيل الطلب ' || NEW.order_number || ' - ' || COALESCE(NEW.delivery_partner, 'محلي'),
        delivery_fee_amount,
        COALESCE(NEW.delivery_partner, 'شركة التوصيل'),
        NEW.order_number || '-DELIVERY',
        'approved',
        NEW.created_by,
        NEW.created_by,
        now(),
        jsonb_build_object(
          'order_id', NEW.id,
          'delivery_fee_total', NEW.delivery_fee,
          'note', 'رسوم التوصيل الكاملة - تؤخذ من قبل شركة التوصيل',
          'auto_created', true
        )
      );
      
      -- خصم رسوم التوصيل من القاصة الرئيسية
      PERFORM public.update_cash_source_balance(
        main_cash_id,
        delivery_fee_amount,
        'out',
        'delivery_fees',
        NEW.id,
        'رسوم توصيل الطلب ' || NEW.order_number || ' - تؤخذ من قبل شركة التوصيل',
        NEW.created_by
      );
      
      RAISE NOTICE 'تم خصم رسوم التوصيل كاملة للطلب %: % د.ع', 
                   NEW.order_number, delivery_fee_amount;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 3) تنظيف بيانات سابقة: حذف المصاريف والحركات النقدية التي أُنشئت تلقائياً لطلبات Al-Waseet فقط
-- حذف المصاريف التي تحمل إيصال -DELIVERY والتي تم إنشاؤها تلقائياً
DELETE FROM public.expenses e
USING public.orders o
WHERE e.receipt_number = o.order_number || '-DELIVERY'
  AND COALESCE(LOWER(o.delivery_partner), '') = 'alwaseet'
  AND (e.metadata ? 'auto_created')
  AND (e.metadata->>'auto_created') = 'true';

-- حذف الحركات النقدية المرتبطة برسوم التوصيل لهذه الطلبات
DELETE FROM public.cash_movements cm
USING public.orders o
WHERE cm.reference_type = 'delivery_fees'
  AND cm.reference_id = o.id
  AND COALESCE(LOWER(o.delivery_partner), '') = 'alwaseet';

-- تحديث رصيد القاصة الرئيسية بعد التنظيف
SELECT public.refresh_main_cash_balance();

COMMIT;
