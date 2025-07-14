-- إضافة جدول لتتبع إشعارات المخزون المرسلة
CREATE TABLE IF NOT EXISTS public.stock_notification_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  variant_id UUID,
  notification_sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  stock_level INTEGER NOT NULL,
  notification_type TEXT NOT NULL DEFAULT 'low_stock',
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_notification_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view stock notification history" 
ON public.stock_notification_history 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage stock notification history" 
ON public.stock_notification_history 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- إضافة إعدادات تحكم في إشعارات المخزون
INSERT INTO public.settings (key, value, description) VALUES 
('stock_notification_frequency', '{"hours": 24}', 'تكرار إشعارات المخزون المنخفض بالساعات')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, description) VALUES 
('stock_notification_enabled', 'true', 'تفعيل إشعارات المخزون')
ON CONFLICT (key) DO NOTHING;