-- تنظيف وتوحيد نظام الأدوار والصلاحيات - مصحح
-- المرحلة 1: التأكد من حساب المدير وترحيل البيانات

-- 1. التأكد من أن حساب المدير (ryus) له الدور المطلوب
DO $$
DECLARE
    admin_user_id UUID;
    super_admin_role_id UUID;
BEGIN
    -- العثور على معرف المستخدم ryus
    SELECT user_id INTO admin_user_id
    FROM public.profiles 
    WHERE username = 'ryus' 
    LIMIT 1;
    
    -- العثور على معرف دور super_admin
    SELECT id INTO super_admin_role_id
    FROM public.roles 
    WHERE name = 'super_admin' 
    LIMIT 1;
    
    -- إذا وُجد المستخدم والدور، تأكد من الربط
    IF admin_user_id IS NOT NULL AND super_admin_role_id IS NOT NULL THEN
        -- إدراج أو تحديث دور المدير
        INSERT INTO public.user_roles (user_id, role_id, is_active)
        VALUES (admin_user_id, super_admin_role_id, true)
        ON CONFLICT (user_id, role_id) 
        DO UPDATE SET is_active = true, assigned_at = now();
        
        -- التأكد من أن الملف الشخصي نشط
        UPDATE public.profiles 
        SET 
            is_active = true, 
            status = 'active',
            updated_at = now()
        WHERE user_id = admin_user_id;
        
        RAISE NOTICE 'تم تحديث حساب المدير ryus بنجاح';
    ELSE
        RAISE NOTICE 'لم يتم العثور على المستخدم أو الدور';
    END IF;
END $$;

-- 2. ترحيل المستخدمين من النظام القديم للجديد
DO $$
DECLARE
    user_record RECORD;
    sales_role_id UUID;
BEGIN
    -- العثور على معرف دور المبيعات
    SELECT id INTO sales_role_id
    FROM public.roles 
    WHERE name = 'sales_employee' 
    LIMIT 1;
    
    -- ترحيل المستخدمين الذين لا يملكون أدوار في النظام الجديد
    FOR user_record IN 
        SELECT p.user_id, p.username, p.permissions
        FROM public.profiles p
        LEFT JOIN public.user_roles ur ON p.user_id = ur.user_id AND ur.is_active = true
        WHERE ur.user_id IS NULL -- المستخدمين بدون أدوار في النظام الجديد
        AND p.username != 'ryus' -- تجاهل المدير
        AND p.is_active = true
    LOOP
        -- تعيين دور مبيعات افتراضي للمستخدمين الآخرين
        IF sales_role_id IS NOT NULL THEN
            INSERT INTO public.user_roles (user_id, role_id, is_active)
            VALUES (user_record.user_id, sales_role_id, true)
            ON CONFLICT (user_id, role_id) 
            DO UPDATE SET is_active = true, assigned_at = now();
            
            RAISE NOTICE 'تم ترحيل المستخدم: %', user_record.username;
        END IF;
    END LOOP;
END $$;

-- 3. ربط جميع الصلاحيات بدور المدير العام
DO $$
DECLARE
    super_admin_role_id UUID;
    perm_record RECORD;
BEGIN
    -- العثور على معرف دور المدير العام
    SELECT id INTO super_admin_role_id
    FROM public.roles 
    WHERE name = 'super_admin' 
    LIMIT 1;
    
    IF super_admin_role_id IS NOT NULL THEN
        -- ربط جميع الصلاحيات بدور المدير العام
        FOR perm_record IN 
            SELECT id as perm_id FROM public.permissions WHERE is_active = true
        LOOP
            INSERT INTO public.role_permissions (role_id, permission_id)
            VALUES (super_admin_role_id, perm_record.perm_id)
            ON CONFLICT (role_id, permission_id) DO NOTHING;
        END LOOP;
        
        RAISE NOTICE 'تم ربط جميع الصلاحيات بدور المدير العام';
    END IF;
END $$;