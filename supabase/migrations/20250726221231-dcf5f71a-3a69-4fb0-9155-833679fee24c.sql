-- إضافة صلاحية للنقاط في جدول مستويات الولاء
ALTER TABLE loyalty_tiers 
ADD COLUMN points_expiry_months INTEGER DEFAULT 3;

-- إضافة عمود تاريخ انتهاء صلاحية النقاط في جدول ولاء العملاء
ALTER TABLE customer_loyalty 
ADD COLUMN points_expiry_date TIMESTAMP WITH TIME ZONE;

-- دالة لتحديث تاريخ انتهاء صلاحية النقاط
CREATE OR REPLACE FUNCTION update_points_expiry_date()
RETURNS TRIGGER AS $$
BEGIN
  -- تحديث تاريخ انتهاء الصلاحية عند تحديث النقاط
  IF NEW.total_points != OLD.total_points THEN
    NEW.points_expiry_date := now() + INTERVAL '3 months';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إنشاء ترايغر لتحديث تاريخ انتهاء الصلاحية
CREATE TRIGGER update_customer_points_expiry
  BEFORE UPDATE ON customer_loyalty
  FOR EACH ROW
  EXECUTE FUNCTION update_points_expiry_date();

-- دالة لإنهاء صلاحية النقاط المنتهية
CREATE OR REPLACE FUNCTION expire_old_points()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  expired_customer RECORD;
BEGIN
  -- البحث عن العملاء الذين انتهت صلاحية نقاطهم
  FOR expired_customer IN 
    SELECT id, total_points, points_expiry_date
    FROM customer_loyalty
    WHERE points_expiry_date IS NOT NULL 
    AND points_expiry_date < now()
    AND total_points > 0
  LOOP
    -- إضافة سجل في تاريخ النقاط
    INSERT INTO loyalty_points_history (
      customer_id,
      points_used,
      transaction_type,
      description
    ) VALUES (
      expired_customer.id,
      expired_customer.total_points,
      'expired',
      'انتهت صلاحية النقاط بعد 3 أشهر من عدم الاستخدام'
    );
    
    -- إعادة تعيين النقاط إلى الصفر
    UPDATE customer_loyalty 
    SET 
      total_points = 0,
      points_expiry_date = NULL,
      updated_at = now()
    WHERE id = expired_customer.id;
    
    -- إضافة إشعار للعميل
    INSERT INTO customer_notifications_sent (
      customer_id,
      notification_type,
      message,
      sent_via,
      success
    ) VALUES (
      expired_customer.id,
      'points_expired',
      'تنبيه: انتهت صلاحية نقاط الولاء الخاصة بك بعد 3 أشهر من عدم الاستخدام.',
      'pending',
      false
    );
    
  END LOOP;
  
  RAISE NOTICE 'تم إنهاء صلاحية النقاط للعملاء المطلوبين';
END;
$$;

-- إضافة تعليق توضيحي للدالة
COMMENT ON FUNCTION expire_old_points() IS 'دالة لإنهاء صلاحية النقاط بعد 3 أشهر من عدم الاستخدام';