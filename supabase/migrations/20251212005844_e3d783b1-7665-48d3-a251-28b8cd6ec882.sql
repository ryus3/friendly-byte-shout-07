
-- ============================================
-- إصلاح شامل لنظام حساب أرباح الموظفين
-- الخصم يُخصم من ربح الموظف والزيادة تُضاف
-- ============================================

-- 1️⃣ إعادة إنشاء دالة حساب ربح الموظف مع المنطق الصحيح
CREATE OR REPLACE FUNCTION auto_create_profit_record()
RETURNS TRIGGER AS $$
DECLARE
  existing_profit_id UUID;
  system_profit_amount NUMERIC := 0;
  employee_profit_amount NUMERIC := 0;
  total_cost NUMERIC := 0;
  total_revenue NUMERIC := 0;
  order_discount NUMERIC := 0;
  order_increase NUMERIC := 0;
BEGIN
  -- فقط للطلبات الجديدة أو عند تغيير الحالة
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    
    -- التحقق من عدم وجود سجل ربح مسبق
    SELECT id INTO existing_profit_id 
    FROM profits 
    WHERE order_id = NEW.id;
    
    IF existing_profit_id IS NULL THEN
      -- حساب إجمالي التكلفة والإيراد من عناصر الطلب
      SELECT 
        COALESCE(SUM(oi.quantity * COALESCE(
          (SELECT pv.cost FROM product_variants pv WHERE pv.id = oi.variant_id),
          (SELECT p.cost FROM products p WHERE p.id = oi.product_id),
          0
        )), 0),
        COALESCE(SUM(oi.total_price), 0)
      INTO total_cost, total_revenue
      FROM order_items oi
      WHERE oi.order_id = NEW.id;
      
      -- حساب ربح النظام (الإيراد - التكلفة)
      system_profit_amount := total_revenue - total_cost;
      
      -- ✅ حساب ربح الموظف من قواعد الأرباح
      SELECT COALESCE(SUM(
        CASE 
          -- إذا كانت القاعدة بمبلغ ثابت
          WHEN epr.profit_amount IS NOT NULL AND epr.profit_amount > 0 
            THEN epr.profit_amount * oi.quantity
          -- إذا كانت القاعدة بنسبة مئوية
          WHEN epr.profit_percentage IS NOT NULL AND epr.profit_percentage > 0 
            THEN (oi.total_price * epr.profit_percentage / 100)
          ELSE 0
        END
      ), 0) INTO employee_profit_amount
      FROM order_items oi
      LEFT JOIN employee_profit_rules epr ON 
        epr.employee_id = NEW.created_by 
        AND epr.target_id = oi.product_id::text
        AND epr.rule_type = 'product'
        AND epr.is_active = true
      WHERE oi.order_id = NEW.id;
      
      -- ✅ معالجة الخصم والزيادة على ربح الموظف
      order_discount := COALESCE(NEW.discount, 0);
      order_increase := COALESCE(NEW.price_increase, 0);
      
      -- الخصم يُخصم من ربح الموظف
      IF order_discount > 0 THEN
        employee_profit_amount := GREATEST(0, employee_profit_amount - order_discount);
      END IF;
      
      -- الزيادة تُضاف لربح الموظف
      IF order_increase > 0 THEN
        employee_profit_amount := employee_profit_amount + order_increase;
      END IF;
      
      -- إنشاء سجل الربح
      INSERT INTO profits (
        order_id,
        employee_id,
        system_profit,
        employee_profit,
        employee_percentage,
        status,
        created_at
      ) VALUES (
        NEW.id,
        NEW.created_by,
        system_profit_amount,
        employee_profit_amount,
        CASE WHEN total_revenue > 0 THEN (employee_profit_amount / total_revenue * 100) ELSE 0 END,
        'pending',
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2️⃣ تحديث جميع سجلات الأرباح الموجودة بالقيم الصحيحة
WITH calculated_profits AS (
  SELECT 
    p.id as profit_id,
    p.order_id,
    p.employee_id,
    COALESCE(SUM(
      CASE 
        WHEN epr.profit_amount IS NOT NULL AND epr.profit_amount > 0 
          THEN epr.profit_amount * oi.quantity
        WHEN epr.profit_percentage IS NOT NULL AND epr.profit_percentage > 0 
          THEN (oi.total_price * epr.profit_percentage / 100)
        ELSE 0
      END
    ), 0) as base_profit,
    COALESCE(o.discount, 0) as order_discount,
    COALESCE(o.price_increase, 0) as order_increase
  FROM profits p
  JOIN orders o ON o.id = p.order_id
  LEFT JOIN order_items oi ON oi.order_id = p.order_id
  LEFT JOIN employee_profit_rules epr ON 
    epr.employee_id = p.employee_id 
    AND epr.target_id = oi.product_id::text
    AND epr.rule_type = 'product'
    AND epr.is_active = true
  WHERE p.employee_profit = 0 OR p.employee_profit IS NULL
  GROUP BY p.id, p.order_id, p.employee_id, o.discount, o.price_increase
)
UPDATE profits p
SET employee_profit = GREATEST(0, cp.base_profit - cp.order_discount + cp.order_increase)
FROM calculated_profits cp
WHERE p.id = cp.profit_id;

-- 3️⃣ تحديث employee_percentage بناءً على employee_profit الجديد
UPDATE profits p
SET employee_percentage = CASE 
  WHEN COALESCE((SELECT SUM(total_price) FROM order_items WHERE order_id = p.order_id), 0) > 0 
  THEN (p.employee_profit / (SELECT SUM(total_price) FROM order_items WHERE order_id = p.order_id) * 100)
  ELSE 0 
END
WHERE p.employee_profit > 0;
