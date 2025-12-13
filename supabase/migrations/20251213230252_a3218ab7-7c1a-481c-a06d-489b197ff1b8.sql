
-- =====================================================
-- إعادة إنشاء جميع Triggers المفقودة - خطة شاملة
-- =====================================================

-- 1. حذف أي triggers موجودة لتجنب التعارض
DROP TRIGGER IF EXISTS trg_handle_order_status_change ON orders;
DROP TRIGGER IF EXISTS trg_auto_complete_zero_profit_orders ON orders;
DROP TRIGGER IF EXISTS trigger_auto_update_invoice_orders ON delivery_invoices;
DROP TRIGGER IF EXISTS trg_update_sold_on_partial ON order_items;
DROP TRIGGER IF EXISTS ensure_all_invoice_orders_received ON delivery_invoices;

-- =====================================================
-- 2. دالة تحديث المخزون عند تغيير حالة الطلب (4 أو 17)
-- =====================================================
CREATE OR REPLACE FUNCTION handle_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    inv_record RECORD;
BEGIN
    -- فقط عند تغيير delivery_status
    IF OLD.delivery_status IS DISTINCT FROM NEW.delivery_status THEN
        
        -- الحالة 4: تم التسليم - تحويل المحجوز إلى مباع
        IF NEW.delivery_status = '4' AND COALESCE(NEW.sold_recorded, false) = false THEN
            FOR item IN 
                SELECT oi.variant_id, oi.quantity, oi.product_id
                FROM order_items oi
                WHERE oi.order_id = NEW.id
                  AND COALESCE(oi.item_direction, 'outgoing') = 'outgoing'
                  AND COALESCE(oi.item_status, 'pending') != 'delivered'
            LOOP
                -- تحديث المخزون: quantity--, reserved--, sold++
                UPDATE inventory
                SET quantity = quantity - item.quantity,
                    reserved_quantity = GREATEST(0, reserved_quantity - item.quantity),
                    sold_quantity = COALESCE(sold_quantity, 0) + item.quantity,
                    updated_at = NOW()
                WHERE variant_id = item.variant_id;
                
                -- تسجيل في سجل العمليات
                SELECT i.*, pv.color_name, pv.size_value, p.name as product_name
                INTO inv_record
                FROM inventory i
                JOIN product_variants pv ON pv.id = i.variant_id
                JOIN products p ON p.id = i.product_id
                WHERE i.variant_id = item.variant_id;
                
                IF inv_record IS NOT NULL THEN
                    INSERT INTO inventory_operations_log (
                        product_id, variant_id, product_name, color_name, size_value,
                        operation_type, source_type, quantity_change,
                        stock_before, stock_after, reserved_before, reserved_after,
                        sold_before, sold_after, available_before, available_after,
                        order_id, tracking_number, notes
                    ) VALUES (
                        item.product_id, item.variant_id, inv_record.product_name,
                        inv_record.color_name, inv_record.size_value,
                        'sold', 'delivery_completed', item.quantity,
                        inv_record.quantity + item.quantity, inv_record.quantity,
                        inv_record.reserved_quantity + item.quantity, inv_record.reserved_quantity,
                        inv_record.sold_quantity - item.quantity, inv_record.sold_quantity,
                        (inv_record.quantity + item.quantity) - (inv_record.reserved_quantity + item.quantity),
                        inv_record.quantity - inv_record.reserved_quantity,
                        NEW.id, NEW.tracking_number, 'تم التسليم - تحويل محجوز إلى مباع'
                    );
                END IF;
            END LOOP;
            
            -- تحديث علامة sold_recorded
            NEW.sold_recorded := true;
        
        -- الحالة 17: إرجاع للتاجر - تحرير المحجوز فقط
        ELSIF NEW.delivery_status = '17' THEN
            FOR item IN 
                SELECT oi.variant_id, oi.quantity, oi.product_id
                FROM order_items oi
                WHERE oi.order_id = NEW.id
                  AND COALESCE(oi.item_direction, 'outgoing') = 'outgoing'
                  AND COALESCE(oi.item_status, 'pending') != 'delivered'
            LOOP
                -- تحديث المخزون: reserved-- فقط (المتاح يزداد تلقائياً)
                UPDATE inventory
                SET reserved_quantity = GREATEST(0, reserved_quantity - item.quantity),
                    updated_at = NOW()
                WHERE variant_id = item.variant_id;
                
                -- تسجيل في سجل العمليات
                SELECT i.*, pv.color_name, pv.size_value, p.name as product_name
                INTO inv_record
                FROM inventory i
                JOIN product_variants pv ON pv.id = i.variant_id
                JOIN products p ON p.id = i.product_id
                WHERE i.variant_id = item.variant_id;
                
                IF inv_record IS NOT NULL THEN
                    INSERT INTO inventory_operations_log (
                        product_id, variant_id, product_name, color_name, size_value,
                        operation_type, source_type, quantity_change,
                        stock_before, stock_after, reserved_before, reserved_after,
                        sold_before, sold_after, available_before, available_after,
                        order_id, tracking_number, notes
                    ) VALUES (
                        item.product_id, item.variant_id, inv_record.product_name,
                        inv_record.color_name, inv_record.size_value,
                        'return_to_stock', 'returned_to_merchant', item.quantity,
                        inv_record.quantity, inv_record.quantity,
                        inv_record.reserved_quantity + item.quantity, inv_record.reserved_quantity,
                        inv_record.sold_quantity, inv_record.sold_quantity,
                        inv_record.quantity - (inv_record.reserved_quantity + item.quantity),
                        inv_record.quantity - inv_record.reserved_quantity,
                        NEW.id, NEW.tracking_number, 'إرجاع للتاجر - تحرير المحجوز'
                    );
                END IF;
            END LOOP;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء الـ trigger
CREATE TRIGGER trg_handle_order_status_change
    BEFORE UPDATE OF delivery_status ON orders
    FOR EACH ROW
    EXECUTE FUNCTION handle_order_status_change();

-- =====================================================
-- 3. دالة تحويل الطلبات بدون مستحقات إلى completed
-- =====================================================
CREATE OR REPLACE FUNCTION auto_complete_zero_profit_orders()
RETURNS TRIGGER AS $$
BEGIN
    -- عند استلام الفاتورة
    IF NEW.receipt_received = true AND OLD.receipt_received IS DISTINCT FROM NEW.receipt_received THEN
        -- إذا لم يكن هناك ربح للموظف (لا يوجد سجل في profits أو الربح = 0)
        IF NOT EXISTS (
            SELECT 1 FROM profits 
            WHERE order_id = NEW.id 
            AND employee_profit > 0
        ) THEN
            -- تحويل الحالة إلى completed
            NEW.status := 'completed';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء الـ trigger
CREATE TRIGGER trg_auto_complete_zero_profit_orders
    BEFORE UPDATE OF receipt_received ON orders
    FOR EACH ROW
    EXECUTE FUNCTION auto_complete_zero_profit_orders();

-- =====================================================
-- 4. دالة ربط الفاتورة المستلمة بالطلبات تلقائياً
-- =====================================================
CREATE OR REPLACE FUNCTION auto_update_linked_orders_on_invoice_receipt()
RETURNS TRIGGER AS $$
BEGIN
    -- عند تغيير received من false إلى true
    IF NEW.received = true AND (OLD.received IS NULL OR OLD.received = false) THEN
        -- تحديث جميع الطلبات المرتبطة بهذه الفاتورة
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء الـ trigger
CREATE TRIGGER trigger_auto_update_invoice_orders
    AFTER UPDATE OF received ON delivery_invoices
    FOR EACH ROW
    EXECUTE FUNCTION auto_update_linked_orders_on_invoice_receipt();

-- =====================================================
-- 5. دالة تحديث المباع عند التسليم الجزئي
-- =====================================================
CREATE OR REPLACE FUNCTION update_sold_on_partial_delivery()
RETURNS TRIGGER AS $$
DECLARE
    inv_record RECORD;
    order_rec RECORD;
BEGIN
    -- فقط عند تغيير item_status إلى 'delivered'
    IF NEW.item_status = 'delivered' AND OLD.item_status IS DISTINCT FROM 'delivered' THEN
        -- التحقق من أن الطلب هو تسليم جزئي
        SELECT * INTO order_rec FROM orders WHERE id = NEW.order_id;
        
        IF order_rec.order_type = 'partial_delivery' OR order_rec.is_partial_delivery = true THEN
            -- تحديث المخزون: quantity--, reserved--, sold++
            UPDATE inventory
            SET quantity = quantity - NEW.quantity,
                reserved_quantity = GREATEST(0, reserved_quantity - NEW.quantity),
                sold_quantity = COALESCE(sold_quantity, 0) + NEW.quantity,
                updated_at = NOW()
            WHERE variant_id = NEW.variant_id;
            
            -- تسجيل في سجل العمليات
            SELECT i.*, pv.color_name, pv.size_value, p.name as product_name
            INTO inv_record
            FROM inventory i
            JOIN product_variants pv ON pv.id = i.variant_id
            JOIN products p ON p.id = i.product_id
            WHERE i.variant_id = NEW.variant_id;
            
            IF inv_record IS NOT NULL THEN
                INSERT INTO inventory_operations_log (
                    product_id, variant_id, product_name, color_name, size_value,
                    operation_type, source_type, quantity_change,
                    stock_before, stock_after, reserved_before, reserved_after,
                    sold_before, sold_after, available_before, available_after,
                    order_id, tracking_number, notes
                ) VALUES (
                    NEW.product_id, NEW.variant_id, inv_record.product_name,
                    inv_record.color_name, inv_record.size_value,
                    'sold', 'partial_delivery', NEW.quantity,
                    inv_record.quantity + NEW.quantity, inv_record.quantity,
                    inv_record.reserved_quantity + NEW.quantity, inv_record.reserved_quantity,
                    inv_record.sold_quantity - NEW.quantity, inv_record.sold_quantity,
                    (inv_record.quantity + NEW.quantity) - (inv_record.reserved_quantity + NEW.quantity),
                    inv_record.quantity - inv_record.reserved_quantity,
                    NEW.order_id, order_rec.tracking_number, 'تسليم جزئي - تحويل محجوز إلى مباع'
                );
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء الـ trigger
CREATE TRIGGER trg_update_sold_on_partial
    AFTER UPDATE OF item_status ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_sold_on_partial_delivery();

-- =====================================================
-- 6. إصلاح الطلبات الحالية في الفاتورة 2557196
-- =====================================================
-- تحويل الطلبات التي لا يوجد لها مستحقات موظف إلى completed
UPDATE orders o
SET status = 'completed', updated_at = NOW()
FROM delivery_invoice_orders dio
JOIN delivery_invoices di ON di.id = dio.invoice_id
WHERE dio.order_id = o.id
  AND di.external_id = '2557196'
  AND di.received = true
  AND o.receipt_received = true
  AND o.status != 'completed'
  AND NOT EXISTS (
      SELECT 1 FROM profits p 
      WHERE p.order_id = o.id 
      AND p.employee_profit > 0
  );

-- =====================================================
-- 7. التحقق من إنشاء جميع الـ Triggers
-- =====================================================
-- يمكن التحقق بتنفيذ:
-- SELECT trigger_name, event_manipulation, event_object_table 
-- FROM information_schema.triggers 
-- WHERE trigger_schema = 'public';
