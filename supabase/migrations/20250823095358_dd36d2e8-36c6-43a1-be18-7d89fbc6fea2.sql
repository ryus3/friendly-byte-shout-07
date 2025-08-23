-- تحديث دالة إصلاح طلبات الوسيط لعدم تعيين الحالة تلقائياً
CREATE OR REPLACE FUNCTION public.repair_alwaseet_order_mapping(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  order_record RECORD;
  fixed_mapping jsonb := '{}';
BEGIN
  -- Get the order record
  SELECT * INTO order_record 
  FROM orders 
  WHERE id = p_order_id;
  
  IF order_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- Check if this order needs repair (delivery_partner_order_id == tracking_number)
  IF order_record.delivery_partner = 'alwaseet' 
     AND order_record.delivery_partner_order_id IS NOT NULL 
     AND order_record.tracking_number IS NOT NULL
     AND order_record.delivery_partner_order_id = order_record.tracking_number THEN
    
    -- This is the problematic pattern but don't auto-fix status or receipt
    -- Just log that it needs manual review
    fixed_mapping := jsonb_build_object(
      'order_id', p_order_id,
      'needs_review', true,
      'issue', 'delivery_partner_order_id matches tracking_number - needs manual review',
      'delivery_partner_order_id', order_record.delivery_partner_order_id,
      'tracking_number', order_record.tracking_number,
      'current_status', order_record.status,
      'receipt_received', order_record.receipt_received
    );
    
    -- Add notification for admin but don't auto-change anything
    INSERT INTO notifications (
      title,
      message,
      type,
      data,
      user_id
    ) VALUES (
      'طلب وسيط يحتاج مراجعة',
      'الطلب رقم ' || COALESCE(order_record.order_number, order_record.id::text) || ' يحتاج مراجعة يدوية لحالة التسليم',
      'order_needs_review',
      jsonb_build_object('order_id', p_order_id, 'order_number', order_record.order_number),
      NULL
    );
    
  ELSE
    fixed_mapping := jsonb_build_object(
      'order_id', p_order_id,
      'needs_review', false,
      'reason', 'Order does not match problematic pattern'
    );
  END IF;
  
  RETURN jsonb_build_object('success', true, 'result', fixed_mapping);
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;