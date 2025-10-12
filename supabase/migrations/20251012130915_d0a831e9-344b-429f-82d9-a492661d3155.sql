-- تحسين نظام حذف الفواتير باستخدام CASCADE DELETE
-- هذا يضمن حذف جميع العناصر المرتبطة تلقائياً عند حذف الفاتورة

-- تعديل foreign key لـ purchase_items
ALTER TABLE purchase_items
DROP CONSTRAINT IF EXISTS purchase_items_purchase_id_fkey,
ADD CONSTRAINT purchase_items_purchase_id_fkey
  FOREIGN KEY (purchase_id) 
  REFERENCES purchases(id) 
  ON DELETE CASCADE;

-- تعديل foreign key لـ purchase_cost_history
ALTER TABLE purchase_cost_history
DROP CONSTRAINT IF EXISTS purchase_cost_history_purchase_id_fkey,
ADD CONSTRAINT purchase_cost_history_purchase_id_fkey
  FOREIGN KEY (purchase_id) 
  REFERENCES purchases(id) 
  ON DELETE CASCADE;

-- التأكد من أن trigger استعادة المخزون موجود ويعمل قبل CASCADE
-- هذا الـ trigger يعمل BEFORE DELETE لاستعادة الكميات قبل حذف العناصر
CREATE OR REPLACE FUNCTION restore_purchase_inventory_before_delete()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  -- استعادة الكميات للمخزون
  UPDATE product_variants pv
  SET 
    quantity = pv.quantity - pi.quantity_received,
    updated_at = now()
  FROM purchase_items pi
  WHERE pi.purchase_id = OLD.id
    AND pi.variant_id = pv.id
    AND pi.quantity_received > 0;

  RAISE NOTICE 'تم استعادة المخزون للفاتورة %', OLD.id;
  RETURN OLD;
END;
$$;

-- إنشاء trigger لاستعادة المخزون قبل الحذف
DROP TRIGGER IF EXISTS trigger_restore_inventory_before_delete ON purchases;
CREATE TRIGGER trigger_restore_inventory_before_delete
  BEFORE DELETE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION restore_purchase_inventory_before_delete();

-- ملاحظة: trigger استعادة الرصيد النقدي موجود مسبقاً (trigger_auto_delete_purchase_cash_movement)
-- CASCADE DELETE سيحذف purchase_items و purchase_cost_history تلقائياً
-- Triggers ستتعامل مع استعادة المخزون والرصيد النقدي