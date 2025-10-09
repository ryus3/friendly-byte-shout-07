-- إضافة أعمدة جديدة لدعم الاستبدال والترجيع في جدول ai_orders
ALTER TABLE ai_orders 
  ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS replacement_pair_id UUID,
  ADD COLUMN IF NOT EXISTS merchant_pays_delivery BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_order_id UUID;

-- إضافة أعمدة جديدة لدعم الاستبدال والترجيع في جدول orders
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS replacement_pair_id UUID,
  ADD COLUMN IF NOT EXISTS merchant_pays_delivery BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_order_id UUID;

-- إنشاء فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_ai_orders_order_type ON ai_orders(order_type);
CREATE INDEX IF NOT EXISTS idx_ai_orders_replacement_pair_id ON ai_orders(replacement_pair_id);
CREATE INDEX IF NOT EXISTS idx_ai_orders_original_order_id ON ai_orders(original_order_id);

CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_replacement_pair_id ON orders(replacement_pair_id);
CREATE INDEX IF NOT EXISTS idx_orders_original_order_id ON orders(original_order_id);

-- إضافة تعليقات توضيحية
COMMENT ON COLUMN ai_orders.order_type IS 'نوع الطلب: regular, replacement_outgoing, replacement_incoming, return_only';
COMMENT ON COLUMN ai_orders.replacement_pair_id IS 'ربط طلبات الاستبدال (outgoing و incoming لهما نفس pair_id)';
COMMENT ON COLUMN ai_orders.merchant_pays_delivery IS 'هل التاجر يدفع رسوم التوصيل للطلبات الخارجة';
COMMENT ON COLUMN ai_orders.refund_amount IS 'المبلغ المسترجع للزبون في حالة الترجيع';
COMMENT ON COLUMN ai_orders.original_order_id IS 'ربط طلب الترجيع بالطلب الأصلي';

COMMENT ON COLUMN orders.order_type IS 'نوع الطلب: regular, replacement_outgoing, replacement_incoming, return_only';
COMMENT ON COLUMN orders.replacement_pair_id IS 'ربط طلبات الاستبدال (outgoing و incoming لهما نفس pair_id)';
COMMENT ON COLUMN orders.merchant_pays_delivery IS 'هل التاجر يدفع رسوم التوصيل للطلبات الخارجة';
COMMENT ON COLUMN orders.refund_amount IS 'المبلغ المسترجع للزبون في حالة الترجيع';
COMMENT ON COLUMN orders.original_order_id IS 'ربط طلب الترجيع بالطلب الأصلي';