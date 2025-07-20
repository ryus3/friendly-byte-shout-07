-- تصحيح مخزون المنتج السمائي الذي لم يتم تقليله من الفاتورة رقم 1
UPDATE public.inventory 
SET quantity = GREATEST(0, quantity - 1),
    updated_at = now()
WHERE variant_id = '9e2f5d0e-cd05-47d1-838e-b3d2edf503a7'
  AND product_id = '116ed0b0-72b1-4186-a5ba-09e319a9aee0';

-- إضافة ملاحظة في الجدول لتوثيق التصحيح
INSERT INTO public.financial_transactions (
  transaction_type,
  reference_type, 
  reference_id,
  amount,
  description,
  created_by,
  status,
  metadata
) VALUES (
  'inventory_correction',
  'manual_adjustment',
  '9e2f5d0e-cd05-47d1-838e-b3d2edf503a7',
  0,
  'تصحيح مخزون منتج سوت شيك سمائي 36 - تم تقليل كمية واحدة بسبب فاتورة رقم 1 المحذوفة',
  '91484496-b887-44f7-9e5d-be9db5567604',
  'completed',
  '{"reason": "delete_purchase_correction", "original_purchase": "1", "variant_sku": "RYUS-1752964267498-LPAJ"}'::jsonb
);