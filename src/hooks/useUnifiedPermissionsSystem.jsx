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
      canViewSupervisedData: false,
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

  const { user, userRoles, userPermissions, productPermissions, loading, error } = context;

  // === فحص الأدوار (محسن بـ useMemo) ===
  const isAdmin = useMemo(() => {
    return userRoles?.some(role => ['super_admin', 'admin'].includes(role.name)) || false;
  }, [userRoles]);

  const isDepartmentManager = useMemo(() => {
    return userRoles?.some(role => ['department_manager', 'deputy_manager'].includes(role.name)) || false;
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

  // إضافة isEmployee - كل من له دور فعال وليس مديراً
  const isEmployee = useMemo(() => {
    return userRoles?.length > 0 && !isAdmin;
  }, [userRoles, isAdmin]);

  const hasRole = useMemo(() => {
    return (roleName) => userRoles?.some(role => role.name === roleName) || false;
  }, [userRoles]);

  // === فحص الصلاحيات (محسن بـ useMemo) ===
  const hasPermission = useMemo(() => {
    return (permissionName) => {
      if (isAdmin) return true; // المدير له كل الصلاحيات
      return userPermissions?.some(perm => perm.name === permissionName) || false;
    };
  }, [userPermissions, isAdmin]);

  // ✅ فقط المدير العام يرى جميع البيانات - مدير القسم يرى فقط بياناته وموظفيه
  const canViewAllData = useMemo(() => {
    return isAdmin; // فقط المدير العام
  }, [isAdmin]);

  // ✅ صلاحية جديدة لمدير القسم
  const canViewSupervisedData = useMemo(() => {
    return isDepartmentManager && !isAdmin;
  }, [isDepartmentManager, isAdmin]);

  const canManageEmployees = useMemo(() => {
    return isAdmin || hasPermission('manage_employees');
  }, [isAdmin, hasPermission]);

  const canManageFinances = useMemo(() => {
    return isAdmin || hasPermission('manage_finances');
  }, [isAdmin, hasPermission]);

  const canManageProducts = useMemo(() => {
    return isAdmin || isDepartmentManager || hasPermission('manage_products');
  }, [isAdmin, isDepartmentManager, hasPermission]);

  const canManageAccounting = useMemo(() => {
    return isAdmin || isDepartmentManager || hasPermission('manage_accounting');
  }, [isAdmin, isDepartmentManager, hasPermission]);

  const canManagePurchases = useMemo(() => {
    return isAdmin || isDepartmentManager || isWarehouseEmployee || hasPermission('manage_purchases');
  }, [isAdmin, isDepartmentManager, isWarehouseEmployee, hasPermission]);

  const canAccessDeliveryPartners = useMemo(() => {
    return user?.delivery_partner_access === true;
  }, [user?.delivery_partner_access]);

  // === فلترة البيانات (محسن بـ useMemo) ===
  const filterDataByUser = useMemo(() => {
    return (data, userIdField = 'created_by') => {
      if (!data) return [];
      if (canViewAllData) return data;
      return data.filter(item => {
        const itemUserId = item[userIdField];
        return itemUserId === user?.user_id || itemUserId === user?.id;
      });
    };
  }, [canViewAllData, user?.user_id, user?.id]);

  const filterProductsByPermissions = useMemo(() => {
    return (products) => {
      if (!products) return [];
      if (isAdmin) return products; // المدير يرى كل شيء

      return products.filter(product => {
        // فحص التصنيفات
        const categoryPerm = productPermissions.category;
        if (categoryPerm && !categoryPerm.has_full_access) {
          if (product.categories?.length > 0) {
            const hasAllowedCategory = product.categories.some(cat => 
              categoryPerm.allowed_items.includes(cat.id)
            );
            if (!hasAllowedCategory) return false;
          }
        }

        // فحص الأقسام  
        const departmentPerm = productPermissions.department;
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
  }, [isAdmin, productPermissions]);

  const filterNotificationsByUser = useMemo(() => {
    return (notifications) => {
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
  }, [user?.id, user?.user_id, isAdmin, isDepartmentManager]);

  const getEmployeeStats = useMemo(() => {
    return (data) => {
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
  }, [user?.user_id, user?.id]);

  return {
    // بيانات أساسية
    user,
    userRoles,
    userPermissions,
    productPermissions,
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
    canViewSupervisedData,
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
};

export default useUnifiedPermissionsSystem;