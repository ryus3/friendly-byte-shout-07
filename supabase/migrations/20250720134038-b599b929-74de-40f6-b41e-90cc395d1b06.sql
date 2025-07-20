-- تنظيف الحركات المكررة للمصاريف
DELETE FROM cash_movements 
WHERE reference_type = 'expense' 
AND created_at IN (
    SELECT created_at
    FROM cash_movements 
    WHERE reference_type = 'expense'
    GROUP BY reference_id, amount, created_at
    HAVING COUNT(*) > 1
)
AND id NOT IN (
    SELECT id
    FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY reference_id, amount, created_at ORDER BY created_at) as rn
        FROM cash_movements 
        WHERE reference_type = 'expense'
    ) ranked
    WHERE rn = 1
);

-- تصفير المصاريف التشغيلية (الاحتفاظ بفئات النظام فقط)
DELETE FROM expenses 
WHERE expense_type != 'system';

-- حذف جميع الحركات النقدية للمصاريف
DELETE FROM cash_movements 
WHERE reference_type = 'expense';