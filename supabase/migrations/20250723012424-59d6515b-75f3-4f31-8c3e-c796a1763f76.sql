-- حذف الحركات المكررة لفاتورة الشراء رقم 1
-- نحتفظ بأحدث حركة فقط ونحذف المكررات

-- حذف الحركات المكررة باستثناء الأحدث
DELETE FROM public.cash_movements 
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY reference_id, reference_type, movement_type 
      ORDER BY created_at DESC
    ) as rn
    FROM public.cash_movements 
    WHERE reference_type = 'purchase'
  ) t WHERE rn > 1
);

-- إظهار الحركات المتبقية لفاتورة 1 للتحقق
SELECT 
  cm.description,
  cm.amount,
  cm.created_at,
  p.purchase_number
FROM public.cash_movements cm
LEFT JOIN public.purchases p ON cm.reference_id = p.id
WHERE cm.reference_type = 'purchase'
AND p.purchase_number = '1'
ORDER BY cm.created_at;