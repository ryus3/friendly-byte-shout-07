import { useMemo, useContext } from 'react';
import { UnifiedPermissionsContext } from '@/contexts/UnifiedPermissionsProvider';

/**
 * نظام الصلاحيات الموحد النهائي
 * يستخدم السياق من ملف منفصل لتجنب الاستيراد الدائري
 */

/**
 * Hook موحد للصلاحيات - يستخدم السياق العالمي
 */
export const useUnifiedPermissionsSystem = () => {
  try {
    const context = useContext(UnifiedPermissionsContext);
  
  // إذا لم يكن هناك سياق، نعيد قيم افتراضية آمنة
  if (!context) {
    return {
      // بيانات أساسية
      user: null,
      userRoles: [],
      userPermissions: [],
      productPermissions: {},
      loading: false,
      error: null,

      // فحص الأدوار
      isAdmin: false,
      isDepartmentManager: false,
      isSalesEmployee: false,
      isWarehouseEmployee: false,
      isCashier: false,
      isEmployee: false,
      hasRole: () => false,

      // فحص الصلاحيات
      hasPermission: () => false,
      canViewAllData: false,
      canManageEmployees: false,
      canManageFinances: false,
      canManageProducts: false,
      canManageAccounting: false,
      canManagePurchases: false,
      canAccessDeliveryPartners: false,

      // فلترة البيانات
      filterDataByUser: (data) => data || [],
      filterProductsByPermissions: (products) => products || [],
      filterNotificationsByUser: (notifications) => notifications || [],
      getEmployeeStats: () => ({ total: 0, personal: 0 })
    };
  }

  // التأكد من وجود context وأنه object صالح
  if (!context || typeof context !== 'object') {
    return {
      // بيانات أساسية
      user: null,
      userRoles: [],
      userPermissions: [],
      productPermissions: {},
      loading: false,
      error: null,

      // فحص الأدوار
      isAdmin: false,
      isDepartmentManager: false,
      isSalesEmployee: false,
      isWarehouseEmployee: false,
      isCashier: false,
      isEmployee: false,
      hasRole: () => false,

      // فحص الصلاحيات
      hasPermission: () => false,
      canViewAllData: false,
      canManageEmployees: false,
      canManageFinances: false,
      canManageProducts: false,
      canManageAccounting: false,
      canManagePurchases: false,
      canAccessDeliveryPartners: false,

      // فلترة البيانات
      filterDataByUser: (data) => data || [],
      filterProductsByPermissions: (products) => products || [],
      filterNotificationsByUser: (notifications) => notifications || [],
      getEmployeeStats: () => ({ total: 0, personal: 0 })
    };
  }

  // التأكد من أن البيانات متاحة
  const safeUserRoles = userRoles || [];
  const safeUserPermissions = userPermissions || [];
  const safeProductPermissions = productPermissions || {};

  // === فحص الأدوار (مبسط بدون useMemo) ===
  const isAdmin = safeUserRoles.some(role => ['super_admin', 'admin'].includes(role.name)) || false;
  const isDepartmentManager = safeUserRoles.some(role => ['department_manager', 'deputy_manager'].includes(role.name)) || false;
  const isSalesEmployee = safeUserRoles.some(role => role.name === 'sales_employee') || false;
  const isWarehouseEmployee = safeUserRoles.some(role => role.name === 'warehouse_employee') || false;
  const isCashier = safeUserRoles.some(role => role.name === 'cashier') || false;
  const isEmployee = safeUserRoles.length > 0 && !isAdmin;

  // دوال مبسطة
  const hasRole = (roleName) => safeUserRoles.some(role => role.name === roleName) || false;
  const hasPermission = (permissionName) => {
    if (isAdmin) return true;
    return safeUserPermissions.some(perm => perm.name === permissionName) || false;
  };

  // === فحص الصلاحيات (مبسط) ===
  const canViewAllData = isAdmin || isDepartmentManager;
  const canManageEmployees = isAdmin || hasPermission('manage_employees');
  const canManageFinances = isAdmin || hasPermission('manage_finances');
  const canManageProducts = isAdmin || isDepartmentManager || hasPermission('manage_products');
  const canManageAccounting = isAdmin || isDepartmentManager || hasPermission('manage_accounting');
  const canManagePurchases = isAdmin || isDepartmentManager || isWarehouseEmployee || hasPermission('manage_purchases');
  const canAccessDeliveryPartners = user?.delivery_partner_access === true;

  // === فلترة البيانات (دوال مبسطة) ===
  const filterDataByUser = (data, userIdField = 'created_by') => {
    if (!data) return [];
    if (canViewAllData) return data;
    return data.filter(item => {
      const itemUserId = item[userIdField];
      return itemUserId === user?.user_id || itemUserId === user?.id;
    });
  };

  const filterProductsByPermissions = (products) => {
    if (!products) return [];
    if (isAdmin) return products;

    return products.filter(product => {
      // فحص التصنيفات
      const categoryPerm = safeProductPermissions.category;
      if (categoryPerm && !categoryPerm.has_full_access) {
        if (product.categories?.length > 0) {
          const hasAllowedCategory = product.categories.some(cat => 
            categoryPerm.allowed_items.includes(cat.id)
          );
          if (!hasAllowedCategory) return false;
        }
      }

      // فحص الأقسام  
      const departmentPerm = safeProductPermissions.department;
      if (departmentPerm && !departmentPerm.has_full_access) {
        if (product.departments?.length > 0) {
          const hasAllowedDepartment = product.departments.some(dept => 
            departmentPerm.allowed_items.includes(dept.id)
          );
          if (!hasAllowedDepartment) return false;
        }
      }

      return true;
    });
  };

  const filterNotificationsByUser = (notifications) => {
    if (!notifications) return [];
    
    return notifications.filter(notification => {
      // الإشعارات الشخصية
      const notificationUserId = notification.user_id;
      if (notificationUserId === user?.user_id || notificationUserId === user?.id) {
        return true;
      }
      
      // الإشعارات العامة - للمديرين فقط
      if (notificationUserId === null) {
        return isAdmin || isDepartmentManager;
      }
      
      return false;
    });
  };

  const getEmployeeStats = (data) => {
    if (!data) return { total: 0, personal: 0 };
    
    const total = data.length;
    const personal = data.filter(item => 
      item.created_by === user?.user_id || 
      item.created_by === user?.id ||
      item.employee_id === user?.user_id ||
      item.employee_id === user?.id
    ).length;
    
    return { total, personal };
  };

  return {
    // بيانات أساسية
    user,
    userRoles: safeUserRoles,
    userPermissions: safeUserPermissions,
    productPermissions: safeProductPermissions,
    loading,
    error,

    // فحص الأدوار
    isAdmin,
    isDepartmentManager,
    isSalesEmployee,
    isWarehouseEmployee,
    isCashier,
    isEmployee,
    hasRole,

    // فحص الصلاحيات
    hasPermission,
    canViewAllData,
    canManageEmployees,
    canManageFinances,
    canManageProducts,
    canManageAccounting,
    canManagePurchases,
    canAccessDeliveryPartners,

    // فلترة البيانات
    filterDataByUser,
    filterProductsByPermissions,
    filterNotificationsByUser,
    getEmployeeStats
  };
  } catch (error) {
    console.error('Error in useUnifiedPermissionsSystem:', error);
    // إرجاع قيم افتراضية آمنة في حالة الخطأ
    return {
      // بيانات أساسية
      user: null,
      userRoles: [],
      userPermissions: [],
      productPermissions: {},
      loading: false,
      error: 'خطأ في تحميل الصلاحيات',

      // فحص الأدوار
      isAdmin: false,
      isDepartmentManager: false,
      isSalesEmployee: false,
      isWarehouseEmployee: false,
      isCashier: false,
      isEmployee: false,
      hasRole: () => false,

      // فحص الصلاحيات
      hasPermission: () => false,
      canViewAllData: false,
      canManageEmployees: false,
      canManageFinances: false,
      canManageProducts: false,
      canManageAccounting: false,
      canManagePurchases: false,
      canAccessDeliveryPartners: false,

      // فلترة البيانات
      filterDataByUser: (data) => data || [],
      filterProductsByPermissions: (products) => products || [],
      filterNotificationsByUser: (notifications) => notifications || [],
      getEmployeeStats: () => ({ total: 0, personal: 0 })
    };
  }
};

export default useUnifiedPermissionsSystem;