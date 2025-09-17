-- تنظيف الإشعارات المزعجة وحذف الدالة القديمة
-- حذف جميع إشعارات new_order المزعجة
DELETE FROM public.notifications 
WHERE type = 'new_order' 
AND message LIKE '%طلب رقم ORD%'
AND created_at >= now() - interval '30 days';

-- حذف الإشعارات المكررة الحديثة (آخر 7 أيام)
WITH ranked_notifications AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY type, message, user_id, 
           DATE_TRUNC('hour', created_at)
           ORDER BY created_at DESC
         ) as rn
  FROM public.notifications
  WHERE created_at > now() - interval '7 days'
)
DELETE FROM public.notifications 
WHERE id IN (
  SELECT id FROM ranked_notifications WHERE rn > 2
);

-- حذف الدالة القديمة إن وجدت
DROP FUNCTION IF EXISTS public.delete_ai_order_safe(uuid);

-- تحسين أداء استعلامات الإشعارات
CREATE INDEX IF NOT EXISTS idx_notifications_type_user_created 
ON public.notifications(type, user_id, created_at DESC);

-- تحسين أداء استعلامات الطلبات الذكية
CREATE INDEX IF NOT EXISTS idx_ai_orders_status_created 
ON public.ai_orders(status, created_at DESC);

-- تحسين أداء استعلامات cache المدن والمناطق
CREATE INDEX IF NOT EXISTS idx_cities_cache_active 
ON public.cities_cache(is_active, name);

CREATE INDEX IF NOT EXISTS idx_regions_cache_city_active 
ON public.regions_cache(city_id, is_active, name);