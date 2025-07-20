-- إضافة رأس المال الصحيح (10 مليون) في الإعدادات
INSERT INTO public.settings (key, value, description) 
VALUES ('capital', '10000000', 'رأس المال الأساسي للشركة')
ON CONFLICT (key) DO UPDATE SET 
value = '10000000',
description = 'رأس المال الأساسي للشركة';

-- إعادة ضبط رصيد القاصة الرئيسية برأس المال الصحيح (10 مليون)
UPDATE cash_sources 
SET current_balance = (
    -- رأس المال الصحيح (10 مليون) + الأرباح المحققة
    10000000 + COALESCE((
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
),
initial_balance = 10000000
WHERE name = 'القاصة الرئيسية';