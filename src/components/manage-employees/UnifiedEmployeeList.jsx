import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import EmployeeList from './EmployeeList';

/**
 * مكون موحد لقائمة الموظفين - يستخدم نظام الصلاحيات الموحد
 * المديرون: يرون جميع الموظفين
 * نواب المدير: يرون الموظفين بصلاحيات محدودة
 */
const UnifiedEmployeeList = ({ users, onEdit, ...props }) => {
  const { hasPermission, canViewAllData, canManageEmployees } = usePermissions();
  
  // فحص صلاحية إدارة الموظفين
  const canManage = hasPermission('manage_employees') || 
                   hasPermission('manage_all_data') || 
                   canManageEmployees;

  if (!canManage) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">ليس لديك صلاحية لعرض قائمة الموظفين</p>
      </div>
    );
  }

  // فلترة الموظفين حسب الصلاحيات
  const filteredUsers = canViewAllData ? users : 
    users.filter(user => user.id === usePermissions().user?.id);

  return (
    <EmployeeList
      {...props}
      users={filteredUsers}
      onEdit={onEdit}
      canViewAll={canViewAllData}
      canManageAll={canManageEmployees}
    />
  );
};

export default UnifiedEmployeeList;