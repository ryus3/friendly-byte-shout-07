-- إضافة عمود related_order_id في ai_orders لتتبع الطلبات المرتبطة
ALTER TABLE public.ai_orders 
ADD COLUMN IF NOT EXISTS related_order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE;

-- إنشاء function لتنظيف الطلبات الذكية المتبقية تلقائياً
CREATE OR REPLACE FUNCTION cleanup_orphaned_ai_orders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- حذف الطلبات الذكية التي لديها related_order_id ولكن الطلب المرتبط لا يوجد
  WITH deleted AS (
    DELETE FROM public.ai_orders
    WHERE related_order_id IS NOT NULL 
    AND NOT EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = ai_orders.related_order_id
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  -- حذف الطلبات الذكية القديمة جداً (أكثر من 7 أيام) دون related_order_id
  WITH old_deleted AS (
    DELETE FROM public.ai_orders
    WHERE related_order_id IS NULL 
    AND created_at < now() - interval '7 days'
    RETURNING id
  )
  SELECT deleted_count + COUNT(*) INTO deleted_count FROM old_deleted;
  
  RETURN deleted_count;
END;
$$;

-- إنشاء trigger لحذف الطلبات الذكية تلقائياً عند حذف الطلب المرتبط
CREATE OR REPLACE FUNCTION auto_cleanup_ai_orders_on_order_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- حذف أي طلبات ذكية مرتبطة بالطلب المحذوف
  DELETE FROM public.ai_orders 
  WHERE related_order_id = OLD.id;
  
  RETURN OLD;
END;
$$;

-- ربط trigger بجدول orders (فقط إذا لم يكن موجود)
DROP TRIGGER IF EXISTS trigger_cleanup_ai_orders_on_order_delete ON public.orders;
CREATE TRIGGER trigger_cleanup_ai_orders_on_order_delete
  AFTER DELETE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_cleanup_ai_orders_on_order_delete();

-- function لحذف طلب ذكي محدد بشكل آمن مع تنظيف العلاقات
CREATE OR REPLACE FUNCTION delete_ai_order_safely(p_ai_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  order_exists BOOLEAN := FALSE;
BEGIN
  -- التحقق من وجود الطلب الذكي
  SELECT EXISTS(SELECT 1 FROM public.ai_orders WHERE id = p_ai_order_id) INTO order_exists;
  
  IF NOT order_exists THEN
    RETURN TRUE; -- الطلب غير موجود بالفعل
  END IF;
  
  -- حذف الطلب الذكي
  DELETE FROM public.ai_orders WHERE id = p_ai_order_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'فشل حذف الطلب الذكي %: %', p_ai_order_id, SQLERRM;
    RETURN FALSE;
END;
$$;