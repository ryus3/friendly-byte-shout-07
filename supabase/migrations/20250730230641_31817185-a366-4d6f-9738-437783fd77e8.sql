-- إضافة معرف صغير وجميل للموظفين
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS employee_code TEXT UNIQUE;

-- إنشاء دالة لتوليد معرف موظف صغير
CREATE OR REPLACE FUNCTION generate_employee_code()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  new_code TEXT;
BEGIN
  -- الحصول على أعلى رقم موجود
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(employee_code FROM 4) AS INTEGER)), 
    0
  ) + 1
  INTO next_number
  FROM profiles 
  WHERE employee_code ~ '^EMP[0-9]+$';
  
  -- إنشاء المعرف الجديد
  new_code := 'EMP' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- تحديث الموظفين الموجودين لإضافة معرفات صغيرة
UPDATE profiles 
SET employee_code = generate_employee_code()
WHERE employee_code IS NULL;

-- إضافة trigger لتوليد معرف تلقائي للموظفين الجدد
CREATE OR REPLACE FUNCTION auto_assign_employee_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_code IS NULL THEN
    NEW.employee_code := generate_employee_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assign_employee_code_trigger ON profiles;
CREATE TRIGGER assign_employee_code_trigger
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_employee_code();

-- تحديث جدول فواتير التسوية لحفظ الطلبات المسواة
ALTER TABLE settlement_invoices 
ADD COLUMN IF NOT EXISTS settled_orders JSONB DEFAULT '[]'::jsonb;

-- التحقق من النتيجة
SELECT 
  user_id,
  full_name,
  employee_code,
  'معرف جديد' as status
FROM profiles 
WHERE employee_code IS NOT NULL
ORDER BY employee_code;