-- ================================
-- الوظائف الذكية للنظام الموحد
-- ================================

-- 1. وظيفة التحقق من الصلاحيات المحدثة
CREATE OR REPLACE FUNCTION public.check_user_permission(
    p_user_id UUID,
    p_permission_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    has_permission BOOLEAN := FALSE;
BEGIN
    -- فحص إذا كان المستخدم له الصلاحية مباشرة عبر الأدوار
    SELECT EXISTS (
        SELECT 1 
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON ur.role_id = rp.role_id
        JOIN public.permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = p_user_id 
        AND p.name = p_permission_name
        AND ur.is_active = true
        AND p.is_active = true
    ) INTO has_permission;
    
    RETURN has_permission;
END;
$$;

-- 2. وظيفة الحصول على صلاحيات المنتجات للمستخدم
CREATE OR REPLACE FUNCTION public.get_user_product_access(
    p_user_id UUID,
    p_permission_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_permissions JSONB;
    has_full_access BOOLEAN;
BEGIN
    -- فحص الصلاحيات من جدول صلاحيات المنتجات
    SELECT 
        COALESCE(allowed_items, '[]'::jsonb),
        COALESCE(has_full_access, false)
    INTO 
        user_permissions,
        has_full_access
    FROM public.user_product_permissions 
    WHERE user_id = p_user_id 
    AND permission_type = p_permission_type;
    
    -- إذا لم توجد صلاحيات محددة، التحقق من الأدوار
    IF user_permissions IS NULL THEN
        -- فحص إذا كان المستخدم مدير
        IF public.check_user_permission(p_user_id, 'view_all_data') THEN
            has_full_access := true;
            user_permissions := '["all"]'::jsonb;
        ELSE
            user_permissions := '[]'::jsonb;
            has_full_access := false;
        END IF;
    END IF;
    
    RETURN jsonb_build_object(
        'allowed_items', user_permissions,
        'has_full_access', has_full_access
    );
END;
$$;

-- 3. وظيفة إنشاء كود تليغرام للموظف
CREATE OR REPLACE FUNCTION public.generate_employee_telegram_code(
    p_user_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_username TEXT;
    user_full_name TEXT;
    short_name TEXT;
    short_id TEXT;
    employee_code TEXT;
BEGIN
    -- الحصول على بيانات المستخدم
    SELECT username, full_name INTO user_username, user_full_name
    FROM public.profiles
    WHERE user_id = p_user_id;
    
    IF user_username IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير موجود';
    END IF;
    
    -- إنشاء الكود من أول 3 أحرف من الاسم + آخر 4 أرقام من المعرف
    short_name := UPPER(LEFT(COALESCE(user_full_name, user_username), 3));
    short_id := RIGHT(REPLACE(p_user_id::TEXT, '-', ''), 4);
    employee_code := short_name || short_id;
    
    -- إدراج أو تحديث الكود
    INSERT INTO public.employee_telegram_codes (user_id, telegram_code)
    VALUES (p_user_id, employee_code)
    ON CONFLICT (user_id) DO UPDATE SET
        telegram_code = EXCLUDED.telegram_code,
        updated_at = now();
    
    RETURN employee_code;
END;
$$;

-- 4. وظيفة حساب الأرباح الدقيقة للموظف
CREATE OR REPLACE FUNCTION public.calculate_employee_detailed_profit(
    p_employee_id UUID,
    p_order_id UUID
)
RETURNS DECIMAL(15,2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total_profit DECIMAL(15,2) := 0;
    order_record RECORD;
    item_record RECORD;
    employee_percentage DECIMAL(5,2) := 10; -- افتراضي 10%
BEGIN
    -- الحصول على تفاصيل الطلب
    SELECT * INTO order_record
    FROM public.orders
    WHERE id = p_order_id AND created_by = p_employee_id;
    
    IF order_record IS NULL THEN
        RETURN 0;
    END IF;
    
    -- تحديد نسبة الموظف حسب الدور
    SELECT 
        CASE 
            WHEN EXISTS (
                SELECT 1 FROM public.user_roles ur 
                JOIN public.roles r ON ur.role_id = r.id 
                WHERE ur.user_id = p_employee_id 
                AND r.name = 'super_admin'
            ) THEN 100.0
            WHEN EXISTS (
                SELECT 1 FROM public.user_roles ur 
                JOIN public.roles r ON ur.role_id = r.id 
                WHERE ur.user_id = p_employee_id 
                AND r.name = 'department_manager'
            ) THEN 15.0
            ELSE 10.0
        END
    INTO employee_percentage;
    
    -- حساب الربح لكل عنصر في الطلب
    FOR item_record IN 
        SELECT 
            oi.*,
            COALESCE(pv.cost_price, p.cost_price) as cost_price
        FROM public.order_items oi
        LEFT JOIN public.products p ON oi.product_id = p.id
        LEFT JOIN public.product_variants pv ON oi.variant_id = pv.id
        WHERE oi.order_id = p_order_id
    LOOP
        -- حساب الربح = (سعر البيع - سعر التكلفة) * الكمية * نسبة الموظف
        total_profit := total_profit + (
            (item_record.unit_price - item_record.cost_price) * 
            item_record.quantity * 
            (employee_percentage / 100.0)
        );
    END LOOP;
    
    RETURN GREATEST(total_profit, 0);
END;
$$;

-- 5. وظيفة إنشاء طلب تحاسب تلقائي
CREATE OR REPLACE FUNCTION public.create_auto_settlement_request(
    p_employee_id UUID,
    p_order_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    settlement_id UUID;
    total_profit DECIMAL(15,2) := 0;
    order_id UUID;
    order_profit DECIMAL(15,2);
BEGIN
    -- حساب إجمالي الأرباح للطلبات المحددة
    FOREACH order_id IN ARRAY p_order_ids
    LOOP
        SELECT public.calculate_employee_detailed_profit(p_employee_id, order_id)
        INTO order_profit;
        total_profit := total_profit + order_profit;
    END LOOP;
    
    -- إنشاء طلب التحاسب
    INSERT INTO public.settlement_requests (
        employee_id,
        total_amount,
        requested_amount,
        order_ids,
        request_details
    ) VALUES (
        p_employee_id,
        total_profit,
        total_profit,
        p_order_ids,
        jsonb_build_object(
            'auto_generated', true,
            'orders_count', array_length(p_order_ids, 1),
            'created_at', now()
        )
    ) RETURNING id INTO settlement_id;
    
    -- إنشاء معاملة مالية
    INSERT INTO public.financial_transactions (
        transaction_type,
        reference_type,
        reference_id,
        amount,
        description,
        created_by,
        status,
        metadata
    ) VALUES (
        'profit_settlement',
        'settlement',
        settlement_id,
        total_profit,
        'طلب تحاسب تلقائي للأرباح',
        p_employee_id,
        'pending',
        jsonb_build_object('settlement_id', settlement_id)
    );
    
    RETURN settlement_id;
END;
$$;

-- 6. وظيفة تحديث حالة طلب التحاسب
CREATE OR REPLACE FUNCTION public.update_settlement_status(
    p_settlement_id UUID,
    p_new_status TEXT,
    p_reviewer_id UUID,
    p_review_notes TEXT DEFAULT NULL,
    p_approved_amount DECIMAL(15,2) DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- تحديث طلب التحاسب
    UPDATE public.settlement_requests
    SET 
        status = p_new_status,
        reviewed_by = p_reviewer_id,
        reviewed_at = CASE WHEN p_new_status IN ('approved', 'rejected') THEN now() ELSE reviewed_at END,
        review_notes = p_review_notes,
        approved_amount = CASE WHEN p_new_status = 'approved' THEN COALESCE(p_approved_amount, requested_amount) ELSE approved_amount END,
        paid_at = CASE WHEN p_new_status = 'paid' THEN now() ELSE paid_at END,
        paid_by = CASE WHEN p_new_status = 'paid' THEN p_reviewer_id ELSE paid_by END
    WHERE id = p_settlement_id;
    
    -- تحديث المعاملة المالية المرتبطة
    UPDATE public.financial_transactions
    SET 
        status = CASE 
            WHEN p_new_status = 'approved' THEN 'completed'
            WHEN p_new_status = 'rejected' THEN 'cancelled'
            WHEN p_new_status = 'paid' THEN 'completed'
            ELSE status
        END,
        amount = CASE WHEN p_new_status = 'approved' AND p_approved_amount IS NOT NULL THEN p_approved_amount ELSE amount END
    WHERE reference_type = 'settlement' AND reference_id = p_settlement_id;
    
    RETURN FOUND;
END;
$$;

-- ================================
-- إضافة المزيد من السياسات الأمنية
-- ================================

-- سياسات جدول أدوار المستخدمين
CREATE POLICY "المديرون يديرون أدوار المستخدمين" ON public.user_roles 
FOR ALL USING (public.is_admin_or_deputy());

CREATE POLICY "المستخدمون يرون أدوارهم" ON public.user_roles 
FOR SELECT USING (user_id = auth.uid() OR public.is_admin_or_deputy());

-- سياسات صلاحيات المنتجات
CREATE POLICY "المديرون يديرون صلاحيات المنتجات" ON public.user_product_permissions 
FOR ALL USING (public.is_admin_or_deputy());

CREATE POLICY "المستخدمون يرون صلاحياتهم" ON public.user_product_permissions 
FOR SELECT USING (user_id = auth.uid() OR public.is_admin_or_deputy());

-- سياسات المصاريف
CREATE POLICY "المستخدمون ينشئون المصاريف" ON public.expenses 
FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "المستخدمون يرون مصاريفهم" ON public.expenses 
FOR SELECT USING (created_by = auth.uid() OR public.is_admin_or_deputy());

CREATE POLICY "المديرون يوافقون على المصاريف" ON public.expenses 
FOR UPDATE USING (public.is_admin_or_deputy());

-- سياسات أكواد التليغرام
CREATE POLICY "المستخدمون يديرون أكواد التليغرام الخاصة بهم" ON public.employee_telegram_codes 
FOR ALL USING (user_id = auth.uid() OR public.is_admin_or_deputy());

-- سياسات حسابات التوصيل
CREATE POLICY "المستخدمون يديرون حسابات التوصيل الخاصة بهم" ON public.employee_delivery_accounts 
FOR ALL USING (user_id = auth.uid() OR public.is_admin_or_deputy());