-- إنشاء جدول النسخ الاحتياطية
CREATE TABLE public.system_backups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  backup_data JSONB NOT NULL,
  size_mb NUMERIC NOT NULL DEFAULT 0,
  backup_type TEXT NOT NULL DEFAULT 'full',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  description TEXT,
  is_auto_backup BOOLEAN DEFAULT false
);

-- فهرسة للبحث السريع
CREATE INDEX idx_system_backups_created_at ON public.system_backups(created_at DESC);
CREATE INDEX idx_system_backups_type ON public.system_backups(backup_type);
CREATE INDEX idx_system_backups_created_by ON public.system_backups(created_by);

-- تمكين RLS
ALTER TABLE public.system_backups ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان
CREATE POLICY "المديرون فقط يديرون النسخ الاحتياطية"
ON public.system_backups
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('super_admin', 'admin')
    AND ur.is_active = true
  )
);

-- دالة لتنظيف النسخ القديمة تلقائياً
CREATE OR REPLACE FUNCTION public.cleanup_old_backups()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- حذف النسخ الاحتياطية الأقدم من 30 يوم
  DELETE FROM public.system_backups 
  WHERE created_at < now() - interval '30 days'
  AND is_auto_backup = true;
  
  -- الحفاظ على آخر 10 نسخ احتياطية يدوية
  DELETE FROM public.system_backups 
  WHERE id NOT IN (
    SELECT id FROM public.system_backups 
    WHERE is_auto_backup = false
    ORDER BY created_at DESC 
    LIMIT 10
  ) AND is_auto_backup = false;
  
  RAISE NOTICE 'تم تنظيف النسخ الاحتياطية القديمة';
END;
$$;