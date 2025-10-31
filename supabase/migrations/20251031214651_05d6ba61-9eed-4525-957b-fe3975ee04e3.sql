-- تحديث جميع المستخدمين الذين يستخدمون شركات توصيل
-- تعيين selected_delivery_partner بناءً على default_ai_order_destination
UPDATE profiles 
SET selected_delivery_partner = default_ai_order_destination 
WHERE default_ai_order_destination IS NOT NULL 
  AND default_ai_order_destination != 'local'
  AND (selected_delivery_partner IS NULL OR selected_delivery_partner != default_ai_order_destination);