import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';

/**
 * مكون لمعالجة النقر على الإشعارات والتوجيه المناسب
 */
export const useNotificationHandler = () => {
  const navigate = useNavigate();

  const handleNotificationClick = useCallback((notification) => {
    if (!notification) return;

    console.log('🔔 NotificationHandler: Handling notification click:', {
      type: notification.type,
      data: notification.data
    });

    // معالجة إشعارات الطلبات الجديدة - محسنة لعرض رقم التتبع
    if (notification.type === 'order_created') {
      const { employee_id, order_id, tracking_number } = notification.data || {};
      
      if (employee_id && order_id) {
        // التوجه لصفحة متابعة الموظفين مع تحديد الموظف والطلب
        navigate(`/employee-follow-up?employee=${employee_id}&highlight=${order_id}`);
      } else if (employee_id) {
        // إذا كان هناك employee_id فقط
        navigate(`/employee-follow-up?employee=${employee_id}`);
      } else if (tracking_number) {
        // إذا لم يكن هناك employee_id، توجه لصفحة الطلبات مع البحث برقم التتبع
        navigate(`/my-orders?search=${tracking_number}`);
      } else {
        // افتراضي: الذهاب لمتابعة الموظفين
        navigate('/employee-follow-up');
      }
    }
    
    // معالجة إشعارات تحديث حالة الطلبات
    else if (notification.type === 'order_status_update') {
      const { order_id, employee_id } = notification.data || {};
      
      if (employee_id && order_id) {
        navigate(`/employee-follow-up?employee=${employee_id}&highlight=${order_id}`);
      } else if (order_id) {
        navigate(`/my-orders?highlight=${order_id}`);
      } else {
        navigate('/my-orders');
      }
    }
    
    // معالجة إشعارات الوسيط
    else if (notification.type === 'alwaseet_status_change') {
      const { order_id, employee_id, tracking_number } = notification.data || {};
      
      if (employee_id && order_id) {
        navigate(`/employee-follow-up?employee=${employee_id}&highlight=${order_id}`);
      } else if (order_id) {
        navigate(`/my-orders?highlight=${order_id}`);
      } else if (tracking_number) {
        navigate(`/my-orders?search=${tracking_number}`);
      } else {
        navigate('/my-orders');
      }
    }
    
    // معالجة إشعارات التحاسب
    else if (notification.type === 'settlement_request') {
      const { employee_id, orders } = notification.data || {};
      
      if (employee_id && orders) {
        navigate(`/employee-follow-up?employee=${employee_id}&orders=${orders.join(',')}&highlight=settlement`);
      } else if (employee_id) {
        navigate(`/employee-follow-up?employee=${employee_id}`);
      } else {
        navigate('/employee-follow-up');
      }
    }
    
    // معالجة إشعارات الطلبات الذكية
    else if (notification.type === 'new_ai_order') {
      console.log('🚀 Navigating to AI orders page');
      // التوجه لصفحة طلبات الذكاء الاصطناعي
      navigate('/ai-orders');
    }
    
    // معالجة أنواع إشعارات أخرى...
    else {
      console.log('نوع إشعار غير معروف:', notification.type);
      // افتراضي: الذهاب للوحة الرئيسية
      navigate('/dashboard');
    }
  }, [navigate]);

  return { handleNotificationClick };
};