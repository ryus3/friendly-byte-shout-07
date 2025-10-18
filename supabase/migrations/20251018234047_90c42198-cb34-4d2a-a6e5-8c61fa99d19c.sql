-- إنشاء جدول سجل الحذف التلقائي للطلبات
CREATE TABLE auto_delete_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- معلومات الطلب المحذوف
  order_id UUID,
  order_number TEXT,
  tracking_number TEXT,
  qr_id TEXT,
  delivery_partner_order_id TEXT,
  
  -- تفاصيل الحذف
  deleted_at TIMESTAMPTZ DEFAULT now(),
  deleted_by UUID REFERENCES auth.users(id),
  delete_source TEXT, -- 'syncAndApplyOrders', 'fastSync', 'syncOrderByQR', 'manual'
  
  -- السبب
  reason JSONB DEFAULT '{}'::jsonb,
  
  -- حالة الطلب قبل الحذف
  order_status TEXT,
  delivery_status TEXT,
  order_age_minutes INTEGER,
  waseet_orders_count INTEGER,
  
  -- البيانات الكاملة للاستعادة
  order_data JSONB,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- فهارس لتحسين الأداء
CREATE INDEX idx_auto_delete_tracking ON auto_delete_log(tracking_number);
CREATE INDEX idx_auto_delete_date ON auto_delete_log(deleted_at DESC);
CREATE INDEX idx_auto_delete_source ON auto_delete_log(delete_source);
CREATE INDEX idx_auto_delete_by ON auto_delete_log(deleted_by);

-- تفعيل Row Level Security
ALTER TABLE auto_delete_log ENABLE ROW LEVEL SECURITY;

-- المديرون والمستخدمون يرون سجلات الحذف الخاصة بهم
CREATE POLICY "المديرون والمستخدمون يرون سجل الحذف"
  ON auto_delete_log FOR SELECT
  USING (is_admin_or_deputy() OR deleted_by = auth.uid());

-- النظام يسجل الحذف (جميع المستخدمين المصادقين)
CREATE POLICY "المستخدمون يسجلون الحذف"
  ON auto_delete_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);