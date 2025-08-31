import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import NotificationsPanel from './NotificationsPanel';

/**
 * مكون موحد للإشعارات
 * يستخدم النظام الموحد للصلاحيات
 */
const UnifiedNotificationsPanel = (props) => {
  const { hasPermission, canViewAllData } = usePermissions();

  // تحديد الإشعارات المتاحة حسب الصلاحيات - إضافة جميع الأنواع الفعلية
  const allowedNotificationTypes = React.useMemo(() => {
    // جميع الأنواع الموجودة فعلياً في قاعدة البيانات
    const allTypes = [
      'order_status_update',
      'order_deleted', 
      'ai_order',
      'user_approved',
      'my_order_status_update',
      'order_created',
      'inventory_cleanup',
      'security_update',
      'auto_deletion',
      'alwaseet_status_change',
      'low_stock',
      'stock_warning',
      'order_completed',
      'new_order',
      'profit_settlement',
      'system'
    ];
    
    // أضافة الأنواع القديمة للتوافق
    const legacyTypes = ['orders', 'stock', 'employees', 'admin', 'financial'];
    
    return [...allTypes, ...legacyTypes];
  }, [hasPermission]);

  return (
    <NotificationsPanel
      {...props}
      allowedTypes={allowedNotificationTypes}
      canViewAll={canViewAllData}
    />
  );
};

export default UnifiedNotificationsPanel;