-- تنظيف وإعادة ضبط حركات النقد بالقيم الحقيقية

-- 1. حذف جميع الحركات الوهمية
DELETE FROM public.cash_movements WHERE cash_source_id = (
  SELECT id FROM public.cash_sources WHERE name = 'القاصة الرئيسية'
);

-- 2. إعادة ضبط القاصة الرئيسية بالرصيد الصحيح
UPDATE public.cash_sources 
SET 
  current_balance = 14992000, -- الرصيد الحقيقي (15 مليون + 21 ألف - 29 ألف)
  initial_balance = 15000000,
  updated_at = now()
WHERE name = 'القاصة الرئيسية';

-- 3. إضافة حركة رأس المال الحقيقية فقط
INSERT INTO public.cash_movements (
  cash_source_id,
  amount,
  movement_type,
  reference_type,
  reference_id,
  description,
  balance_before,
  balance_after,
  created_by,
  created_at
) VALUES (
  (SELECT id FROM public.cash_sources WHERE name = 'القاصة الرئيسية'),
  15000000,
  'in',
  'initial_capital',
  gen_random_uuid(),
  'رأس المال الابتدائي',
  0,
  15000000,
  (SELECT user_id FROM public.profiles WHERE is_active = true LIMIT 1),
  '2025-01-01 00:00:00'
);

-- 4. إضافة حركة الأرباح المحققة الحقيقية (إذا كانت موجودة)
DO $$
DECLARE
  real_profits NUMERIC;
  current_user_id UUID;
BEGIN
  -- حساب الأرباح الحقيقية من الطلبات
  SELECT COALESCE(SUM(
    o.final_amount - (
      SELECT COALESCE(SUM(oi.quantity * COALESCE(pv.cost_price, p.cost_price)), 0)
      FROM order_items oi 
      LEFT JOIN product_variants pv ON oi.variant_id = pv.id 
      LEFT JOIN products p ON oi.product_id = p.id 
      WHERE oi.order_id = o.id
    )
  ), 0) INTO real_profits
  FROM orders o 
  WHERE o.status = 'delivered' AND o.receipt_received = true;
  
  SELECT user_id INTO current_user_id FROM public.profiles WHERE is_active = true LIMIT 1;
  
  -- إذا كانت هناك أرباح حقيقية، أضفها
  IF real_profits > 0 THEN
    INSERT INTO public.cash_movements (
      cash_source_id,
      amount,
      movement_type,
      reference_type,
      reference_id,
      description,
      balance_before,
      balance_after,
      created_by,
      created_at
    ) VALUES (
      (SELECT id FROM public.cash_sources WHERE name = 'القاصة الرئيسية'),
      real_profits,
      'in',
      'realized_profit',
      gen_random_uuid(),
      'صافي الأرباح المحققة من المبيعات',
      15000000,
      15000000 + real_profits,
      current_user_id,
      now() - interval '1 day'
    );
  END IF;
  
  RAISE NOTICE 'الأرباح الحقيقية المحسوبة: %', real_profits;
END $$;

-- 5. إضافة حركة المشتريات (إذا كانت موجودة)
DO $$
DECLARE
  purchase_amount NUMERIC;
  current_balance NUMERIC;
  current_user_id UUID;
BEGIN
  -- حساب مجموع المشتريات المعتمدة
  SELECT COALESCE(SUM(total_amount), 0) INTO purchase_amount
  FROM purchases 
  WHERE status = 'approved';
  
  SELECT user_id INTO current_user_id FROM public.profiles WHERE is_active = true LIMIT 1;
  
  -- إذا كانت هناك مشتريات، أضفها
  IF purchase_amount > 0 THEN
    -- الحصول على الرصيد قبل المشتريات
    SELECT current_balance INTO current_balance FROM public.cash_sources WHERE name = 'القاصة الرئيسية';
    
    INSERT INTO public.cash_movements (
      cash_source_id,
      amount,
      movement_type,
      reference_type,
      reference_id,
      description,
      balance_before,
      balance_after,
      created_by,
      created_at
    ) VALUES (
      (SELECT id FROM public.cash_sources WHERE name = 'القاصة الرئيسية'),
      purchase_amount,
      'out',
      'purchase',
      (SELECT id FROM purchases WHERE status = 'approved' LIMIT 1),
      'إجمالي المشتريات المعتمدة',
      current_balance,
      current_balance - purchase_amount,
      current_user_id,
      now() - interval '12 hours'
    );
    
    -- تحديث الرصيد النهائي
    UPDATE public.cash_sources 
    SET current_balance = current_balance - purchase_amount
    WHERE name = 'القاصة الرئيسية';
  END IF;
  
  RAISE NOTICE 'مجموع المشتريات: %', purchase_amount;
END $$;