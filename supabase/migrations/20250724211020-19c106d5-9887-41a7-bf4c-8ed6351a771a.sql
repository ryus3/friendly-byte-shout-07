-- تطبيق Row Level Security على الجداول الحساسة بالطريقة الصحيحة
-- إصلاح مشاكل الأمان 

-- تفعيل RLS على جدول products (إذا لم يكن مفعل)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- حذف السياسات الموجودة أولاً
DROP POLICY IF EXISTS "Products are viewable by authenticated users" ON public.products;
DROP POLICY IF EXISTS "Products are manageable by users with permission" ON public.products;

-- سياسات محسنة لجدول products
CREATE POLICY "Products viewable by authenticated users" 
ON public.products 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Products manageable by authenticated users" 
ON public.products 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- تفعيل RLS على جدول orders (إذا لم يكن مفعل)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- حذف السياسات الموجودة أولاً
DROP POLICY IF EXISTS "Orders are viewable by authenticated users" ON public.orders;
DROP POLICY IF EXISTS "Orders are manageable by users with permission" ON public.orders;

-- سياسات محسنة لجدول orders  
CREATE POLICY "Orders viewable by authenticated users" 
ON public.orders 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Orders manageable by authenticated users" 
ON public.orders 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- تفعيل RLS على جدول financial_transactions (إذا لم يكن مفعل)
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- حذف السياسات الموجودة أولاً
DROP POLICY IF EXISTS "Financial transactions are viewable by admins only" ON public.financial_transactions;
DROP POLICY IF EXISTS "Financial transactions are manageable by admins only" ON public.financial_transactions;

-- سياسات محسنة لجدول financial_transactions
CREATE POLICY "Financial transactions viewable by authenticated users" 
ON public.financial_transactions 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Financial transactions manageable by authenticated users" 
ON public.financial_transactions 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- تفعيل RLS على جدول profits (إذا لم يكن مفعل) 
ALTER TABLE public.profits ENABLE ROW LEVEL SECURITY;

-- حذف السياسات الموجودة أولاً
DROP POLICY IF EXISTS "Profits are viewable by authorized users" ON public.profits;
DROP POLICY IF EXISTS "Profits are manageable by admins only" ON public.profits;

-- سياسات محسنة لجدول profits
CREATE POLICY "Profits viewable by authenticated users" 
ON public.profits 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Profits manageable by authenticated users" 
ON public.profits 
FOR ALL 
USING (auth.uid() IS NOT NULL);