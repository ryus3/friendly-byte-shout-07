BEGIN;

-- 1) حذف حركات 5,000 (رسوم توصيل) المرتبطة بالطلب ORD000008 من القاصة الرئيسية
WITH main_source AS (
  SELECT id FROM public.cash_sources WHERE name = 'القاصة الرئيسية' ORDER BY created_at DESC LIMIT 1
), ord8 AS (
  SELECT id FROM public.orders WHERE order_number = 'ORD000008' OR tracking_number = '98713588' LIMIT 1
)
DELETE FROM public.cash_movements cm
USING main_source ms, ord8 o
WHERE cm.cash_source_id = ms.id
  AND cm.reference_id = o.id
  AND ABS(cm.amount) = 5000
  AND (cm.description ILIKE '%رسوم توصيل%' OR cm.description ILIKE '%delivery%');

-- 2) ضمان أن إيراد ORD000008 هو 21,000
WITH main_source AS (
  SELECT id FROM public.cash_sources WHERE name = 'القاصة الرئيسية' ORDER BY created_at DESC LIMIT 1
), ord8 AS (
  SELECT id FROM public.orders WHERE order_number = 'ORD000008' OR tracking_number = '98713588' LIMIT 1
)
UPDATE public.cash_movements cm
SET amount = 21000,
    description = COALESCE(NULLIF(cm.description, ''), 'إيراد من الطلب ORD000008 - 98713588')
FROM main_source ms, ord8 o
WHERE cm.cash_source_id = ms.id
  AND cm.reference_id = o.id
  AND cm.movement_type = 'in'
  AND cm.amount <> 21000;

-- 3) ترتيب حركتي RYUS-299923 بحيث الإيراد قبل مستحقات الموظف
DO $$
DECLARE
  v_main uuid;
  v_order uuid;
  v_rev_id uuid;
  v_dues_id uuid;
  t_rev timestamptz;
  t_dues timestamptz;
BEGIN
  SELECT id INTO v_main FROM public.cash_sources WHERE name = 'القاصة الرئيسية' ORDER BY created_at DESC LIMIT 1;
  SELECT id INTO v_order FROM public.orders WHERE tracking_number = 'RYUS-299923' OR order_number = 'ORD000005' LIMIT 1;

  IF v_main IS NULL OR v_order IS NULL THEN
    RAISE NOTICE 'لم يتم العثور على القاصة الرئيسية أو الطلب RYUS-299923؛ تجاوز ترتيب التوقيت';
  ELSE
    -- حركة الإيراد (+21,000)
    SELECT id, created_at INTO v_rev_id, t_rev
    FROM public.cash_movements
    WHERE cash_source_id = v_main AND reference_id = v_order AND movement_type = 'in' AND amount = 21000
    ORDER BY created_at ASC LIMIT 1;

    -- حركة مستحقات الموظف (-7,000)
    SELECT id, created_at INTO v_dues_id, t_dues
    FROM public.cash_movements
    WHERE cash_source_id = v_main AND reference_id = v_order AND movement_type = 'out' AND amount = 7000
    ORDER BY created_at ASC LIMIT 1;

    IF v_rev_id IS NOT NULL AND v_dues_id IS NOT NULL THEN
      IF t_rev >= t_dues THEN
        -- اجعل الإيراد يسبق المستحقات بثانيتين
        UPDATE public.cash_movements SET created_at = t_dues - interval '2 seconds' WHERE id = v_rev_id;
      END IF;
    END IF;
  END IF;
END $$;

-- 4) إعادة احتساب balance_before / balance_after لكل الحركات في القاصة الرئيسية من رأس مال 5,000,000
WITH main_source AS (
  SELECT id FROM public.cash_sources WHERE name = 'القاصة الرئيسية' ORDER BY created_at DESC LIMIT 1
), ordered AS (
  SELECT cm.id, cm.movement_type, cm.amount,
         ROW_NUMBER() OVER (ORDER BY cm.created_at ASC, cm.id ASC) AS rn
  FROM public.cash_movements cm, main_source ms
  WHERE cm.cash_source_id = ms.id
), recalc AS (
  SELECT id,
         5000000 + COALESCE(SUM(CASE WHEN movement_type = 'in' THEN amount ELSE -amount END)
                      OVER (ORDER BY rn ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS nbefore,
         5000000 + SUM(CASE WHEN movement_type = 'in' THEN amount ELSE -amount END)
                      OVER (ORDER BY rn ROWS UNBOUNDED PRECEDING) AS nafter
  FROM ordered
)
UPDATE public.cash_movements cm
SET balance_before = r.nbefore,
    balance_after  = r.nafter
FROM recalc r
WHERE cm.id = r.id;

COMMIT;