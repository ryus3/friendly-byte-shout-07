
-- محاولة ثانية: إنشاء الـ Triggers بطريقة مباشرة
-- التأكد من أن الـ functions موجودة أولاً

-- 1. تحديث المخزون عند تغيير حالة الطلب
CREATE OR REPLACE FUNCTION public.handle_order_status_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    item RECORD;
    inv_record RECORD;
BEGIN
    IF OLD.delivery_status IS DISTINCT FROM NEW.delivery_status THEN
        
        -- الحالة 4: تم التسليم
        IF NEW.delivery_status = '4' AND COALESCE(NEW.sold_recorded, false) = false THEN
            FOR item IN 
                SELECT oi.variant_id, oi.quantity, oi.product_id
                FROM order_items oi
                WHERE oi.order_id = NEW.id
                  AND COALESCE(oi.item_direction, 'outgoing') = 'outgoing'
                  AND COALESCE(oi.item_status, 'pending') != 'delivered'
            LOOP
                UPDATE inventory
                SET quantity = quantity - item.quantity,
                    reserved_quantity = GREATEST(0, reserved_quantity - item.quantity),
                    sold_quantity = COALESCE(sold_quantity, 0) + item.quantity,
                    updated_at = NOW()
                WHERE variant_id = item.variant_id;
            END LOOP;
            NEW.sold_recorded := true;
        
        -- الحالة 17: إرجاع للتاجر
        ELSIF NEW.delivery_status = '17' THEN
            FOR item IN 
                SELECT oi.variant_id, oi.quantity, oi.product_id
                FROM order_items oi
                WHERE oi.order_id = NEW.id
                  AND COALESCE(oi.item_direction, 'outgoing') = 'outgoing'
                  AND COALESCE(oi.item_status, 'pending') != 'delivered'
            LOOP
                UPDATE inventory
                SET reserved_quantity = GREATEST(0, reserved_quantity - item.quantity),
                    updated_at = NOW()
                WHERE variant_id = item.variant_id;
            END LOOP;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- 2. تحويل الطلبات بدون مستحقات إلى completed
CREATE OR REPLACE FUNCTION public.auto_complete_zero_profit_orders()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.receipt_received = true AND OLD.receipt_received IS DISTINCT FROM NEW.receipt_received THEN
        IF NOT EXISTS (
            SELECT 1 FROM profits 
            WHERE order_id = NEW.id 
            AND employee_profit > 0
        ) THEN
            NEW.status := 'completed';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- 3. ربط الفاتورة المستلمة بالطلبات
CREATE OR REPLACE FUNCTION public.auto_update_linked_orders_on_invoice_receipt()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.received = true AND (OLD.received IS NULL OR OLD.received = false) THEN
        UPDATE orders o
        SET 
            receipt_received = true,
            receipt_received_at = COALESCE(NEW.received_at, NOW()),
            updated_at = NOW()
        FROM delivery_invoice_orders dio
        WHERE dio.invoice_id = NEW.id
          AND dio.order_id = o.id
          AND o.receipt_received = false;
    END IF;
    
    RETURN NEW;
END;
$$;

-- 4. تحديث المباع عند التسليم الجزئي
CREATE OR REPLACE FUNCTION public.update_sold_on_partial_delivery()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    order_rec RECORD;
BEGIN
    IF NEW.item_status = 'delivered' AND OLD.item_status IS DISTINCT FROM 'delivered' THEN
        SELECT * INTO order_rec FROM orders WHERE id = NEW.order_id;
        
        IF order_rec.order_type = 'partial_delivery' OR order_rec.is_partial_delivery = true THEN
            UPDATE inventory
            SET quantity = quantity - NEW.quantity,
                reserved_quantity = GREATEST(0, reserved_quantity - NEW.quantity),
                sold_quantity = COALESCE(sold_quantity, 0) + NEW.quantity,
                updated_at = NOW()
            WHERE variant_id = NEW.variant_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- حذف الـ triggers القديمة إن وجدت
DROP TRIGGER IF EXISTS trg_handle_order_status_change ON orders;
DROP TRIGGER IF EXISTS trg_auto_complete_zero_profit_orders ON orders;
DROP TRIGGER IF EXISTS trigger_auto_update_invoice_orders ON delivery_invoices;
DROP TRIGGER IF EXISTS trg_update_sold_on_partial ON order_items;

-- إنشاء الـ triggers
CREATE TRIGGER trg_handle_order_status_change
    BEFORE UPDATE OF delivery_status ON orders
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_order_status_change();

CREATE TRIGGER trg_auto_complete_zero_profit_orders
    BEFORE UPDATE OF receipt_received ON orders
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_complete_zero_profit_orders();

CREATE TRIGGER trigger_auto_update_invoice_orders
    AFTER UPDATE OF received ON delivery_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_update_linked_orders_on_invoice_receipt();

CREATE TRIGGER trg_update_sold_on_partial
    AFTER UPDATE OF item_status ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_sold_on_partial_delivery();
