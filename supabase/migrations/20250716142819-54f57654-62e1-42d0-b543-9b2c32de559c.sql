-- حذف البيانات المرتبطة بالحساب المعلق ثم حذف الحساب نفسه

DO $$
BEGIN
  -- حذف الإشعارات المرتبطة بالمستخدم
  DELETE FROM public.notifications WHERE user_id = 'b0c68901-4dc0-4051-abf6-d3666dd55fa7';
  
  -- حذف أي بيانات أخرى مرتبطة بالمستخدم
  DELETE FROM public.telegram_employee_codes WHERE user_id = 'b0c68901-4dc0-4051-abf6-d3666dd55fa7';
  
  -- حذف الـ profile
  DELETE FROM public.profiles WHERE user_id = 'b0c68901-4dc0-4051-abf6-d3666dd55fa7';
  
  RAISE NOTICE 'تم حذف الحساب المعلق وجميع البيانات المرتبطة به بنجاح';
END $$;