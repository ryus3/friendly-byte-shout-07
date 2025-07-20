-- تفعيل Real-time للجداول المهمة
ALTER TABLE public.purchases REPLICA IDENTITY FULL;
ALTER TABLE public.expenses REPLICA IDENTITY FULL;
ALTER TABLE public.inventory REPLICA IDENTITY FULL;
ALTER TABLE public.financial_transactions REPLICA IDENTITY FULL;

-- إضافة الجداول للـ publication للـ real-time
SELECT pg_catalog.pg_publication_tables() as existing_tables;