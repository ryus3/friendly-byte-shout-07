-- إنشاء جدول طلبات الذكاء الاصطناعي
CREATE TABLE IF NOT EXISTS public.ai_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_data JSONB NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'telegram', -- telegram, whatsapp, etc
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  created_by TEXT, -- telegram user id or employee code
  telegram_chat_id BIGINT,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE public.ai_orders ENABLE ROW LEVEL SECURITY;

-- إنشاء سياسات RLS
CREATE POLICY "Authenticated users can view ai orders" 
ON public.ai_orders 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage ai orders" 
ON public.ai_orders 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- إضافة فهرس للبحث السريع
CREATE INDEX idx_ai_orders_status ON public.ai_orders(status);
CREATE INDEX idx_ai_orders_source ON public.ai_orders(source);
CREATE INDEX idx_ai_orders_telegram_chat_id ON public.ai_orders(telegram_chat_id);
CREATE INDEX idx_ai_orders_created_by ON public.ai_orders(created_by);

-- دالة لمعالجة طلبات التليغرام
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_order_data JSONB,
  p_customer_name TEXT,
  p_customer_phone TEXT DEFAULT NULL,
  p_customer_address TEXT DEFAULT NULL,
  p_total_amount NUMERIC DEFAULT 0,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_telegram_chat_id BIGINT DEFAULT NULL,
  p_employee_code TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  order_id UUID;
BEGIN
  -- إدخال الطلب الجديد
  INSERT INTO public.ai_orders (
    order_data,
    customer_name,
    customer_phone,
    customer_address,
    total_amount,
    items,
    source,
    telegram_chat_id,
    created_by
  ) VALUES (
    p_order_data,
    p_customer_name,
    p_customer_phone,
    p_customer_address,
    p_total_amount,
    p_items,
    'telegram',
    p_telegram_chat_id,
    p_employee_code
  ) RETURNING id INTO order_id;

  -- إضافة إشعار للمراجعة
  INSERT INTO public.notifications (
    title,
    message,
    type,
    priority,
    data,
    user_id
  ) VALUES (
    'طلب ذكي جديد',
    'تم استلام طلب جديد من التليغرام يحتاج للمراجعة',
    'ai_order',
    'high',
    jsonb_build_object('order_id', order_id, 'source', 'telegram'),
    NULL -- إشعار عام لجميع المشرفين
  );

  RETURN order_id;
END;
$$;

-- دالة لتحديث حالة ربط التليغرام
CREATE OR REPLACE FUNCTION public.link_telegram_user(
  p_employee_code TEXT,
  p_telegram_chat_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_found BOOLEAN := FALSE;
BEGIN
  -- تحديث رمز الموظف بمعرف المحادثة
  UPDATE public.telegram_employee_codes 
  SET 
    telegram_chat_id = p_telegram_chat_id,
    linked_at = now(),
    updated_at = now()
  WHERE employee_code = p_employee_code AND is_active = true;
  
  GET DIAGNOSTICS user_found = FOUND;
  
  RETURN user_found;
END;
$$;

-- دالة للحصول على معلومات الموظف من رمز التليغرام
CREATE OR REPLACE FUNCTION public.get_employee_by_telegram_id(
  p_telegram_chat_id BIGINT
)
RETURNS TABLE(
  user_id UUID,
  employee_code TEXT,
  full_name TEXT,
  role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    tec.employee_code,
    p.full_name,
    p.role
  FROM public.telegram_employee_codes tec
  JOIN public.profiles p ON tec.user_id = p.user_id
  WHERE tec.telegram_chat_id = p_telegram_chat_id 
    AND tec.is_active = true
    AND p.is_active = true;
END;
$$;