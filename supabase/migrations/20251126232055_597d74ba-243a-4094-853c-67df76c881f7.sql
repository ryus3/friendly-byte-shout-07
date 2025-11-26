-- Migration: Clean up redundant triggers on delivery_invoices
-- Description: Remove 3 duplicate triggers and keep only trigger_auto_update_invoice_orders
-- Reason: Multiple triggers firing simultaneously caused timestamp conflicts and used incorrect NOW() instead of invoice received_at

-- Drop the 3 redundant triggers that use propagate_invoice_received_to_orders
DROP TRIGGER IF EXISTS trg_invoice_received_propagation ON delivery_invoices;
DROP TRIGGER IF EXISTS trg_propagate_invoice_received ON delivery_invoices;
DROP TRIGGER IF EXISTS trg_propagate_invoice_received_to_orders ON delivery_invoices;

-- Drop the old propagate function since it's no longer needed and uses incorrect NOW()
DROP FUNCTION IF EXISTS propagate_invoice_received_to_orders();

-- Keep only trigger_auto_update_invoice_orders which correctly uses:
-- COALESCE(NEW.received_at, NOW()) for receipt_received_at

-- Verify final state (for documentation)
COMMENT ON TRIGGER trigger_auto_update_invoice_orders ON delivery_invoices IS 
'الوحيد المسؤول عن تحديث الطلبات المرتبطة - يستخدم received_at من الفاتورة بشكل صحيح';

COMMENT ON FUNCTION auto_update_linked_orders_on_invoice_receipt() IS 
'دالة موحدة لتحديث الطلبات المرتبطة عند استلام الفاتورة - تستخدم COALESCE(NEW.received_at, NOW())';