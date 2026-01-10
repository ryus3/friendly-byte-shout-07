
-- ==========================================
-- إنشاء دالة لملء delivery_invoice_orders من الطلبات المحلية (بدون API)
-- ==========================================

-- دالة backfill: تملأ جدول delivery_invoice_orders من الطلبات المحلية التي لديها invoice_id
CREATE OR REPLACE FUNCTION public.backfill_delivery_invoice_orders_from_orders(p_partner text DEFAULT 'alwaseet')
RETURNS TABLE(
  orders_processed int,
  links_created int,
  links_updated int
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orders_processed int := 0;
  v_links_created int := 0;
  v_links_updated int := 0;
BEGIN
  -- إدراج/تحديث روابط من الطلبات المحلية التي لديها delivery_partner_invoice_id
  WITH orders_to_link AS (
    SELECT 
      o.id as order_id,
      o.delivery_partner_order_id,
      o.delivery_partner_invoice_id,
      o.created_by,
      o.final_amount,
      di.id as invoice_uuid
    FROM orders o
    INNER JOIN delivery_invoices di 
      ON di.external_id = o.delivery_partner_invoice_id 
      AND di.partner = p_partner
    WHERE o.delivery_partner_invoice_id IS NOT NULL
      AND o.delivery_partner_invoice_id != ''
      AND o.delivery_partner_order_id IS NOT NULL
      AND o.delivery_partner_order_id != ''
  ),
  upserted AS (
    INSERT INTO delivery_invoice_orders (
      invoice_id,
      external_order_id,
      order_id,
      owner_user_id,
      amount,
      raw,
      status
    )
    SELECT 
      otl.invoice_uuid,
      otl.delivery_partner_order_id,
      otl.order_id,
      otl.created_by,
      otl.final_amount,
      jsonb_build_object('source', 'local_backfill', 'order_id', otl.order_id),
      'linked'
    FROM orders_to_link otl
    ON CONFLICT (invoice_id, external_order_id) 
    DO UPDATE SET
      order_id = COALESCE(delivery_invoice_orders.order_id, EXCLUDED.order_id),
      owner_user_id = COALESCE(delivery_invoice_orders.owner_user_id, EXCLUDED.owner_user_id),
      updated_at = now()
    WHERE delivery_invoice_orders.order_id IS NULL
    RETURNING 
      CASE WHEN xmax = 0 THEN 'insert' ELSE 'update' END as operation
  )
  SELECT 
    COUNT(*) FILTER (WHERE operation = 'insert'),
    COUNT(*) FILTER (WHERE operation = 'update')
  INTO v_links_created, v_links_updated
  FROM upserted;

  -- حساب عدد الطلبات المعالجة
  SELECT COUNT(DISTINCT o.id) INTO v_orders_processed
  FROM orders o
  INNER JOIN delivery_invoices di 
    ON di.external_id = o.delivery_partner_invoice_id 
    AND di.partner = p_partner
  WHERE o.delivery_partner_invoice_id IS NOT NULL
    AND o.delivery_partner_invoice_id != ''
    AND o.delivery_partner_order_id IS NOT NULL;

  RETURN QUERY SELECT v_orders_processed, v_links_created, v_links_updated;
END;
$$;

-- ==========================================
-- Trigger: ربط الطلبات تلقائياً عند إضافة/تحديث delivery_partner_invoice_id
-- ==========================================

CREATE OR REPLACE FUNCTION public.auto_link_order_to_invoice()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_uuid uuid;
BEGIN
  -- تجاهل إذا لم يكن هناك invoice_id أو order_id
  IF NEW.delivery_partner_invoice_id IS NULL OR NEW.delivery_partner_invoice_id = '' THEN
    RETURN NEW;
  END IF;
  
  IF NEW.delivery_partner_order_id IS NULL OR NEW.delivery_partner_order_id = '' THEN
    RETURN NEW;
  END IF;

  -- البحث عن الفاتورة
  SELECT id INTO v_invoice_uuid
  FROM delivery_invoices
  WHERE external_id = NEW.delivery_partner_invoice_id
    AND partner = 'alwaseet'
  LIMIT 1;

  -- إذا وجدت الفاتورة، أنشئ الرابط
  IF v_invoice_uuid IS NOT NULL THEN
    INSERT INTO delivery_invoice_orders (
      invoice_id,
      external_order_id,
      order_id,
      owner_user_id,
      amount,
      raw,
      status
    )
    VALUES (
      v_invoice_uuid,
      NEW.delivery_partner_order_id,
      NEW.id,
      NEW.created_by,
      NEW.final_amount,
      jsonb_build_object('source', 'auto_trigger', 'order_id', NEW.id),
      'linked'
    )
    ON CONFLICT (invoice_id, external_order_id) 
    DO UPDATE SET
      order_id = COALESCE(delivery_invoice_orders.order_id, EXCLUDED.order_id),
      owner_user_id = COALESCE(delivery_invoice_orders.owner_user_id, EXCLUDED.owner_user_id),
      updated_at = now();
      
    -- أيضاً تحديث delivery_partner_invoice_id في الطلب نفسه إذا لم يكن موجوداً
    UPDATE orders 
    SET delivery_partner_invoice_id = NEW.delivery_partner_invoice_id
    WHERE id = NEW.id 
      AND (delivery_partner_invoice_id IS NULL OR delivery_partner_invoice_id = '');
  END IF;

  RETURN NEW;
END;
$$;

-- حذف الـ trigger القديم إن وجد
DROP TRIGGER IF EXISTS trg_auto_link_order_to_invoice ON orders;

-- إنشاء الـ trigger الجديد
CREATE TRIGGER trg_auto_link_order_to_invoice
  AFTER INSERT OR UPDATE OF delivery_partner_invoice_id, delivery_partner_order_id
  ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_order_to_invoice();

-- ==========================================
-- تشغيل backfill لمرة واحدة على الطلبات الحالية
-- ==========================================
SELECT * FROM backfill_delivery_invoice_orders_from_orders('alwaseet');

-- ==========================================
-- تشغيل الربط والمصالحة
-- ==========================================
SELECT * FROM link_invoice_orders_to_orders();
SELECT * FROM reconcile_invoice_receipts();
