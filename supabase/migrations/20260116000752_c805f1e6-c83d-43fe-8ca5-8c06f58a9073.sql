-- تعطيل النسخة القديمة المتعارضة بإعادة تسميتها (وليس حذفها)
-- هذا يحل مشكلة "Could not choose a best candidate function"

ALTER FUNCTION public.upsert_alwaseet_invoice_list(jsonb, uuid) 
RENAME TO upsert_alwaseet_invoice_list_OLD_DISABLED;

-- إضافة تعليق توضيحي
COMMENT ON FUNCTION public.upsert_alwaseet_invoice_list_OLD_DISABLED(jsonb, uuid) 
IS 'معطلة - تم تعطيلها بسبب تعارض مع النسخة الجديدة. النسخة الصحيحة هي upsert_alwaseet_invoice_list(jsonb)';