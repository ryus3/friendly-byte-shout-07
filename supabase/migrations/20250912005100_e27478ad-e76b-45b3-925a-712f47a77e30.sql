-- إنشاء دالة لضمان وجود created_by صالح
CREATE OR REPLACE FUNCTION public.ensure_created_by_not_null()
RETURNS TRIGGER AS $$
BEGIN
  -- إذا كان created_by فارغ، استخدم المستخدم الحالي
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  
  -- إذا كان لا يزال فارغ، استخدم المدير الافتراضي
  IF NEW.created_by IS NULL THEN
    NEW.created_by := '91484496-b887-44f7-9e5d-be9db5567604'::uuid;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;