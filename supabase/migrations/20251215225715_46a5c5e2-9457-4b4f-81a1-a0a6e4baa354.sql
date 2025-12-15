-- 1) حذف أرباح المدير العام الوهمية (لا يجب أن يكون له أرباح أصلاً)
DELETE FROM profits 
WHERE employee_id = '91484496-b887-44f7-9e5d-be9db5567604';

-- 2) حذف أرباح سارة احمد الخاطئة (فقط الأرباح > 0، تبقي سجلات 0)
DELETE FROM profits 
WHERE employee_id = 'f10d8ed9-24d3-45d6-a310-d45db5a747a0'
  AND employee_profit > 0;

-- 3) تعطيل وحذف trigger النسبة المئوية الخاطئ الذي يحسب 20%
DROP TRIGGER IF EXISTS auto_calculate_profit_on_receipt_trigger ON orders;
DROP TRIGGER IF EXISTS trigger_auto_calculate_profit_on_receipt ON orders;
DROP TRIGGER IF EXISTS auto_calculate_profit_on_receipt ON orders;
DROP FUNCTION IF EXISTS auto_calculate_profit_on_receipt() CASCADE;
DROP FUNCTION IF EXISTS public.auto_calculate_profit_on_receipt() CASCADE;