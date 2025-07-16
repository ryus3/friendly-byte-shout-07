-- ================================
-- نظام إدارة الأدوار والصلاحيات الموحد
-- ================================

-- 1. جدول الأدوار الرئيسية
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    hierarchy_level INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. جدول الصلاحيات الرئيسية
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. جدول ربط الأدوار بالصلاحيات
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(role_id, permission_id)
);

-- 4. جدول أدوار المستخدمين (متعدد الأدوار)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES public.profiles(user_id),
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(user_id, role_id)
);

-- 5. جدول صلاحيات المنتجات المتقدمة
CREATE TABLE IF NOT EXISTS public.user_product_permissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    permission_type TEXT NOT NULL, -- 'category', 'department', 'color', 'size', 'product_type', 'season_occasion'
    allowed_items JSONB NOT NULL DEFAULT '[]'::jsonb, -- قائمة المعرفات المسموحة
    has_full_access BOOLEAN NOT NULL DEFAULT false, -- هل له صلاحية كاملة
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, permission_type)
);

-- ================================
-- النظام المالي والمحاسبي الموحد
-- ================================

-- 6. جدول المعاملات المالية الرئيسي
CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_type TEXT NOT NULL, -- 'sale', 'expense', 'profit_settlement', 'refund', 'adjustment'
    reference_type TEXT NOT NULL, -- 'order', 'purchase', 'settlement', 'manual'
    reference_id UUID, -- معرف الطلب أو المرجع
    amount DECIMAL(15,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'IQD',
    description TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(user_id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'completed', -- 'pending', 'completed', 'cancelled'
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 7. جدول طلبات التحاسب المتقدمة
CREATE TABLE IF NOT EXISTS public.settlement_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    request_type TEXT NOT NULL DEFAULT 'profit_settlement', -- 'profit_settlement', 'expense_reimbursement'
    total_amount DECIMAL(15,2) NOT NULL,
    requested_amount DECIMAL(15,2) NOT NULL,
    approved_amount DECIMAL(15,2),
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'paid'
    request_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    order_ids UUID[] DEFAULT '{}', -- قائمة الطلبات المطلوب تحاسبها
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES public.profiles(user_id),
    review_notes TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    paid_by UUID REFERENCES public.profiles(user_id)
);

-- 8. جدول المصاريف التفصيلية
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    expense_type TEXT NOT NULL, -- 'operational', 'marketing', 'delivery', 'salary', 'other'
    category TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    description TEXT NOT NULL,
    receipt_number TEXT,
    vendor_name TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(user_id),
    approved_by UUID REFERENCES public.profiles(user_id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    approved_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    attachments TEXT[], -- روابط المرفقات
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 9. جدول أكواد التليغرام للموظفين
CREATE TABLE IF NOT EXISTS public.employee_telegram_codes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE UNIQUE,
    telegram_code TEXT NOT NULL UNIQUE,
    telegram_chat_id BIGINT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    linked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 10. جدول حسابات شركات التوصيل
CREATE TABLE IF NOT EXISTS public.employee_delivery_accounts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    delivery_partner TEXT NOT NULL, -- 'express', 'aramex', 'dhl', etc.
    account_code TEXT NOT NULL,
    account_name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    partner_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, delivery_partner)
);

-- ================================
-- إنشاء الفهارس لتحسين الأداء
-- ================================

-- فهارس الأدوار والصلاحيات
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);

-- فهارس المعاملات المالية
CREATE INDEX IF NOT EXISTS idx_financial_transactions_type ON public.financial_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_reference ON public.financial_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_created_by ON public.financial_transactions(created_by);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_date ON public.financial_transactions(created_at);

-- فهارس طلبات التحاسب
CREATE INDEX IF NOT EXISTS idx_settlement_requests_employee ON public.settlement_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_settlement_requests_status ON public.settlement_requests(status);

-- فهارس أكواد التليغرام
CREATE INDEX IF NOT EXISTS idx_telegram_codes_user ON public.employee_telegram_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_codes_chat ON public.employee_telegram_codes(telegram_chat_id);

-- ================================
-- تمكين Row Level Security
-- ================================

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_product_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_telegram_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_delivery_accounts ENABLE ROW LEVEL SECURITY;

-- ================================
-- إنشاء السياسات الأمنية
-- ================================

-- سياسات الأدوار والصلاحيات
CREATE POLICY "المديرون يديرون الأدوار والصلاحيات" ON public.roles FOR ALL USING (public.is_admin_or_deputy());
CREATE POLICY "الجميع يرى الأدوار النشطة" ON public.roles FOR SELECT USING (is_active = true);

CREATE POLICY "المديرون يديرون الصلاحيات" ON public.permissions FOR ALL USING (public.is_admin_or_deputy());
CREATE POLICY "الجميع يرى الصلاحيات النشطة" ON public.permissions FOR SELECT USING (is_active = true);

-- سياسات المعاملات المالية
CREATE POLICY "المستخدمون يرون معاملاتهم المالية" ON public.financial_transactions 
FOR SELECT USING (created_by = auth.uid() OR public.is_admin_or_deputy());

CREATE POLICY "المديرون يديرون المعاملات المالية" ON public.financial_transactions 
FOR ALL USING (public.is_admin_or_deputy());

-- سياسات طلبات التحاسب
CREATE POLICY "الموظفون يرون طلبات التحاسب الخاصة بهم" ON public.settlement_requests 
FOR SELECT USING (employee_id = auth.uid() OR public.is_admin_or_deputy());

CREATE POLICY "الموظفون ينشئون طلبات التحاسب" ON public.settlement_requests 
FOR INSERT WITH CHECK (employee_id = auth.uid());

CREATE POLICY "المديرون يراجعون طلبات التحاسب" ON public.settlement_requests 
FOR UPDATE USING (public.is_admin_or_deputy());

-- ================================
-- إدراج البيانات الأساسية
-- ================================

-- إنشاء الأدوار الأساسية
INSERT INTO public.roles (name, display_name, description, hierarchy_level) VALUES
('super_admin', 'المدير العام', 'صلاحيات كاملة على النظام', 1),
('department_manager', 'مدير القسم', 'إدارة قسم معين وموظفيه', 2),
('sales_employee', 'موظف مبيعات', 'موظف مبيعات متخصص', 3),
('warehouse_employee', 'موظف مخزن', 'موظف مخزن متخصص', 3),
('cashier', 'كاشير', 'موظف محاسبة وكاشير', 3),
('delivery_coordinator', 'منسق توصيل', 'منسق التوصيل والشحن', 3)
ON CONFLICT (name) DO NOTHING;

-- إنشاء الصلاحيات الأساسية
INSERT INTO public.permissions (name, display_name, category) VALUES
-- صلاحيات الصفحات
('view_dashboard', 'عرض لوحة التحكم', 'pages'),
('view_products', 'عرض المنتجات', 'pages'),
('view_orders', 'عرض الطلبات', 'pages'),
('view_inventory', 'عرض المخزون', 'pages'),
('view_accounting', 'عرض المحاسبة', 'pages'),
-- صلاحيات الإدارة
('manage_employees', 'إدارة الموظفين', 'management'),
('manage_products', 'إدارة المنتجات', 'management'),
('manage_orders', 'إدارة الطلبات', 'management'),
('manage_finances', 'إدارة الأمور المالية', 'management'),
-- صلاحيات البيانات
('view_all_data', 'رؤية جميع البيانات', 'data'),
('view_own_data', 'رؤية البيانات الشخصية فقط', 'data'),
('export_data', 'تصدير البيانات', 'data')
ON CONFLICT (name) DO NOTHING;