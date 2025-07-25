-- إضافة دالة لاختيار المدن العشوائية للخصومات الشهرية
CREATE OR REPLACE FUNCTION public.auto_select_monthly_city_discount()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  current_month INTEGER := EXTRACT(MONTH FROM now());
  current_year INTEGER := EXTRACT(YEAR FROM now());
BEGIN
  -- استدعاء الدالة الموجودة لاختيار المدينة
  PERFORM public.select_random_city_for_monthly_discount();
  
  -- إضافة تنبيه للمديرين
  INSERT INTO public.notifications (
    title,
    message,
    type,
    priority,
    data
  ) VALUES (
    'تم اختيار مدينة الخصم الشهري',
    'تم اختيار مدينة جديدة للحصول على خصم شهري تلقائياً',
    'city_discount_auto_selected',
    'high',
    jsonb_build_object('month', current_month, 'year', current_year)
  );
END;
$function$;

-- إضافة جدول لتتبع تقسيمات العملاء حسب المنتجات
CREATE TABLE public.customer_product_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id),
  department_id UUID REFERENCES public.departments(id),
  category_id UUID REFERENCES public.categories(id),
  product_type_id UUID REFERENCES public.product_types(id),
  gender_segment TEXT CHECK (gender_segment IN ('male', 'female', 'unisex')),
  purchase_count INTEGER DEFAULT 1,
  total_spent NUMERIC DEFAULT 0,
  last_purchase_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(customer_id, department_id, category_id, product_type_id)
);

-- تفعيل RLS لجدول تقسيمات العملاء
ALTER TABLE public.customer_product_segments ENABLE ROW LEVEL SECURITY;

-- سياسة لعرض وإدارة تقسيمات العملاء
CREATE POLICY "المستخدمون يديرون تقسيمات العملاء"
ON public.customer_product_segments
FOR ALL
USING (auth.uid() IS NOT NULL);

-- دالة لتحديث تقسيمات العملاء عند إكمال الطلب
CREATE OR REPLACE FUNCTION public.update_customer_segments_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  item_record RECORD;
  product_data RECORD;
  gender_seg TEXT;
BEGIN
  -- فقط عند إكمال الطلب
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- تحديث تقسيمات العميل لكل منتج في الطلب
    FOR item_record IN 
      SELECT oi.*, p.name as product_name
      FROM public.order_items oi
      JOIN public.products p ON oi.product_id = p.id
      WHERE oi.order_id = NEW.id
    LOOP
      -- الحصول على بيانات التصنيفات للمنتج
      SELECT 
        d.id as dept_id, d.name as dept_name,
        c.id as cat_id, c.name as cat_name,
        pt.id as ptype_id, pt.name as ptype_name
      INTO product_data
      FROM public.products p
      LEFT JOIN public.product_departments pd ON p.id = pd.product_id
      LEFT JOIN public.departments d ON pd.department_id = d.id
      LEFT JOIN public.product_categories pc ON p.id = pc.product_id
      LEFT JOIN public.categories c ON pc.category_id = c.id
      LEFT JOIN public.product_product_types ppt ON p.id = ppt.product_id
      LEFT JOIN public.product_types pt ON ppt.product_type_id = pt.id
      WHERE p.id = item_record.product_id
      LIMIT 1;
      
      -- تحديد الجنس بناءً على القسم أو التصنيف
      gender_seg := CASE 
        WHEN product_data.dept_name ILIKE '%نساء%' OR product_data.dept_name ILIKE '%نسائي%' THEN 'female'
        WHEN product_data.dept_name ILIKE '%رجال%' OR product_data.dept_name ILIKE '%رجالي%' THEN 'male'
        WHEN product_data.cat_name ILIKE '%نساء%' OR product_data.cat_name ILIKE '%نسائي%' THEN 'female'
        WHEN product_data.cat_name ILIKE '%رجال%' OR product_data.cat_name ILIKE '%رجالي%' THEN 'male'
        ELSE 'unisex'
      END;
      
      -- إدراج أو تحديث تقسيم العميل
      INSERT INTO public.customer_product_segments (
        customer_id,
        department_id,
        category_id,
        product_type_id,
        gender_segment,
        purchase_count,
        total_spent,
        last_purchase_date
      ) VALUES (
        NEW.customer_id,
        product_data.dept_id,
        product_data.cat_id,
        product_data.ptype_id,
        gender_seg,
        item_record.quantity,
        item_record.total_price,
        now()
      ) ON CONFLICT (customer_id, department_id, category_id, product_type_id)
      DO UPDATE SET
        purchase_count = customer_product_segments.purchase_count + item_record.quantity,
        total_spent = customer_product_segments.total_spent + item_record.total_price,
        last_purchase_date = now(),
        updated_at = now();
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- ربط الدالة بجدول الطلبات
CREATE TRIGGER update_customer_segments_trigger
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_customer_segments_on_order();

-- إضافة جدول لصلاحيات الولاء للموظفين
CREATE TABLE public.employee_loyalty_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  can_view_loyalty BOOLEAN DEFAULT false,
  can_apply_discounts BOOLEAN DEFAULT false,
  can_manage_points BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id)
);

-- تفعيل RLS لصلاحيات الولاء
ALTER TABLE public.employee_loyalty_permissions ENABLE ROW LEVEL SECURITY;

-- سياسة لعرض وإدارة صلاحيات الولاء
CREATE POLICY "المديرون يديرون صلاحيات الولاء"
ON public.employee_loyalty_permissions
FOR ALL
USING (is_admin_or_deputy());

CREATE POLICY "الموظفون يرون صلاحيات الولاء الخاصة بهم"
ON public.employee_loyalty_permissions
FOR SELECT
USING (user_id = auth.uid() OR is_admin_or_deputy());