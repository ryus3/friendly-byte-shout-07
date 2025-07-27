-- تفعيل realtime للطلبات وعناصر الطلبات
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;

-- إضافة الجداول لـ realtime publication إذا لم تكن موجودة
DO $$
BEGIN
  -- إضافة orders
  BEGIN
    ALTER publication supabase_realtime ADD TABLE public.orders;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- الجدول موجود مسبقاً
  END;
  
  -- إضافة order_items
  BEGIN
    ALTER publication supabase_realtime ADD TABLE public.order_items;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- الجدول موجود مسبقاً
  END;
END $$;