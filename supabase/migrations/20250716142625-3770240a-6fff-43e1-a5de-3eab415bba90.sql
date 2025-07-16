-- حذف حساب الموظف المعلق لإعادة التسجيل من جديد
-- هذا سيحذف الحساب من auth.users وسيتم حذف الـ profile تلقائياً بسبب cascade

DO $$
BEGIN
  -- حذف الحساب من جدول المصادقة
  DELETE FROM auth.users WHERE id = 'b0c68901-4dc0-4051-abf6-d3666dd55fa7';
  
  -- التأكد من حذف الـ profile إذا لم يُحذف تلقائياً
  DELETE FROM public.profiles WHERE user_id = 'b0c68901-4dc0-4051-abf6-d3666dd55fa7';
  
  RAISE NOTICE 'تم حذف الحساب المعلق بنجاح';
END $$;