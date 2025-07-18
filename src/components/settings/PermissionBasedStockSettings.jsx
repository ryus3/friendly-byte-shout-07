import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import StockNotificationSettings from './StockNotificationSettings';

const PermissionBasedStockSettings = ({ open, onOpenChange }) => {
  const { canManageFinances, isAdmin, isSalesEmployee } = usePermissions();

  // إذا كان الموظف ليس لديه صلاحية إدارة الإعدادات، أظهر له معلومات فقط
  if (isSalesEmployee && !canManageFinances) {
    return (
      <StockNotificationSettings 
        open={open} 
        onOpenChange={onOpenChange}
        readonly={true}
        showLimitedView={true}
      />
    );
  }

  // للمدراء، أظهر الإعدادات كاملة
  return (
    <StockNotificationSettings 
      open={open} 
      onOpenChange={onOpenChange}
      readonly={false}
      showLimitedView={false}
    />
  );
};

export default PermissionBasedStockSettings;