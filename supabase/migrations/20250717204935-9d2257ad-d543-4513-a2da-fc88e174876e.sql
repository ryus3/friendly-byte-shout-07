-- المرحلة الثانية: حذف النظام القديم والأعمدة غير المستخدمة

-- 1. حذف الأعمدة القديمة من جدول profiles (النظام القديم)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS permissions;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS category_permissions;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS color_permissions;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS size_permissions;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS department_permissions;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS product_type_permissions;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS season_occasion_permissions;

-- 2. تحديث الملاحظات والتوثيق
COMMENT ON TABLE public.roles IS 'نظام الأدوار الموحد - يحتوي على جميع الأدوار المتاحة في النظام';
COMMENT ON TABLE public.permissions IS 'نظام الصلاحيات الموحد - يحتوي على جميع الصلاحيات المتاحة';
COMMENT ON TABLE public.user_roles IS 'ربط المستخدمين بأدوارهم';
COMMENT ON TABLE public.role_permissions IS 'ربط الأدوار بصلاحياتها';
COMMENT ON TABLE public.user_product_permissions IS 'صلاحيات المنتجات المخصصة للمستخدمين';

-- 3. التأكد من وجود الفهارس المطلوبة للأداء
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON public.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_product_permissions_user_id ON public.user_product_permissions(user_id);

-- 4. تحديث إعدادات الأمان
-- التأكد من أن RLS مفعل على جميع الجداول المهمة
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_product_permissions ENABLE ROW LEVEL SECURITY;

-- 5. رسالة نجاح
DO $$
BEGIN
    RAISE NOTICE 'تم تنظيف النظام بنجاح! النظام الآن يستخدم نظام الأدوار والصلاحيات الموحد فقط.';
    RAISE NOTICE 'المدير العام (ryus) لديه جميع الصلاحيات';
    RAISE NOTICE 'تم حذف النظام القديم وجميع الأعمدة غير المستخدمة';
END $$;