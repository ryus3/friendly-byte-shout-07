-- إضافة Real-time للجداول المالية
ALTER TABLE public.cash_sources REPLICA IDENTITY FULL;
ALTER TABLE public.cash_movements REPLICA IDENTITY FULL;
ALTER TABLE public.purchases REPLICA IDENTITY FULL;
ALTER TABLE public.purchase_items REPLICA IDENTITY FULL;
ALTER TABLE public.expenses REPLICA IDENTITY FULL;
ALTER TABLE public.profits REPLICA IDENTITY FULL;

-- إضافة الجداول إلى publication الخاص بـ Real-time
ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_sources;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_movements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profits;