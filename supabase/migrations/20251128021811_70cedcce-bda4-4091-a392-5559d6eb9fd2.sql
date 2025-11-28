-- إصلاح RLS policy على notifications للسماح بإدخال إشعارات من triggers
-- المشكلة: auth.uid() = NULL في trigger context، مما يمنع إدخال الإشعارات

-- حذف policy القديمة
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;

-- إنشاء policy جديدة تسمح بالإدخال من:
-- 1. المستخدمين المسجلين (auth.uid() IS NOT NULL)
-- 2. أو triggers النظام التي تحدد user_id
CREATE POLICY "Allow notification inserts"
ON notifications
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL  -- للمستخدمين العاديين
  OR user_id IS NOT NULL   -- للـ triggers التي تحدد user_id
);

COMMENT ON POLICY "Allow notification inserts" ON notifications IS 
'تسمح بإدخال إشعارات من المستخدمين العاديين و triggers النظام (مثل auto_release_stock_on_order_delete)';