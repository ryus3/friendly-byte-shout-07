-- إضافة أعمدة الصلاحيات المفقودة في جدول profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS category_permissions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS color_permissions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS size_permissions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS department_permissions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS product_type_permissions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS season_occasion_permissions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS order_creation_mode TEXT DEFAULT 'both';

-- إضافة عمود خصم الطلب في جدول orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS custom_discount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_reason TEXT;

-- إنشاء جدول لتتبع الخصومات وتأثيرها على الأرباح
CREATE TABLE IF NOT EXISTS public.order_discounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  discount_reason TEXT,
  applied_by UUID NOT NULL REFERENCES public.profiles(user_id),
  affects_employee_profit BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- تمكين RLS على جدول order_discounts
ALTER TABLE public.order_discounts ENABLE ROW LEVEL SECURITY;

-- إنشاء سياسات الأمان لجدول order_discounts
CREATE POLICY "Authenticated users can view order discounts" 
ON public.order_discounts 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage order discounts" 
ON public.order_discounts 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- إنشاء trigger لتحديث updated_at
CREATE TRIGGER update_order_discounts_updated_at
BEFORE UPDATE ON public.order_discounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();