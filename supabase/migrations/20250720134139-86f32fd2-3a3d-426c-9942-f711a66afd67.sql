-- إعادة ضبط رصيد القاصة الرئيسية لتعكس رأس المال + صافي الأرباح فقط
UPDATE cash_sources 
SET current_balance = (
    -- رأس المال الأساسي + الأرباح المحققة من الطلبات
    15000000 + COALESCE((
        SELECT SUM(
            -- سعر البيع - تكلفة المنتج = الربح الصافي للمنتج (بدون طرح المصاريف العامة)
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
)
WHERE name = 'القاصة الرئيسية';

-- إعادة ضبط الأرصدة الابتدائية للمصادر الأخرى
UPDATE cash_sources 
SET current_balance = initial_balance
WHERE name != 'القاصة الرئيسية';