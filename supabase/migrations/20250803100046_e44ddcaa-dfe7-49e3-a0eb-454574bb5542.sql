-- إضافة RLS policies للـ views الجديدة
ALTER VIEW public.products_sold_stats SET (security_invoker = on);
ALTER VIEW public.sales_summary_stats SET (security_invoker = on);

-- إنشاء RLS policies للـ views
CREATE POLICY "Authenticated users can view products sold stats" 
ON public.products_sold_stats 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view sales summary stats" 
ON public.sales_summary_stats 
FOR SELECT 
USING (auth.uid() IS NOT NULL);