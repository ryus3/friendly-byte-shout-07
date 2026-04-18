-- إضافة product_variants لـ realtime publication لضمان تحديث فوري للمخزون
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'product_variants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.product_variants;
  END IF;
END $$;

-- ضمان REPLICA IDENTITY FULL لاستلام البيانات القديمة في events
ALTER TABLE public.product_variants REPLICA IDENTITY FULL;
ALTER TABLE public.inventory REPLICA IDENTITY FULL;

-- إضافة products و variants لجدول products إن لم يكن
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
END $$;

ALTER TABLE public.products REPLICA IDENTITY FULL;