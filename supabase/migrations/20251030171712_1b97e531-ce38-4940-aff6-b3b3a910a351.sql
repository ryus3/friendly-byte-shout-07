-- جدول الـ FCM Tokens
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  platform TEXT DEFAULT 'android',
  device_info JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول تفضيلات الإشعارات
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  ai_orders BOOLEAN DEFAULT true,
  regular_orders BOOLEAN DEFAULT false,
  delivery_updates BOOLEAN DEFAULT true,
  new_registrations BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tokens" ON fcm_tokens
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own preferences" ON notification_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Trigger: إشعار طلب تليجرام جديد
CREATE OR REPLACE FUNCTION notify_ai_order_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_preference BOOLEAN;
BEGIN
  v_user_id := NEW.processed_by;
  
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  SELECT ai_orders INTO v_preference
  FROM notification_preferences
  WHERE user_id = v_user_id;
  
  IF v_preference IS NULL OR v_preference = true THEN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'userId', v_user_id,
        'title', '🤖 طلب تليجرام جديد',
        'body', 'طلب #' || SUBSTRING(NEW.id::text, 1, 8) || ' من ' || COALESCE(NEW.customer_name, 'زبون'),
        'data', jsonb_build_object(
          'type', 'ai_order',
          'orderId', NEW.id,
          'route', '/ai-orders'
        )
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_ai_order_created ON ai_orders;
CREATE TRIGGER on_ai_order_created
AFTER INSERT ON ai_orders
FOR EACH ROW
EXECUTE FUNCTION notify_ai_order_created();

-- Trigger: إشعار تحديث حالة التوصيل
CREATE OR REPLACE FUNCTION notify_delivery_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_preference BOOLEAN;
  v_status_text TEXT;
BEGIN
  IF OLD.delivery_status IS NOT DISTINCT FROM NEW.delivery_status THEN
    RETURN NEW;
  END IF;
  
  v_user_id := NEW.created_by;
  
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  SELECT delivery_updates INTO v_preference
  FROM notification_preferences
  WHERE user_id = v_user_id;
  
  IF v_preference = false THEN
    RETURN NEW;
  END IF;
  
  v_status_text := CASE NEW.delivery_status
    WHEN '4' THEN 'تم التسليم ✅'
    WHEN '6' THEN 'مرتجع ↩️'
    WHEN '2' THEN 'قيد التوصيل 🚚'
    WHEN '3' THEN 'في المخزن 📦'
    ELSE 'تحديث جديد'
  END;
  
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'userId', v_user_id,
      'title', '📦 تحديث حالة الطلب',
      'body', 'الطلب #' || NEW.order_number || ' - ' || v_status_text,
      'data', jsonb_build_object(
        'type', 'delivery_update',
        'orderId', NEW.id,
        'orderNumber', NEW.order_number,
        'deliveryStatus', NEW.delivery_status,
        'route', '/orders?highlight=' || NEW.id
      )
    )
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_delivery_status_changed ON orders;
CREATE TRIGGER on_delivery_status_changed
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION notify_delivery_status_changed();