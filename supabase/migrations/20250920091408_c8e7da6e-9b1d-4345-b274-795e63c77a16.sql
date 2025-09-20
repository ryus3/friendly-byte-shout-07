-- حذف الحركة الخاطئة +16,000 للطلب 98783797
DELETE FROM cash_movements 
WHERE id = '0ef0d4f3-9a32-4bd5-aa25-0fa7f81a2a1b'
  AND amount = 16000
  AND description = 'إيراد الطلب 98783797 (بدون رسوم التوصيل)';

-- تحديث رصيد القاصة الرئيسية (خصم 16000 المحذوف)
UPDATE cash_sources 
SET current_balance = current_balance - 16000,
    updated_at = now()
WHERE id = 'f70cfbb5-343a-4a2d-9e36-489beaf29392';