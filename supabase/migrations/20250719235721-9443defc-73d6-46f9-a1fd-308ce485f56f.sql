-- تنظيف بقايا المصاريف من الفواتير المحذوفة
DELETE FROM public.expenses 
WHERE receipt_number IN ('1-SHIP', '1-TRANSFER')
   OR (receipt_number = '1' AND category = 'شراء بضاعة');