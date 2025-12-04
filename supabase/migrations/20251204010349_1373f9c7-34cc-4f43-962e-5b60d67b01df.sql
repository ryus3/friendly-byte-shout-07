
-- ========================================
-- جدول سجل عمليات المخزون
-- ========================================
CREATE TABLE IF NOT EXISTS inventory_operations_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- معلومات المنتج
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT,
  color_name TEXT,
  size_value TEXT,
  
  -- نوع العملية
  operation_type TEXT NOT NULL CHECK (operation_type IN (
    'stock_added',      -- إضافة مخزون
    'stock_reduced',    -- تقليل مخزون
    'reserved',         -- حجز للطلب
    'released',         -- تحرير محجوز
    'sold',             -- تسجيل مبيع
    'returned',         -- إرجاع للمخزون
    'audit_correction', -- تصحيح من الفحص
    'manual_edit'       -- تعديل يدوي
  )),
  
  -- الكميات
  quantity_change INTEGER NOT NULL,
  quantity_before INTEGER,
  quantity_after INTEGER,
  reserved_before INTEGER,
  reserved_after INTEGER,
  sold_before INTEGER,
  sold_after INTEGER,
  
  -- مصدر التغيير
  source_type TEXT CHECK (source_type IN ('order', 'manual', 'audit', 'return', 'system')),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  tracking_number TEXT,
  
  -- من قام بالعملية
  performed_by UUID,
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- ملاحظات
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_inv_ops_log_variant ON inventory_operations_log(variant_id);
CREATE INDEX IF NOT EXISTS idx_inv_ops_log_product ON inventory_operations_log(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_ops_log_type ON inventory_operations_log(operation_type);
CREATE INDEX IF NOT EXISTS idx_inv_ops_log_date ON inventory_operations_log(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_ops_log_order ON inventory_operations_log(order_id);

-- تفعيل RLS
ALTER TABLE inventory_operations_log ENABLE ROW LEVEL SECURITY;

-- سياسة: المديرون يرون كل السجلات
CREATE POLICY "admins_view_all_inventory_logs" ON inventory_operations_log
  FOR SELECT USING (is_admin_or_deputy());

-- سياسة: النظام يسجل العمليات
CREATE POLICY "system_insert_inventory_logs" ON inventory_operations_log
  FOR INSERT WITH CHECK (true);

-- ========================================
-- Trigger لتسجيل تغييرات المخزون تلقائياً
-- ========================================
CREATE OR REPLACE FUNCTION log_inventory_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_product_name TEXT;
  v_color_name TEXT;
  v_size_value TEXT;
  v_operation_type TEXT;
  v_quantity_change INTEGER := 0;
BEGIN
  -- جلب معلومات المنتج
  SELECT p.name, c.name, s.name
  INTO v_product_name, v_color_name, v_size_value
  FROM product_variants pv
  LEFT JOIN products p ON pv.product_id = p.id
  LEFT JOIN colors c ON pv.color_id = c.id
  LEFT JOIN sizes s ON pv.size_id = s.id
  WHERE pv.id = NEW.variant_id;

  -- تحديد نوع العملية والتغيير
  IF OLD.quantity IS DISTINCT FROM NEW.quantity THEN
    IF NEW.quantity > OLD.quantity THEN
      v_operation_type := 'stock_added';
      v_quantity_change := NEW.quantity - OLD.quantity;
    ELSE
      v_operation_type := 'stock_reduced';
      v_quantity_change := OLD.quantity - NEW.quantity;
    END IF;
    
    INSERT INTO inventory_operations_log (
      variant_id, product_id, product_name, color_name, size_value,
      operation_type, quantity_change,
      quantity_before, quantity_after,
      reserved_before, reserved_after,
      sold_before, sold_after,
      source_type, notes
    ) VALUES (
      NEW.variant_id, NEW.product_id, v_product_name, v_color_name, v_size_value,
      v_operation_type, v_quantity_change,
      OLD.quantity, NEW.quantity,
      OLD.reserved_quantity, NEW.reserved_quantity,
      OLD.sold_quantity, NEW.sold_quantity,
      'system', 'تغيير تلقائي في المخزون'
    );
  END IF;

  -- تسجيل تغييرات المحجوز
  IF OLD.reserved_quantity IS DISTINCT FROM NEW.reserved_quantity THEN
    IF NEW.reserved_quantity > OLD.reserved_quantity THEN
      v_operation_type := 'reserved';
      v_quantity_change := NEW.reserved_quantity - OLD.reserved_quantity;
    ELSE
      v_operation_type := 'released';
      v_quantity_change := OLD.reserved_quantity - NEW.reserved_quantity;
    END IF;
    
    INSERT INTO inventory_operations_log (
      variant_id, product_id, product_name, color_name, size_value,
      operation_type, quantity_change,
      quantity_before, quantity_after,
      reserved_before, reserved_after,
      sold_before, sold_after,
      source_type, notes
    ) VALUES (
      NEW.variant_id, NEW.product_id, v_product_name, v_color_name, v_size_value,
      v_operation_type, v_quantity_change,
      OLD.quantity, NEW.quantity,
      OLD.reserved_quantity, NEW.reserved_quantity,
      OLD.sold_quantity, NEW.sold_quantity,
      'system', CASE WHEN v_operation_type = 'reserved' THEN 'حجز للطلب' ELSE 'تحرير محجوز' END
    );
  END IF;

  -- تسجيل تغييرات المباع
  IF OLD.sold_quantity IS DISTINCT FROM NEW.sold_quantity THEN
    IF NEW.sold_quantity > OLD.sold_quantity THEN
      v_operation_type := 'sold';
      v_quantity_change := NEW.sold_quantity - OLD.sold_quantity;
    ELSE
      v_operation_type := 'returned';
      v_quantity_change := OLD.sold_quantity - NEW.sold_quantity;
    END IF;
    
    INSERT INTO inventory_operations_log (
      variant_id, product_id, product_name, color_name, size_value,
      operation_type, quantity_change,
      quantity_before, quantity_after,
      reserved_before, reserved_after,
      sold_before, sold_after,
      source_type, notes
    ) VALUES (
      NEW.variant_id, NEW.product_id, v_product_name, v_color_name, v_size_value,
      v_operation_type, v_quantity_change,
      OLD.quantity, NEW.quantity,
      OLD.reserved_quantity, NEW.reserved_quantity,
      OLD.sold_quantity, NEW.sold_quantity,
      'system', CASE WHEN v_operation_type = 'sold' THEN 'تسجيل مبيع' ELSE 'إرجاع للمخزون' END
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- إنشاء الـ Trigger
DROP TRIGGER IF EXISTS trg_log_inventory_changes ON inventory;
CREATE TRIGGER trg_log_inventory_changes
  AFTER UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION log_inventory_changes();

-- دالة لجلب سجل العمليات
CREATE OR REPLACE FUNCTION get_inventory_operations_log(
  p_limit INTEGER DEFAULT 100,
  p_product_id UUID DEFAULT NULL,
  p_operation_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  product_name TEXT,
  color_name TEXT,
  size_value TEXT,
  operation_type TEXT,
  quantity_change INTEGER,
  quantity_before INTEGER,
  quantity_after INTEGER,
  reserved_before INTEGER,
  reserved_after INTEGER,
  sold_before INTEGER,
  sold_after INTEGER,
  source_type TEXT,
  tracking_number TEXT,
  notes TEXT,
  performed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.product_name,
    l.color_name,
    l.size_value,
    l.operation_type,
    l.quantity_change,
    l.quantity_before,
    l.quantity_after,
    l.reserved_before,
    l.reserved_after,
    l.sold_before,
    l.sold_after,
    l.source_type,
    l.tracking_number,
    l.notes,
    l.performed_at
  FROM inventory_operations_log l
  WHERE (p_product_id IS NULL OR l.product_id = p_product_id)
    AND (p_operation_type IS NULL OR l.operation_type = p_operation_type)
  ORDER BY l.performed_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
