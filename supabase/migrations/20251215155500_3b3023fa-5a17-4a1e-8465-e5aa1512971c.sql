-- تغيير REPLICA IDENTITY لضمان إرسال كل البيانات في أحداث Real-time
ALTER TABLE ai_orders REPLICA IDENTITY FULL;

-- التأكد من أن الجدول مضاف لـ supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'ai_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ai_orders;
  END IF;
END $$;