-- ✅ إصلاح المشكلة: إزالة الـ unique constraint القديم على external_id فقط
-- لأنه يمنع حفظ نفس رقم الفاتورة من حسابات مختلفة

-- حذف constraint القديم الذي يسبب التعارض
ALTER TABLE public.delivery_invoices 
DROP CONSTRAINT IF EXISTS delivery_invoices_external_id_key;

-- حذف الـ constraint المكرر أيضاً
ALTER TABLE public.delivery_invoices 
DROP CONSTRAINT IF EXISTS delivery_invoices_external_partner_key;

-- الإبقاء فقط على delivery_invoices_external_id_partner_key
-- الذي يسمح بنفس external_id مع partner مختلف

-- التأكد من وجود الـ constraint الصحيح (إذا غير موجود)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'delivery_invoices_external_id_partner_key'
    AND conrelid = 'public.delivery_invoices'::regclass
  ) THEN
    ALTER TABLE public.delivery_invoices 
    ADD CONSTRAINT delivery_invoices_external_id_partner_key 
    UNIQUE (external_id, partner);
  END IF;
END $$;