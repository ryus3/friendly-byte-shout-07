import { useMemo } from 'react';
import useUnifiedPermissions from './useUnifiedPermissions';

export const usePermissionBasedData = () => {
  const {
    user,
    userRoles,
    userPermissions,
    productPermissions,
    loading,
    isAdmin,
    isDepartmentManager,
    isSalesEmployee,
    isWarehouseEmployee,
    isCashier,
    hasRole,
    hasPermission,
    canViewAllData,
    canManageEmployees,
    canManageFinances,
    filterDataByUser,
    filterProductsByPermissions,
    getEmployeeStats
  } = useUnifiedPermissions();

  // الأدوار الأساسية (compatibility مع النظام القديم)
  const isEmployee = useMemo(() => {
    return isSalesEmployee || isWarehouseEmployee || isCashier;
  }, [isSalesEmployee, isWarehouseEmployee, isCashier]);

  const isDeputy = useMemo(() => {
    return isDepartmentManager;
  }, [isDepartmentManager]);

  const isWarehouse = useMemo(() => {
    return isWarehouseEmployee;
  }, [isWarehouseEmployee]);

  // الصلاحيات المتقدمة
  const canManageSettings = useMemo(() => {
    return isAdmin || hasPermission('manage_settings');
  }, [isAdmin, hasPermission]);

  const canAccessDeliveryPartners = useMemo(() => {
    return user?.delivery_partner_access === true;
  }, [user?.delivery_partner_access]);

  const canManageProducts = useMemo(() => {
    return isAdmin || hasPermission('manage_products');
  }, [isAdmin, hasPermission]);

  const canManageAccounting = useMemo(() => {
    return isAdmin || hasPermission('view_accounting');
  }, [isAdmin, hasPermission]);

  const canManagePurchases = useMemo(() => {
    return isAdmin || hasPermission('manage_purchases');
  }, [isAdmin, hasPermission]);

  // فلترة الأرباح حسب المستخدم
  const filterProfitsByUser = useMemo(() => {
    return (profits) => {
      if (!profits) return [];
      if (canViewAllData) return profits;
      return profits.filter(profit => {
        const employeeId = profit.employee_id;
        return employeeId === user?.id || employeeId === user?.user_id;
      });
    };
  }, [canViewAllData, user?.id, user?.user_id]);

  // رموز التليغرام الشخصية
  const getUserSpecificTelegramCode = useMemo(() => {
    return (employeeCodes) => {
      if (!employeeCodes) return [];
      if (canViewAllData) return employeeCodes;
      return employeeCodes.filter(code => {
        const codeUserId = code.user_id;
        return codeUserId === user?.id || codeUserId === user?.user_id;
      });
    };
  }, [canViewAllData, user?.id, user?.user_id]);

  // التحقق من صلاحية الوصول للصفحات
  const canAccessPage = useMemo(() => {
    return (pagePermission) => {
      if (isAdmin) return true;
      return hasPermission(pagePermission);
    };
  }, [isAdmin, hasPermission]);

  // فلترة الإشعارات
  const getNotificationsForUser = useMemo(() => {
    return (notifications) => {
      if (!notifications) return [];
      
      return notifications.filter(notification => {
        const notificationUserId = notification.user_id;
        if (notificationUserId === user?.user_id || notificationUserId === user?.id) {
          return true;
        }
        
        // الإشعارات العامة للمديرين
        if (notificationUserId === null) {
          return isAdmin || isDepartmentManager;
        }
        
        return false;
      });
    };
  }, [user?.id, user?.user_id, isAdmin, isDepartmentManager]);

  // فلترة المتغيرات (للتوافق مع النظام القديم - استخدم النظام الجديد)
  const filterCategoriesByPermission = useMemo(() => {
    return (categories) => {
      if (!categories) return [];
      if (isAdmin) return categories;
      
      const categoryPerm = productPermissions.category;
      if (!categoryPerm || categoryPerm.has_full_access) return categories;
      
      return categories.filter(cat => 
        categoryPerm.allowed_items.includes(cat.id)
      );
    };
  }, [isAdmin, productPermissions.category]);

  const filterSizesByPermission = useMemo(() => {
    return (sizes) => {
      if (!sizes) return [];
      if (isAdmin) return sizes;
      
      const sizePerm = productPermissions.size;
      if (!sizePerm || sizePerm.has_full_access) return sizes;
      
      return sizes.filter(size => 
        sizePerm.allowed_items.includes(size.id)
      );
    };
  }, [isAdmin, productPermissions.size]);

  const filterColorsByPermission = useMemo(() => {
    return (colors) => {
      if (!colors) return [];
      if (isAdmin) return colors;
      
      const colorPerm = productPermissions.color;
      if (!colorPerm || colorPerm.has_full_access) return colors;
      
      return colors.filter(color => 
        colorPerm.allowed_items.includes(color.id)
      );
    };
  }, [isAdmin, productPermissions.color]);

  const filterDepartmentsByPermission = useMemo(() => {
    return (departments) => {
      if (!departments) return [];
      if (isAdmin) return departments;
      
      const departmentPerm = productPermissions.department;
      if (!departmentPerm || departmentPerm.has_full_access) return departments;
      
      return departments.filter(dept => 
        departmentPerm.allowed_items.includes(dept.id)
      );
    };
  }, [isAdmin, productPermissions.department]);

  const filterProductTypesByPermission = useMemo(() => {
    return (productTypes) => {
      if (!productTypes) return [];
      if (isAdmin) return productTypes;
      
      const productTypePerm = productPermissions.product_type;
      if (!productTypePerm || productTypePerm.has_full_access) return productTypes;
      
      return productTypes.filter(type => 
        productTypePerm.allowed_items.includes(type.id)
      );
    };
  }, [isAdmin, productPermissions.product_type]);

  const filterSeasonsOccasionsByPermission = useMemo(() => {
    return (seasonsOccasions) => {
      if (!seasonsOccasions) return [];
      if (isAdmin) return seasonsOccasions;
      
      const seasonPerm = productPermissions.season_occasion;
      if (!seasonPerm || seasonPerm.has_full_access) return seasonsOccasions;
      
      return seasonsOccasions.filter(item => 
        seasonPerm.allowed_items.includes(item.id)
      );
    };
  }, [isAdmin, productPermissions.season_occasion]);

  return {
    // البيانات الأساسية
    user,
    loading,
    
    // الأدوار (النظام الجديد + التوافق مع القديم)
    isAdmin,
    isEmployee,
    isDeputy,
    isWarehouse,
    isDepartmentManager,
    isSalesEmployee,
    isWarehouseEmployee,
    isCashier,
    hasRole,
    
    // الصلاحيات العامة
    canViewAllData,
    canManageSettings,
    canManageEmployees,
    canManageFinances,
    canAccessPage,
    canAccessDeliveryPartners,
    canManageProducts,
    canManageAccounting,
    canManagePurchases,
    
    // فلترة البيانات
    filterDataByUser,
    filterProfitsByUser,
    getUserSpecificTelegramCode,
    getNotificationsForUser,
    
    // فلترة التصنيفات والمتغيرات (للتوافق مع النظام القديم)
    filterCategoriesByPermission,
    filterSizesByPermission,
    filterColorsByPermission,
    filterDepartmentsByPermission,
    filterProductTypesByPermission,
    filterSeasonsOccasionsByPermission,
    filterProductsByPermissions,
    
    // النظام الجديد
    userRoles,
    userPermissions,
    productPermissions,
    getEmployeeStats,
    hasPermission
  };
};

export default usePermissionBasedData;