import { useUnifiedPermissions } from './useUnifiedPermissions';
import { useAuth } from '@/contexts/UnifiedAuthContext';

/**
 * Hook مبسط للوصول للصلاحيات والأدوار
 * يستخدم النظام الجديد الموحد فقط
 */
export const usePermissions = () => {
  const { user } = useAuth();
  const permissions = useUnifiedPermissions();

  return {
    // المستخدم
    user,
    loading: permissions.loading,

    // الأدوار
    isAdmin: permissions.isAdmin,
    isDepartmentManager: permissions.isDepartmentManager,
    isSalesEmployee: permissions.isSalesEmployee,
    isWarehouseEmployee: permissions.isWarehouseEmployee,
    isCashier: permissions.isCashier,
    hasRole: permissions.hasRole,

    // الصلاحيات
    hasPermission: permissions.hasPermission,
    canViewAllData: permissions.canViewAllData,
    canManageEmployees: permissions.canManageEmployees,
    canManageFinances: permissions.canManageFinances,

    // فلترة البيانات
    filterDataByUser: permissions.filterDataByUser,
    filterProductsByPermissions: permissions.filterProductsByPermissions,
    getEmployeeStats: permissions.getEmployeeStats,

    // معلومات إضافية
    userRoles: permissions.userRoles,
    userPermissions: permissions.userPermissions,
    productPermissions: permissions.productPermissions,
  };
};

export default usePermissions;