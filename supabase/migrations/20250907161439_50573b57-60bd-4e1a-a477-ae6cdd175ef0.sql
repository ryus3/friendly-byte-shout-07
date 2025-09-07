-- إعادة احتساب أرباح الطلب المستهدف لضمان تطبيق قواعد الأرباح الحالية
SELECT public.calculate_order_profit_fixed_amounts('73e17a6f-85c7-4a1c-a793-d8f9303de037'::uuid);