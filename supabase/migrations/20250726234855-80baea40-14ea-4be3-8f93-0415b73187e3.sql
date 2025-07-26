-- تطوير نظام خصومات المدن ليشمل خصومات متنوعة ومتعددة

-- إنشاء جدول لأنواع الخصومات المختلفة للمدن
CREATE TABLE IF NOT EXISTS public.city_monthly_benefits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  city_name TEXT NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  benefit_type TEXT NOT NULL, -- 'discount', 'free_delivery', 'points_bonus'
  benefit_value NUMERIC NOT NULL DEFAULT 10, -- قيمة الخصم أو المكافأة
  max_usage INTEGER NOT NULL DEFAULT 1, -- الحد الأقصى للاستخدام
  current_usage INTEGER NOT NULL DEFAULT 0, -- الاستخدام الحالي
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(city_name, month, year, benefit_type)
);

-- إنشاء جدول لتتبع استخدام المزايا
CREATE TABLE IF NOT EXISTS public.city_benefit_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  city_benefit_id UUID NOT NULL REFERENCES public.city_monthly_benefits(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  benefit_applied NUMERIC NOT NULL DEFAULT 0, -- المبلغ المطبق
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notification_sent BOOLEAN NOT NULL DEFAULT false,
  
  UNIQUE(city_benefit_id, order_id)
);

-- تفعيل RLS
ALTER TABLE public.city_monthly_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_benefit_usage ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان
CREATE POLICY "المستخدمون يديرون مزايا المدن" 
ON public.city_monthly_benefits 
FOR ALL 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "المستخدمون يديرون استخدام المزايا" 
ON public.city_benefit_usage 
FOR ALL 
USING (auth.uid() IS NOT NULL);