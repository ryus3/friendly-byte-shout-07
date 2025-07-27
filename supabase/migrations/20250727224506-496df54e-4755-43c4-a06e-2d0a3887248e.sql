-- إصلاح مشكلة عدم حساب أرباح الموظفين - تحديث سجل الأرباح للطلب الموجود
UPDATE public.profits 
SET employee_profit = (
  SELECT 
    CASE 
      WHEN epr.rule_type = 'product' THEN 
        (SELECT COALESCE(SUM(oi.quantity), 0) * epr.profit_amount 
         FROM order_items oi 
         WHERE oi.order_id = 'a56f0048-20cc-48e3-a9f3-878d1d2f7aab')
      WHEN epr.rule_type = 'percentage' THEN 
        profits.profit_amount * (epr.profit_percentage / 100)
      WHEN epr.rule_type = 'fixed' THEN 
        epr.profit_amount
      ELSE 0
    END
  FROM employee_profit_rules epr
  WHERE epr.employee_id = 'fba59dfc-451c-4906-8882-ae4601ff34d4'
  AND epr.is_active = true
  ORDER BY 
    CASE 
      WHEN epr.rule_type = 'percentage' THEN 1
      WHEN epr.rule_type = 'fixed' THEN 2
      WHEN epr.rule_type = 'product' THEN 3
      ELSE 4
    END,
    epr.created_at DESC 
  LIMIT 1
),
updated_at = now()
WHERE order_id = 'a56f0048-20cc-48e3-a9f3-878d1d2f7aab';