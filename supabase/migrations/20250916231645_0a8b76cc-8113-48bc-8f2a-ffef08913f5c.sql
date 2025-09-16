-- إصلاح إعدادات Real-time لجدول ai_orders
-- التأكد من REPLICA IDENTITY للحصول على البيانات الكاملة عند التحديث
ALTER TABLE public.ai_orders REPLICA IDENTITY FULL;

-- إضافة الجدول إلى نشر supabase_realtime لتفعيل Real-time
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_orders;

-- إنشاء إشعارات للطلبات الحديثة التي لم تحصل على إشعارات (آخر 24 ساعة)
INSERT INTO public.notifications (type, title, message, user_id, data, priority, is_read)
SELECT 
  'new_ai_order' as type,
  CONCAT('طلب ذكي جديد - ', ao.customer_name) as title,
  CONCAT('تم إنشاء طلب ذكي جديد من ', ao.customer_name, ' بقيمة ', ao.total_amount::text, ' دينار') as message,
  p.user_id as user_id,
  jsonb_build_object(
    'ai_order_id', ao.id,
    'customer_name', ao.customer_name,
    'total_amount', ao.total_amount,
    'source', ao.source,
    'created_by', ao.created_by
  ) as data,
  'high' as priority,
  false as is_read
FROM public.ai_orders ao
JOIN public.profiles p ON p.employee_code = ao.created_by
LEFT JOIN public.notifications n ON n.type = 'new_ai_order' 
  AND (n.data->>'ai_order_id')::uuid = ao.id 
  AND n.user_id = p.user_id
WHERE ao.created_at >= now() - interval '24 hours'
  AND n.id IS NULL;

-- إنشاء إشعارات عامة للمديرين للطلبات الحديثة
INSERT INTO public.notifications (type, title, message, user_id, data, priority, is_read)
SELECT 
  'new_ai_order' as type,
  CONCAT('طلب ذكي جديد - ', ao.customer_name) as title,
  CONCAT('طلب ذكي جديد من الموظف ', ao.created_by, ' - ', ao.customer_name, ' بقيمة ', ao.total_amount::text, ' دينار') as message,
  NULL as user_id,
  jsonb_build_object(
    'ai_order_id', ao.id,
    'customer_name', ao.customer_name,
    'total_amount', ao.total_amount,
    'source', ao.source,
    'created_by', ao.created_by,
    'employee_name', COALESCE(p.full_name, ao.created_by)
  ) as data,
  'high' as priority,
  false as is_read
FROM public.ai_orders ao
LEFT JOIN public.profiles p ON p.employee_code = ao.created_by
LEFT JOIN public.notifications n ON n.type = 'new_ai_order' 
  AND (n.data->>'ai_order_id')::uuid = ao.id 
  AND n.user_id IS NULL
WHERE ao.created_at >= now() - interval '24 hours'
  AND n.id IS NULL;