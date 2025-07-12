-- إنشاء جدول الإعدادات العامة
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- إضافة RLS للإعدادات
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view settings" ON public.settings;
CREATE POLICY "Authenticated users can view settings" 
ON public.settings 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage settings" ON public.settings;
CREATE POLICY "Authenticated users can manage settings" 
ON public.settings 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- إنشاء جدول توكينات شركاء التوصيل
CREATE TABLE IF NOT EXISTS public.delivery_partner_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_name TEXT NOT NULL,
  token TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- إضافة RLS لتوكينات التوصيل
ALTER TABLE public.delivery_partner_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view delivery tokens" ON public.delivery_partner_tokens;
CREATE POLICY "Authenticated users can view delivery tokens" 
ON public.delivery_partner_tokens 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage delivery tokens" ON public.delivery_partner_tokens;
CREATE POLICY "Authenticated users can manage delivery tokens" 
ON public.delivery_partner_tokens 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- تحديث جدول القياسات لإضافة نوع وترتيب
ALTER TABLE public.sizes ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'letter';
ALTER TABLE public.sizes ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- إضافة فهرسة للترتيب والنوع
CREATE INDEX IF NOT EXISTS idx_sizes_type_order ON public.sizes(type, display_order);

-- إدراج الإعدادات الأساسية
INSERT INTO public.settings (key, value, description) VALUES 
('app_name', '"نظام RYUS"', 'اسم التطبيق'),
('currency', '"IQD"', 'العملة المستخدمة'),
('low_stock_threshold', '5', 'حد التنبيه للمخزون المنخفض'),
('medium_stock_threshold', '10', 'حد التنبيه للمخزون المتوسط'),
('delivery_fee', '5000', 'رسوم التوصيل الافتراضية'),
('sku_prefix', '"RYUS"', 'بادئة رمز المنتج'),
('auto_generate_sku', 'true', 'إنشاء رمز المنتج تلقائياً'),
('enable_barcode', 'true', 'تفعيل الباركود'),
('backup_frequency', '"daily"', 'تكرار النسخ الاحتياطي')
ON CONFLICT (key) DO NOTHING;

-- إضافة تريغر تحديث التاريخ للجداول الجديدة
DROP TRIGGER IF EXISTS update_settings_updated_at ON public.settings;
CREATE TRIGGER update_settings_updated_at
BEFORE UPDATE ON public.settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_delivery_tokens_updated_at ON public.delivery_partner_tokens;
CREATE TRIGGER update_delivery_tokens_updated_at
BEFORE UPDATE ON public.delivery_partner_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();