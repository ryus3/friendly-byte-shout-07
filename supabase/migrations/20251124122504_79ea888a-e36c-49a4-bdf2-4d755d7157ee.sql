-- =====================================================
-- نظام ولاء شخصي 100% - إصلاح شامل
-- كل موظف يرى عملاءه فقط (بما فيهم المدير)
-- =====================================================

-- 1. إضافة عمود created_by إلى customer_phone_loyalty
ALTER TABLE customer_phone_loyalty 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 2. Backfill created_by من أول طلب لكل رقم هاتف
UPDATE customer_phone_loyalty cpl
SET created_by = (
  SELECT o.created_by 
  FROM orders o
  WHERE o.customer_phone = cpl.phone_number 
     OR o.customer_phone = cpl.original_phone
  ORDER BY o.created_at ASC
  LIMIT 1
)
WHERE cpl.created_by IS NULL;

-- 3. حذف السجلات اليتيمة التي لا يوجد لها طلبات
DELETE FROM customer_phone_loyalty
WHERE created_by IS NULL;

-- 4. جعل created_by إلزامي
ALTER TABLE customer_phone_loyalty 
ALTER COLUMN created_by SET NOT NULL;

-- 5. حذف RLS Policies القديمة
DROP POLICY IF EXISTS "المستخدمون المصرح لهم يديرون ولاء" ON customer_phone_loyalty;

-- 6. تفعيل RLS
ALTER TABLE customer_phone_loyalty ENABLE ROW LEVEL SECURITY;

-- 7. سياسة SELECT - كل موظف يرى عملاءه فقط
CREATE POLICY "users_select_own_customers"
ON customer_phone_loyalty FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- 8. سياسة INSERT - إنشاء عملاء جدد
CREATE POLICY "users_insert_own_customers"
ON customer_phone_loyalty FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- 9. سياسة UPDATE - تحديث عملاءهم فقط
CREATE POLICY "users_update_own_customers"
ON customer_phone_loyalty FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- 10. دمج أي سجلات مكررة لنفس الهاتف + نفس المستخدم
WITH duplicates AS (
  SELECT 
    phone_number,
    created_by,
    (array_agg(id ORDER BY created_at ASC))[1] as keep_id,
    array_agg(id ORDER BY created_at ASC) as all_ids,
    SUM(total_points) as total_pts,
    SUM(total_spent) as total_spt,
    SUM(total_orders) as total_ords,
    MIN(first_order_date) as first_date,
    MAX(last_order_date) as last_date
  FROM customer_phone_loyalty
  GROUP BY phone_number, created_by
  HAVING COUNT(*) > 1
)
UPDATE customer_phone_loyalty cpl
SET 
  total_points = d.total_pts,
  total_spent = d.total_spt,
  total_orders = d.total_ords,
  first_order_date = d.first_date,
  last_order_date = d.last_date
FROM duplicates d
WHERE cpl.id = d.keep_id;

-- 11. حذف التكرارات
WITH duplicates AS (
  SELECT 
    phone_number,
    created_by,
    array_agg(id ORDER BY created_at ASC) as all_ids
  FROM customer_phone_loyalty
  GROUP BY phone_number, created_by
  HAVING COUNT(*) > 1
)
DELETE FROM customer_phone_loyalty cpl
USING duplicates d
WHERE cpl.phone_number = d.phone_number 
  AND cpl.created_by = d.created_by
  AND cpl.id = ANY(d.all_ids[2:]);

-- 12. UNIQUE INDEX لمنع التكرار
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_phone_loyalty_unique 
ON customer_phone_loyalty(phone_number, created_by);

-- 13. تحديث VIEW مع الأعمدة الصحيحة
DROP VIEW IF EXISTS customers_unified_loyalty;

CREATE VIEW customers_unified_loyalty 
WITH (security_invoker = true) AS
SELECT 
  cpl.id,
  cpl.phone_number,
  cpl.original_phone,
  cpl.customer_name,
  cpl.customer_city,
  cpl.customer_province,
  cpl.total_orders,
  cpl.total_spent,
  cpl.total_points,
  cpl.current_tier_id,
  cpl.first_order_date,
  cpl.last_order_date,
  cpl.last_tier_upgrade,
  cpl.points_expiry_date,
  cpl.created_by,
  cpl.created_at,
  cpl.updated_at,
  lt.name as tier_name,
  lt.name_en as tier_name_en,
  lt.discount_percentage,
  lt.free_delivery_threshold,
  lt.points_expiry_months,
  lt.icon as tier_icon,
  lt.color as tier_color
FROM customer_phone_loyalty cpl
LEFT JOIN loyalty_tiers lt ON cpl.current_tier_id = lt.id;

GRANT SELECT ON customers_unified_loyalty TO authenticated;