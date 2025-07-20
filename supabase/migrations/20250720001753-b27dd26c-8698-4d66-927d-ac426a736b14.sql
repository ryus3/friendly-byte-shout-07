-- إنشاء نظام قاصة ومصادر مالية صحيح

-- جدول مصادر الأموال (القاصة، البنك، إلخ)
CREATE TABLE public.cash_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'cash', -- cash, bank, digital_wallet
  current_balance NUMERIC NOT NULL DEFAULT 0,
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- RLS للمصادر المالية
ALTER TABLE public.cash_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage cash sources" ON public.cash_sources FOR ALL USING (auth.uid() IS NOT NULL);

-- إدراج القاصة الرئيسية الافتراضية
INSERT INTO public.cash_sources (name, type, current_balance, initial_balance, description, created_by)
VALUES ('القاصة الرئيسية', 'cash', 0, 0, 'القاصة الأساسية للمتجر', '00000000-0000-0000-0000-000000000000')
ON CONFLICT DO NOTHING;

-- إضافة أعمدة لجدول المشتريات
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS cash_source_id UUID REFERENCES public.cash_sources(id),
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash'; -- cash, bank_transfer, credit

-- إضافة أعمدة لجدول الطلبات
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS cash_source_id UUID REFERENCES public.cash_sources(id),
ADD COLUMN IF NOT EXISTS payment_received_source_id UUID REFERENCES public.cash_sources(id);

-- جدول حركات النقد (Cash Flow)
CREATE TABLE public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_source_id UUID NOT NULL REFERENCES public.cash_sources(id),
  movement_type TEXT NOT NULL, -- 'in' or 'out'
  amount NUMERIC NOT NULL,
  reference_type TEXT NOT NULL, -- 'purchase', 'order', 'expense', 'capital_injection', 'withdrawal'
  reference_id UUID,
  description TEXT NOT NULL,
  balance_before NUMERIC NOT NULL DEFAULT 0,
  balance_after NUMERIC NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS لحركات النقد
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage cash movements" ON public.cash_movements FOR ALL USING (auth.uid() IS NOT NULL);

-- فنكشن لتحديث رصيد القاصة
CREATE OR REPLACE FUNCTION public.update_cash_source_balance(
  p_cash_source_id UUID,
  p_amount NUMERIC,
  p_movement_type TEXT,
  p_reference_type TEXT,
  p_reference_id UUID,
  p_description TEXT,
  p_created_by UUID
) RETURNS BOOLEAN AS $$
DECLARE
  current_balance NUMERIC;
  new_balance NUMERIC;
BEGIN
  -- الحصول على الرصيد الحالي
  SELECT current_balance INTO current_balance FROM public.cash_sources WHERE id = p_cash_source_id;
  
  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'مصدر المال غير موجود';
  END IF;
  
  -- حساب الرصيد الجديد
  IF p_movement_type = 'in' THEN
    new_balance := current_balance + p_amount;
  ELSE
    new_balance := current_balance - p_amount;
    -- التحقق من عدم النزول تحت الصفر
    IF new_balance < 0 THEN
      RAISE EXCEPTION 'الرصيد غير كافي. الرصيد الحالي: %, المطلوب: %', current_balance, p_amount;
    END IF;
  END IF;
  
  -- تحديث رصيد المصدر
  UPDATE public.cash_sources 
  SET current_balance = new_balance, updated_at = now()
  WHERE id = p_cash_source_id;
  
  -- إدراج حركة النقد
  INSERT INTO public.cash_movements (
    cash_source_id, movement_type, amount, reference_type, reference_id,
    description, balance_before, balance_after, created_by
  ) VALUES (
    p_cash_source_id, p_movement_type, p_amount, p_reference_type, p_reference_id,
    p_description, current_balance, new_balance, p_created_by
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ترايجر لتحديث القاصة عند إضافة مشتريات
CREATE OR REPLACE FUNCTION public.handle_purchase_cash_flow()
RETURNS TRIGGER AS $$
BEGIN
  -- عند إضافة مشترى جديد، خصم المبلغ من القاصة
  IF TG_OP = 'INSERT' THEN
    -- تحديد القاصة (القاصة الرئيسية إذا لم تحدد)
    IF NEW.cash_source_id IS NULL THEN
      SELECT id INTO NEW.cash_source_id FROM public.cash_sources WHERE name = 'القاصة الرئيسية' LIMIT 1;
    END IF;
    
    -- خصم مبلغ الشراء من القاصة
    PERFORM public.update_cash_source_balance(
      NEW.cash_source_id,
      NEW.total_amount,
      'out',
      'purchase',
      NEW.id,
      'شراء بضاعة - فاتورة ' || NEW.purchase_number || ' - ' || NEW.supplier_name,
      NEW.created_by
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ربط الترايجر بجدول المشتريات
DROP TRIGGER IF EXISTS purchase_cash_flow_trigger ON public.purchases;
CREATE TRIGGER purchase_cash_flow_trigger
  AFTER INSERT ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_purchase_cash_flow();

-- ترايجر لتحديث القاصة عند استلام دفعات من الطلبات
CREATE OR REPLACE FUNCTION public.handle_order_cash_flow()
RETURNS TRIGGER AS $$
BEGIN
  -- عند تغيير حالة الطلب إلى "تم الدفع" أو استلام الفاتورة
  IF TG_OP = 'UPDATE' AND 
     OLD.receipt_received = false AND NEW.receipt_received = true THEN
    
    -- تحديد القاصة (القاصة الرئيسية إذا لم تحدد)
    IF NEW.payment_received_source_id IS NULL THEN
      SELECT id INTO NEW.payment_received_source_id FROM public.cash_sources WHERE name = 'القاصة الرئيسية' LIMIT 1;
    END IF;
    
    -- إضافة مبلغ الطلب للقاصة
    PERFORM public.update_cash_source_balance(
      NEW.payment_received_source_id,
      NEW.final_amount,
      'in',
      'order',
      NEW.id,
      'استلام دفعة - طلب ' || NEW.order_number || ' - ' || NEW.customer_name,
      NEW.receipt_received_by
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ربط الترايجر بجدول الطلبات
DROP TRIGGER IF EXISTS order_cash_flow_trigger ON public.orders;
CREATE TRIGGER order_cash_flow_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_cash_flow();

-- فنكشن لحساب الرصيد الصحيح للقاصة
CREATE OR REPLACE FUNCTION public.get_actual_cash_balance()
RETURNS TABLE(
  source_name TEXT,
  current_balance NUMERIC,
  total_in NUMERIC,
  total_out NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.name as source_name,
    cs.current_balance,
    COALESCE(SUM(CASE WHEN cm.movement_type = 'in' THEN cm.amount ELSE 0 END), 0) as total_in,
    COALESCE(SUM(CASE WHEN cm.movement_type = 'out' THEN cm.amount ELSE 0 END), 0) as total_out
  FROM public.cash_sources cs
  LEFT JOIN public.cash_movements cm ON cs.id = cm.cash_source_id
  WHERE cs.is_active = true
  GROUP BY cs.id, cs.name, cs.current_balance
  ORDER BY cs.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;