import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import ProductPermissionsManager from './ProductPermissionsManager';

/**
 * مكون موحد لإدارة صلاحيات المنتجات - يستخدم نظام الصلاحيات الموحد
 * المديرون: يديرون جميع صلاحيات المنتجات
 * نواب المدير: يديرون صلاحيات محدودة
 */
const UnifiedProductPermissionsManager = ({ user, onClose, onUpdate, ...props }) => {
  const { hasPermission, canViewAllData, canManageEmployees } = usePermissions();
  
  // فحص صلاحية إدارة صلاحيات المنتجات
  const canManagePermissions = hasPermission('manage_product_permissions') || 
                              hasPermission('manage_all_data') || 
                              canManageEmployees;

  if (!canManagePermissions) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">ليس لديك صلاحية لإدارة صلاحيات المنتجات</p>
      </div>
    );
  }

  return (
    <ProductPermissionsManager
      {...props}
      user={user}
      onClose={onClose}
      onUpdate={onUpdate}
      canViewAll={canViewAllData}
      canManageAll={canManageEmployees}
    />
  );
};

export default UnifiedProductPermissionsManager;