
-- 1) فهرس لتسريع الفرز والحذف حسب المستخدم والزمن
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
  ON public.notifications (user_id, created_at DESC, id);

-- 2) دالة عامة لتنظيف الإشعارات بحيث تبقي آخر p_keep لكل مجموعة مستلمين
CREATE OR REPLACE FUNCTION public.prune_notifications_retention(p_keep integer DEFAULT 100)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_deleted integer := 0;
BEGIN
  WITH ranked AS (
    SELECT
      id,
      row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rn
    FROM public.notifications
  ),
  to_delete AS (
    SELECT id FROM ranked WHERE rn > p_keep
  )
  DELETE FROM public.notifications n
  USING to_delete d
  WHERE n.id = d.id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

-- 3) Trigger Function تُطبق الحدّ 100 مباشرة بعد كل INSERT لنفس مجموعة المستلمين
CREATE OR REPLACE FUNCTION public.enforce_notifications_retention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_keep integer := 100;
BEGIN
  -- نحصر التنظيف على نفس مجموعة المستلمين: user_id مطابق بما في ذلك NULL
  WITH ranked AS (
    SELECT
      id,
      row_number() OVER (ORDER BY created_at DESC, id DESC) AS rn
    FROM public.notifications
    WHERE user_id IS NOT DISTINCT FROM NEW.user_id
  ),
  to_delete AS (
    SELECT id FROM ranked WHERE rn > v_keep
  )
  DELETE FROM public.notifications n
  USING to_delete d
  WHERE n.id = d.id;

  RETURN NEW;
END;
$function$;

-- 4) إنشاء التريغر وضمان عدم التكرار
DROP TRIGGER IF EXISTS trg_enforce_notifications_retention ON public.notifications;

CREATE TRIGGER trg_enforce_notifications_retention
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.enforce_notifications_retention();

-- 5) تنظيف أولي الآن ليصبح الجدول ملتزماً مباشرة بالحدّ 100
SELECT public.prune_notifications_retention(100);
