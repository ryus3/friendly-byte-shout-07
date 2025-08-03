import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import NotificationsPanel from './NotificationsPanel';

/**
 * مكون موحد للإشعارات
 * يستخدم النظام الموحد للصلاحيات
 */
const UnifiedNotificationsPanel = (props) => {
  const { hasPermission, canViewAllData } = usePermissions();

  // تحديد الإشعارات المتاحة حسب الصلاحيات
  const allowedNotificationTypes = React.useMemo(() => {
    const types = ['orders', 'stock', 'system'];
    
    if (hasPermission('manage_employees')) {
      types.push('employees');
    }
    
    if (hasPermission('manage_all_data')) {
      types.push('admin', 'financial');
    }
    
    return types;
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