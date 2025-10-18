-- حذف validate_order_financial_logic trigger والـ function مع جميع التبعيات
-- هذا الـ trigger كان يمنع sales_amount من أن يكون مختلفاً عن total_amount
-- مما يمنع النظام من حساب الخصومات بشكل صحيح

DROP FUNCTION IF EXISTS public.validate_order_financial_logic() CASCADE;