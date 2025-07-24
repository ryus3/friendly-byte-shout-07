-- تطبيق Row Level Security على الجداول الحساسة
-- إصلاح مشاكل الأمان التي ظهرت في فحص النظام

-- تفعيل RLS على جدول products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- سياسات لجدول products
CREATE POLICY "Products are viewable by authenticated users" 
ON public.products 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Products are manageable by users with permission" 
ON public.products 
FOR ALL 
USING (auth.uid() IS NOT NULL AND auth.uid() IN (
  SELECT user_id FROM profiles WHERE role IN ('admin', 'employee') AND is_active = true
));

-- تفعيل RLS على جدول orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- سياسات لجدول orders
CREATE POLICY "Orders are viewable by authenticated users" 
ON public.orders 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Orders are manageable by users with permission" 
ON public.orders 
FOR ALL 
USING (auth.uid() IS NOT NULL AND auth.uid() IN (
  SELECT user_id FROM profiles WHERE role IN ('admin', 'employee') AND is_active = true
));

-- تفعيل RLS على جدول financial_transactions
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- سياسات لجدول financial_transactions
CREATE POLICY "Financial transactions are viewable by admins only" 
ON public.financial_transactions 
FOR SELECT 
USING (auth.uid() IN (
  SELECT user_id FROM profiles WHERE role = 'admin' AND is_active = true
));

CREATE POLICY "Financial transactions are manageable by admins only" 
ON public.financial_transactions 
FOR ALL 
USING (auth.uid() IN (
  SELECT user_id FROM profiles WHERE role = 'admin' AND is_active = true
));

-- تفعيل RLS على جدول profits
ALTER TABLE public.profits ENABLE ROW LEVEL SECURITY;

-- سياسات لجدول profits
CREATE POLICY "Profits are viewable by authorized users" 
ON public.profits 
FOR SELECT 
USING (auth.uid() IN (
  SELECT user_id FROM profiles WHERE role IN ('admin', 'employee') AND is_active = true
));

CREATE POLICY "Profits are manageable by admins only" 
ON public.profits 
FOR ALL 
USING (auth.uid() IN (
  SELECT user_id FROM profiles WHERE role = 'admin' AND is_active = true
));