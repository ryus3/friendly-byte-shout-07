-- تفعيل realtime للمصاريف والمشتريات

-- تفعيل REPLICA IDENTITY FULL للتحديثات الكاملة
ALTER TABLE public.expenses REPLICA IDENTITY FULL;
ALTER TABLE public.purchases REPLICA IDENTITY FULL;

-- إضافة الجداول لـ realtime publication
ALTER publication supabase_realtime ADD TABLE public.expenses;
ALTER publication supabase_realtime ADD TABLE public.purchases;