import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import EmployeeProfitsManager from './EmployeeProfitsManager';

/**
 * مكون موحد لإدارة أرباح الموظفين - يستخدم نظام الصلاحيات الموحد
 * المديرون: يديرون جميع أرباح الموظفين
 * الموظفون: يرون أرباحهم فقط
 */
const UnifiedEmployeeProfitsManager = (props) => {
  const { hasPermission, canViewAllData, canManageEmployees } = usePermissions();
  
  // فحص صلاحية إدارة أرباح الموظفين
  const canManageProfits = hasPermission('manage_employee_profits') || 
                          hasPermission('manage_all_data') || 
                          canManageEmployees;

  if (!canManageProfits) {
    return null;
  }

  return (
    <EmployeeProfitsManager
      {...props}
      canViewAll={canViewAllData}
      canManageAll={canManageEmployees}
    />
  );
};

export default UnifiedEmployeeProfitsManager;