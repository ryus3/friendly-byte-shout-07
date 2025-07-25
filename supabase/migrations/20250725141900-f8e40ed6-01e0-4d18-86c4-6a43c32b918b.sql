-- إنشاء جدول مستويات الولاء
CREATE TABLE public.loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT NOT NULL,
  points_required INTEGER NOT NULL,
  discount_percentage NUMERIC DEFAULT 0,
  free_delivery_threshold NUMERIC DEFAULT 0,
  special_benefits JSONB DEFAULT '[]'::jsonb,
  color TEXT DEFAULT '#3B82F6',
  icon TEXT DEFAULT 'Star',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- إنشاء جدول نقاط العملاء
CREATE TABLE public.customer_loyalty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  total_points INTEGER DEFAULT 0,
  current_tier_id UUID REFERENCES public.loyalty_tiers(id),
  total_spent NUMERIC DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  last_tier_upgrade TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(customer_id)
);

-- إنشاء جدول سجل النقاط
CREATE TABLE public.loyalty_points_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  points_earned INTEGER NOT NULL,
  points_used INTEGER DEFAULT 0,
  transaction_type TEXT NOT NULL, -- 'earned', 'redeemed', 'expired'
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- إنشاء جدول المكافآت المستخدمة
CREATE TABLE public.loyalty_rewards_used (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL, -- 'discount', 'free_delivery', 'gift'
  reward_value NUMERIC,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- إدراج المستويات الافتراضية
INSERT INTO public.loyalty_tiers (name, name_en, points_required, discount_percentage, free_delivery_threshold, color, icon) VALUES
('برونزي', 'Bronze', 0, 0, 50000, '#CD7F32', 'Award'),
('فضي', 'Silver', 500, 5, 30000, '#C0C0C0', 'Medal'),
('ذهبي', 'Gold', 1500, 10, 20000, '#FFD700', 'Crown'),
('ماسي', 'Diamond', 5000, 15, 0, '#B9F2FF', 'Gem');

-- تمكين RLS
ALTER TABLE public.loyalty_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_loyalty ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_points_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards_used ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان
CREATE POLICY "العملاء يرون مستويات الولاء" ON public.loyalty_tiers FOR SELECT USING (true);
CREATE POLICY "المستخدمون يديرون مستويات الولاء" ON public.loyalty_tiers FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "المستخدمون يديرون ولاء العملاء" ON public.customer_loyalty FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "المستخدمون يديرون سجل النقاط" ON public.loyalty_points_history FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "المستخدمون يديرون المكافآت المستخدمة" ON public.loyalty_rewards_used FOR ALL USING (auth.uid() IS NOT NULL);

-- دالة حساب النقاط (100 نقطة لكل 1000 دينار)
CREATE OR REPLACE FUNCTION public.calculate_loyalty_points(order_amount NUMERIC)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- 100 نقطة لكل 1000 دينار
  RETURN FLOOR(order_amount / 1000) * 100;
END;
$$;

-- دالة تحديث مستوى العميل
CREATE OR REPLACE FUNCTION public.update_customer_tier(p_customer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  customer_points INTEGER;
  new_tier_id UUID;
  old_tier_id UUID;
BEGIN
  -- الحصول على نقاط العميل الحالية
  SELECT total_points, current_tier_id INTO customer_points, old_tier_id
  FROM public.customer_loyalty 
  WHERE customer_id = p_customer_id;
  
  -- العثور على المستوى المناسب
  SELECT id INTO new_tier_id
  FROM public.loyalty_tiers
  WHERE points_required <= customer_points
  ORDER BY points_required DESC
  LIMIT 1;
  
  -- تحديث المستوى إذا تغير
  IF new_tier_id != old_tier_id OR old_tier_id IS NULL THEN
    UPDATE public.customer_loyalty 
    SET current_tier_id = new_tier_id,
        last_tier_upgrade = now(),
        updated_at = now()
    WHERE customer_id = p_customer_id;
    
    -- إضافة إشعار للترقية
    INSERT INTO public.notifications (
      title,
      message,
      type,
      data,
      user_id
    ) VALUES (
      'ترقية مستوى العميل',
      'تم ترقية العميل إلى مستوى جديد في برنامج الولاء',
      'loyalty_upgrade',
      jsonb_build_object('customer_id', p_customer_id, 'new_tier_id', new_tier_id),
      NULL
    );
  END IF;
END;
$$;

-- دالة إضافة نقاط عند إكمال الطلب
CREATE OR REPLACE FUNCTION public.add_loyalty_points_on_order_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  points_to_add INTEGER;
  customer_record RECORD;
BEGIN
  -- فقط عند استلام الفاتورة
  IF NEW.receipt_received = true AND (OLD.receipt_received = false OR OLD.receipt_received IS NULL) THEN
    
    -- حساب النقاط
    points_to_add := public.calculate_loyalty_points(NEW.final_amount);
    
    -- التأكد من وجود العميل في جدول الولاء
    INSERT INTO public.customer_loyalty (customer_id, total_points, total_spent, total_orders)
    VALUES (NEW.customer_id, 0, 0, 0)
    ON CONFLICT (customer_id) DO NOTHING;
    
    -- تحديث نقاط وإحصائيات العميل
    UPDATE public.customer_loyalty 
    SET total_points = total_points + points_to_add,
        total_spent = total_spent + NEW.final_amount,
        total_orders = total_orders + 1,
        updated_at = now()
    WHERE customer_id = NEW.customer_id;
    
    -- إضافة سجل النقاط
    INSERT INTO public.loyalty_points_history (
      customer_id,
      order_id,
      points_earned,
      transaction_type,
      description
    ) VALUES (
      NEW.customer_id,
      NEW.id,
      points_to_add,
      'earned',
      'نقاط من طلب رقم ' || NEW.order_number
    );
    
    -- تحديث مستوى العميل
    PERFORM public.update_customer_tier(NEW.customer_id);
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- ربط الدالة بالطلبات
CREATE TRIGGER loyalty_points_on_order_completion
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.add_loyalty_points_on_order_completion();