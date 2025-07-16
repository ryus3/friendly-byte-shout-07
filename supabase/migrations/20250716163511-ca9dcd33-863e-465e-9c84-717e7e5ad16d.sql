-- إضافة عمود لتحديد ما إذا كان المستخدم يمكنه رؤية شركات التوصيل
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS delivery_partner_access boolean DEFAULT true;

-- إضافة فهرس للبحث السريع حسب الدور
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- إضافة قيود للتأكد من أن القيم الافتراضية صحيحة
ALTER TABLE public.profiles 
ALTER COLUMN category_permissions SET DEFAULT '["all"]'::jsonb;

ALTER TABLE public.profiles 
ALTER COLUMN color_permissions SET DEFAULT '["all"]'::jsonb;

ALTER TABLE public.profiles 
ALTER COLUMN size_permissions SET DEFAULT '["all"]'::jsonb;

ALTER TABLE public.profiles 
ALTER COLUMN department_permissions SET DEFAULT '["all"]'::jsonb;

ALTER TABLE public.profiles 
ALTER COLUMN product_type_permissions SET DEFAULT '["all"]'::jsonb;

ALTER TABLE public.profiles 
ALTER COLUMN season_occasion_permissions SET DEFAULT '["all"]'::jsonb;

-- تحديث الصلاحيات للمدراء الحاليين
UPDATE public.profiles 
SET 
  category_permissions = '["all"]'::jsonb,
  color_permissions = '["all"]'::jsonb,
  size_permissions = '["all"]'::jsonb,
  department_permissions = '["all"]'::jsonb,
  product_type_permissions = '["all"]'::jsonb,
  season_occasion_permissions = '["all"]'::jsonb,
  delivery_partner_access = true
WHERE role = 'admin';

-- إنشاء دالة للتحقق من صلاحيات التصنيفات المتقدمة
CREATE OR REPLACE FUNCTION public.check_user_variant_permission(
  p_user_id UUID,
  p_permission_type TEXT,
  p_item_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_permissions JSONB;
  user_role TEXT;
BEGIN
  -- الحصول على صلاحيات المستخدم ودوره
  SELECT 
    CASE 
      WHEN p_permission_type = 'category' THEN category_permissions
      WHEN p_permission_type = 'color' THEN color_permissions
      WHEN p_permission_type = 'size' THEN size_permissions
      WHEN p_permission_type = 'department' THEN department_permissions
      WHEN p_permission_type = 'product_type' THEN product_type_permissions
      WHEN p_permission_type = 'season_occasion' THEN season_occasion_permissions
      ELSE '[]'::jsonb
    END,
    role
  INTO user_permissions, user_role
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  -- المدير يرى كل شيء
  IF user_role = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  -- إذا كانت الصلاحيات تحتوي على "all"
  IF user_permissions ? 'all' THEN
    RETURN TRUE;
  END IF;
  
  -- التحقق من وجود العنصر المحدد في الصلاحيات
  RETURN user_permissions ? p_item_id::text;
END;
$$;

-- إنشاء دالة لفلترة المنتجات حسب صلاحيات المستخدم
CREATE OR REPLACE FUNCTION public.filter_products_by_permissions(
  p_user_id UUID
) RETURNS TABLE(product_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- الحصول على دور المستخدم
  SELECT role INTO user_role
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  -- المدير يرى كل المنتجات
  IF user_role = 'admin' THEN
    RETURN QUERY
    SELECT p.id
    FROM public.products p
    WHERE p.is_active = true;
    RETURN;
  END IF;
  
  -- فلترة المنتجات حسب صلاحيات الموظف
  RETURN QUERY
  SELECT DISTINCT p.id
  FROM public.products p
  LEFT JOIN public.product_categories pc ON p.id = pc.product_id
  LEFT JOIN public.product_departments pd ON p.id = pd.product_id
  LEFT JOIN public.product_product_types ppt ON p.id = ppt.product_id
  LEFT JOIN public.product_seasons_occasions pso ON p.id = pso.product_id
  WHERE p.is_active = true
    AND (
      -- فحص صلاحيات التصنيفات
      pc.category_id IS NULL OR 
      public.check_user_variant_permission(p_user_id, 'category', pc.category_id)
    )
    AND (
      -- فحص صلاحيات الأقسام
      pd.department_id IS NULL OR 
      public.check_user_variant_permission(p_user_id, 'department', pd.department_id)
    )
    AND (
      -- فحص صلاحيات أنواع المنتجات
      ppt.product_type_id IS NULL OR 
      public.check_user_variant_permission(p_user_id, 'product_type', ppt.product_type_id)
    )
    AND (
      -- فحص صلاحيات المواسم والمناسبات
      pso.season_occasion_id IS NULL OR 
      public.check_user_variant_permission(p_user_id, 'season_occasion', pso.season_occasion_id)
    );
END;
$$;