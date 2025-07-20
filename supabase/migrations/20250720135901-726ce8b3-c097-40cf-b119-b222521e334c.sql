-- إعادة ضبط القاصة الرئيسية لتعكس رأس المال الصحيح + الأرباح المحققة فقط
WITH profit_calculation AS (
    SELECT COALESCE(SUM(
        (oi.unit_price * oi.quantity) - 
        (COALESCE(pv.cost_price, p.cost_price, 0) * oi.quantity)
    ), 0) as total_realized_profit
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN products p ON oi.product_id = p.id  
    LEFT JOIN product_variants pv ON oi.variant_id = pv.id
    WHERE o.receipt_received = true 
    AND o.status = 'delivered'
)
UPDATE cash_sources 
SET current_balance = 10000000 + (SELECT total_realized_profit FROM profit_calculation)
WHERE name = 'القاصة الرئيسية';

-- التأكد من أن رأس المال الابتدائي صحيح
UPDATE cash_sources 
SET initial_balance = 10000000
WHERE name = 'القاصة الرئيسية';