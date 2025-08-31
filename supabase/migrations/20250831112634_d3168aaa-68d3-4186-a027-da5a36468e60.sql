-- إنشاء إشعار تجريبي لحالة "تم التسليم للزبون" لإظهار النظام الموحد الجديد
INSERT INTO public.notifications (
  type, 
  title, 
  message, 
  user_id, 
  data, 
  priority,
  read
) VALUES (
  'alwaseet_status_change',
  'تحديث حالة الطلب',
  'delivery_status_update',
  null, -- إشعار عام للمديرين
  jsonb_build_object(
    'order_id', gen_random_uuid(),
    'order_number', 'TEST-ORDER-001',
    'tracking_number', '99600630',
    'delivery_status', '4',
    'state_id', '4',
    'delivery_partner', 'alwaseet',
    'customer_name', 'زياد أحمد',
    'customer_phone', '07701234567'
  ),
  'medium',
  false
);