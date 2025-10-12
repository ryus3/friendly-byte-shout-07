-- ========================================
-- المرحلة 1: إنشاء جدول ديون الموظفين
-- ========================================

CREATE TABLE IF NOT EXISTS public.employee_debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  order_id uuid NOT NULL,
  original_order_id uuid,
  debt_type text NOT NULL CHECK (debt_type IN ('return_refund', 'loss', 'shortage', 'other')),
  amount numeric NOT NULL CHECK (amount >= 0),
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'forgiven', 'cancelled')),
  paid_amount numeric DEFAULT 0 CHECK (paid_amount >= 0),
  remaining_amount numeric GENERATED ALWAYS AS (amount - paid_amount) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  settled_by uuid,
  notes text
);

-- Index للأداء
CREATE INDEX IF NOT EXISTS idx_employee_debts_employee ON employee_debts(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_debts_status ON employee_debts(status);
CREATE INDEX IF NOT EXISTS idx_employee_debts_order ON employee_debts(order_id);

-- RLS
ALTER TABLE public.employee_debts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "الموظفون يرون ديونهم والمديرون يرون الكل" ON employee_debts;
CREATE POLICY "الموظفون يرون ديونهم والمديرون يرون الكل" 
ON employee_debts FOR SELECT
USING (employee_id = auth.uid() OR is_admin_or_deputy());

DROP POLICY IF EXISTS "المديرون فقط يديرون ديون الموظفين" ON employee_debts;
CREATE POLICY "المديرون فقط يديرون ديون الموظفين" 
ON employee_debts FOR ALL
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());

-- ========================================
-- المرحلة 2: إنشاء جدول سجل حالات الطلب (إذا لم يكن موجوداً)
-- ========================================

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_status text,
  new_status text,
  old_delivery_status text,
  new_delivery_status text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_delivery_status ON order_status_history(new_delivery_status);

-- RLS
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "المستخدمون يرون سجل حالات طلباتهم" ON order_status_history;
CREATE POLICY "المستخدمون يرون سجل حالات طلباتهم" 
ON order_status_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.id = order_status_history.order_id 
    AND (o.created_by = auth.uid() OR is_admin_or_deputy())
  )
);

DROP POLICY IF EXISTS "النظام يسجل تغييرات الحالة" ON order_status_history;
CREATE POLICY "النظام يسجل تغييرات الحالة" 
ON order_status_history FOR INSERT
WITH CHECK (true);

-- ========================================
-- المرحلة 3: Trigger لتسجيل تغييرات حالة الطلب
-- ========================================

CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS trigger AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) 
     OR (OLD.delivery_status IS DISTINCT FROM NEW.delivery_status) THEN
    
    INSERT INTO order_status_history (
      order_id,
      old_status,
      new_status,
      old_delivery_status,
      new_delivery_status,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      OLD.delivery_status,
      NEW.delivery_status,
      auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_log_order_status_change ON orders;
CREATE TRIGGER trg_log_order_status_change
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_status_change();