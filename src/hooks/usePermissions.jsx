/**
 * Bridge file for backward compatibility
 * Redirects to the unified permissions system
 */
import { useContext, useMemo } from 'react';
import { UnifiedPermissionsContext } from '@/contexts/UnifiedPermissionsProvider';

// Re-implement the hook logic here to avoid circular imports
export const usePermissions = () => {
  const context = useContext(UnifiedPermissionsContext);
  
  // إذا لم يكن هناك سياق، نعيد قيم افتراضية آمنة
  if (!context) {
    console.warn('usePermissions: لم يتم العثور على سياق الصلاحيات');
    return {
      user: null,
      userRoles: [],
      userPermissions: [],
      productPermissions: {},
      loading: false,
      error: null,
      // Boolean flags
      isAdmin: false,
      isDepartmentManager: false,
      isSalesEmployee: false,
      isWarehouseEmployee: false,
      isCashier: false,
      isEmployee: false,
      // Functions
      hasRole: () => false,
      hasPermission: () => false,
      canViewAllData: false,
      canManageEmployees: false,
      canManageFinances: false,
      canManageProducts: false,
      canManageAccounting: false,
      canManagePurchases: false,
      canAccessDeliveryPartners: false,
      filterDataByUser: (data) => [],
      filterProductsByPermissions: (products) => [],
      filterNotificationsByUser: (notifications) => [],
      getEmployeeStats: () => ({ total: 0, personal: 0 })
    };
  }

  const { user, userRoles, userPermissions, productPermissions, loading, error } = context;

  // Role checks - memoized for performance
  const isAdmin = useMemo(() => {
    return userRoles?.some(role => ['super_admin', 'admin'].includes(role.name)) || false;
  }, [userRoles]);

  const isDepartmentManager = useMemo(() => {
    return userRoles?.some(role => role.name === 'department_manager') || false;
  }, [userRoles]);

  const isSalesEmployee = useMemo(() => {
    return userRoles?.some(role => role.name === 'sales_employee') || false;
  }, [userRoles]);

  const isWarehouseEmployee = useMemo(() => {
    return userRoles?.some(role => role.name === 'warehouse_employee') || false;
  }, [userRoles]);

  const isCashier = useMemo(() => {
    return userRoles?.some(role => role.name === 'cashier') || false;
  }, [userRoles]);

  const isEmployee = useMemo(() => {
    return userRoles?.some(role => !['super_admin', 'admin'].includes(role.name)) || false;
  }, [userRoles]);

  // Function to check if user has specific role
  const hasRole = useMemo(() => {
    return (roleName) => {
      return userRoles?.some(role => role.name === roleName) || false;
    };
  }, [userRoles]);

  // Function to check if user has specific permission
  const hasPermission = useMemo(() => {
    return (permissionName) => {
      // Admin has all permissions
      if (isAdmin) return true;
      return userPermissions?.some(permission => permission.name === permissionName) || false;
    };
  }, [userPermissions, isAdmin]);

  // Permission-based capabilities
  const canViewAllData = useMemo(() => {
    return isAdmin || hasPermission('view_all_data');
  }, [isAdmin, hasPermission]);

  const canManageEmployees = useMemo(() => {
    return isAdmin || hasPermission('manage_employees');
  }, [isAdmin, hasPermission]);

  const canManageFinances = useMemo(() => {
    return isAdmin || hasPermission('manage_finances');
  }, [isAdmin, hasPermission]);

  const canManageProducts = useMemo(() => {
    return isAdmin || hasPermission('manage_products');
  }, [isAdmin, hasPermission]);

  const canManageAccounting = useMemo(() => {
    return isAdmin || hasPermission('manage_accounting');
  }, [isAdmin, hasPermission]);

  const canManagePurchases = useMemo(() => {
    return isAdmin || hasPermission('manage_purchases');
  }, [isAdmin, hasPermission]);

  const canAccessDeliveryPartners = useMemo(() => {
    return isAdmin || hasPermission('access_delivery_partners');
  }, [isAdmin, hasPermission]);

  // Data filtering functions
  const filterDataByUser = useMemo(() => {
    return (data, userIdField = 'user_id') => {
      if (!data || !Array.isArray(data)) return [];
      if (canViewAllData) return data;
      return data.filter(item => item[userIdField] === user?.user_id);
    };
  }, [canViewAllData, user?.user_id]);

  const filterProductsByPermissions = useMemo(() => {
    return (products) => {
      if (!products || !Array.isArray(products)) return [];
      if (canViewAllData || !productPermissions) return products;

      const categoryPerms = productPermissions.categories;
      const departmentPerms = productPermissions.departments;

      if (!categoryPerms && !departmentPerms) return products;

      return products.filter(product => {
        // Check category permissions
        if (categoryPerms && !categoryPerms.has_full_access) {
          const allowedCategories = categoryPerms.allowed_items || [];
          if (product.category_id && !allowedCategories.includes(product.category_id)) {
            return false;
          }
        }

        // Check department permissions
        if (departmentPerms && !departmentPerms.has_full_access) {
          const allowedDepartments = departmentPerms.allowed_items || [];
          if (product.department_id && !allowedDepartments.includes(product.department_id)) {
            return false;
          }
        }

        return true;
      });
    };
  }, [canViewAllData, productPermissions]);

  const filterNotificationsByUser = useMemo(() => {
    return (notifications) => {
      if (!notifications || !Array.isArray(notifications)) return [];
      if (canViewAllData) return notifications;
      return notifications.filter(notif => 
        notif.user_id === user?.user_id || notif.type === 'general'
      );
    };
  }, [canViewAllData, user?.user_id]);

  const getEmployeeStats = useMemo(() => {
    return (data) => {
      if (!data || !Array.isArray(data)) return { total: 0, personal: 0 };
      const total = data.length;
      const personal = canViewAllData ? total : data.filter(item => item.user_id === user?.user_id).length;
      return { total, personal };
    };
  }, [canViewAllData, user?.user_id]);

  return {
    // Raw data
    user,
    userRoles: userRoles || [],
    userPermissions: userPermissions || [],
    productPermissions: productPermissions || {},
    loading,
    error,

    // Boolean flags
    isAdmin,
    isDepartmentManager,
    isSalesEmployee,
    isWarehouseEmployee,
    isCashier,
    isEmployee,

    // Functions
    hasRole,
    hasPermission,

    // Capabilities
    canViewAllData,
    canManageEmployees,
    canManageFinances,
    canManageProducts,
    canManageAccounting,
    canManagePurchases,
    canAccessDeliveryPartners,

    // Utility functions
    filterDataByUser,
    filterProductsByPermissions,
    filterNotificationsByUser,
    getEmployeeStats
  };
};

export { usePermissions as useUnifiedPermissionsSystem };
export default usePermissions;