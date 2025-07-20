-- تنظيف الحركات المكررة للمصاريف
DELETE FROM cash_movements 
WHERE reference_type = 'expense' 
AND id NOT IN (
    SELECT MIN(id) 
    FROM cash_movements 
    WHERE reference_type = 'expense' 
    GROUP BY reference_id, amount, created_at
);

-- تصفير المصاريف التشغيلية (الاحتفاظ بفئات النظام فقط)
DELETE FROM expenses 
WHERE expense_type != 'system';

-- إعادة ضبط رصيد القاصة الرئيسية لرأس المال + الأرباح المحققة فقط
UPDATE cash_sources 
SET current_balance = (
    SELECT 
        -- رأس المال الأساسي
        15000000 + 
        -- الأرباح المحققة من الطلبات المُستلمة فقط (بدون طرح المصاريف العامة)
        COALESCE((
            SELECT SUM(
                (oi.unit_price * oi.quantity) - 
                (COALESCE(pv.cost_price, p.cost_price, 0) * oi.quantity)
            )
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.id  
            LEFT JOIN product_variants pv ON oi.variant_id = pv.id
            WHERE o.receipt_received = true 
            AND o.status = 'delivered'
        ), 0)
    FROM cash_sources cs WHERE cs.name = 'القاصة الرئيسية'
)
WHERE name = 'القاصة الرئيسية';