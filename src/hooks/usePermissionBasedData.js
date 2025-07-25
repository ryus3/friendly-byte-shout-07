import React, { useMemo } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';

export const usePermissionBasedData = () => {
  // Add safety check for context availability
  let user, hasPermission, isAdmin, isDepartmentManager, isSalesEmployee, isWarehouseEmployee, isCashier;
  
  try {
    const authContext = useAuth();
    user = authContext.user;
    const permissionsContext = usePermissions();
    hasPermission = permissionsContext.hasPermission;
    isAdmin = permissionsContext.isAdmin;
    isDepartmentManager = permissionsContext.isDepartmentManager;
    isSalesEmployee = permissionsContext.isSalesEmployee;
    isWarehouseEmployee = permissionsContext.isWarehouseEmployee;
    isCashier = permissionsContext.isCashier;
  } catch (error) {
    console.warn('usePermissionBasedData: Auth context not available, using fallback values');
    // Fallback values when context is not available
    user = null;
    hasPermission = () => false;
    isAdmin = false;
    isDepartmentManager = false;
    isSalesEmployee = false;
    isWarehouseEmployee = false;
    isCashier = false;
  }

  // نستخدم المتغيرات مباشرة من usePermissions دون إعادة تعريفها
  const canViewAllData = useMemo(() => {
    return isAdmin || isDepartmentManager;
  }, [isAdmin, isDepartmentManager]);

  const canManageSettings = useMemo(() => {
    return isAdmin;
  }, [isAdmin]);

  const canManageEmployees = useMemo(() => {
    return isAdmin || isDepartmentManager;
  }, [isAdmin, isDepartmentManager]);

  // صلاحيات شركات التوصيل
  const canAccessDeliveryPartners = useMemo(() => {
    return user?.delivery_partner_access === true;
  }, [user?.delivery_partner_access]);

  // صلاحيات الإدارة العامة
  const canManageProducts = useMemo(() => {
    return isAdmin || isDepartmentManager;
  }, [isAdmin, isDepartmentManager]);

  const canManageAccounting = useMemo(() => {
    return isAdmin || isDepartmentManager;
  }, [isAdmin, isDepartmentManager]);

  const canManagePurchases = useMemo(() => {
    return isAdmin || isDepartmentManager || isWarehouseEmployee;
  }, [isAdmin, isDepartmentManager, isWarehouseEmployee]);

  // فلترة البيانات حسب المستخدم
  const filterDataByUser = useMemo(() => {
    return (data, userIdField = 'created_by') => {
      if (!data) return [];
      if (canViewAllData) return data;
      return data.filter(item => {
        const itemUserId = item[userIdField];
        return itemUserId === user?.id || itemUserId === user?.user_id;
      });
    };
  }, [canViewAllData, user?.id, user?.user_id]);

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

  const getUserSpecificTelegramCode = useMemo(() => {
    return (employeeCodes) => {
      if (!employeeCodes) return [];
      if (canViewAllData) return employeeCodes;
      // الموظف يرى رمزه الشخصي فقط
      return employeeCodes.filter(code => {
        const codeUserId = code.user_id;
        return codeUserId === user?.id || codeUserId === user?.user_id;
      });
    };
  }, [canViewAllData, user?.id, user?.user_id]);

  const canAccessPage = useMemo(() => {
    return (pagePermission) => {
      if (isAdmin) return true;
      return hasPermission(pagePermission);
    };
  }, [isAdmin, hasPermission]);

  const getNotificationsForUser = useMemo(() => {
    return (notifications) => {
      if (!notifications) return [];
      
      return notifications.filter(notification => {
        // الإشعارات الشخصية للمستخدم
        const notificationUserId = notification.user_id;
        if (notificationUserId === user?.user_id || notificationUserId === user?.id) {
          return true;
        }
        
        // الإشعارات العامة (null) - المدير والنائب يرون الإشعارات العامة
        if (notificationUserId === null) {
          return isAdmin || isDepartmentManager;
        }
        
        return false;
      });
    };
  }, [user?.id, user?.user_id, isAdmin, isDepartmentManager]);

  // فلترة التصنيفات والمتغيرات حسب الصلاحيات - استخدام صلاحيات المنتجات من السياق
  const filterCategoriesByPermission = useMemo(() => {
    return (categories) => {
      if (!categories) return [];
      if (isAdmin) return categories;
      
      // استخدام صلاحيات المنتجات من UnifiedAuthContext
      const categoryPermissions = user?.productPermissions?.category;
      if (!categoryPermissions) {
        return []; // لا توجد صلاحيات = لا يرى شيء
      }
      
      if (categoryPermissions.has_full_access) {
        return categories;
      }
      
      return categories.filter(cat => categoryPermissions.allowed_items.includes(cat.id));
    };
  }, [isAdmin, user?.productPermissions]);

  const filterSizesByPermission = useMemo(() => {
    return (sizes) => {
      if (!sizes) return [];
      if (isAdmin) return sizes;
      
      const sizePermissions = user?.productPermissions?.size;
      if (!sizePermissions) return [];
      
      if (sizePermissions.has_full_access) return sizes;
      return sizes.filter(size => sizePermissions.allowed_items.includes(size.id));
    };
  }, [isAdmin, user?.productPermissions]);

  const filterColorsByPermission = useMemo(() => {
    return (colors) => {
      if (!colors) return [];
      if (isAdmin) return colors;
      
      const colorPermissions = user?.productPermissions?.color;
      if (!colorPermissions) return [];
      
      if (colorPermissions.has_full_access) return colors;
      return colors.filter(color => colorPermissions.allowed_items.includes(color.id));
    };
  }, [isAdmin, user?.productPermissions]);

  const filterDepartmentsByPermission = useMemo(() => {
    return (departments) => {
      if (!departments) return [];
      if (isAdmin) return departments;
      
      const departmentPermissions = user?.productPermissions?.department;
      if (!departmentPermissions) return [];
      
      if (departmentPermissions.has_full_access) return departments;
      return departments.filter(dept => departmentPermissions.allowed_items.includes(dept.id));
    };
  }, [isAdmin, user?.productPermissions]);

  // فلترة أنواع المنتجات والمواسم
  const filterProductTypesByPermission = useMemo(() => {
    return (productTypes) => {
      if (!productTypes) return [];
      if (isAdmin) return productTypes;
      
      const productTypePermissions = user?.productPermissions?.product_type;
      if (!productTypePermissions) return [];
      
      if (productTypePermissions.has_full_access) return productTypes;
      return productTypes.filter(type => productTypePermissions.allowed_items.includes(type.id));
    };
  }, [isAdmin, user?.productPermissions]);

  const filterSeasonsOccasionsByPermission = useMemo(() => {
    return (seasonsOccasions) => {
      if (!seasonsOccasions) return [];
      if (isAdmin) return seasonsOccasions;
      
      const seasonOccasionPermissions = user?.productPermissions?.season_occasion;
      if (!seasonOccasionPermissions) return [];
      
      if (seasonOccasionPermissions.has_full_access) return seasonsOccasions;
      return seasonsOccasions.filter(item => seasonOccasionPermissions.allowed_items.includes(item.id));
    };
  }, [isAdmin, user?.productPermissions]);

  // فلترة المنتجات المدمجة حسب كل الصلاحيات
  const filterProductsByPermissions = useMemo(() => {
    return (products) => {
      if (!products) return [];
      if (isAdmin) return products;
      
      // فلترة المنتجات حسب التصنيفات والأقسام والأنواع والمواسم المسموحة
      return products.filter(product => {
        // فحص التصنيفات
        if (product.categories && product.categories.length > 0) {
          const allowedCategories = filterCategoriesByPermission(product.categories);
          if (allowedCategories.length === 0) return false;
        }
        
        // فحص الأقسام
        if (product.departments && product.departments.length > 0) {
          const allowedDepartments = filterDepartmentsByPermission(product.departments);
          if (allowedDepartments.length === 0) return false;
        }
        
        return true;
      });
    };
  }, [isAdmin, filterCategoriesByPermission, filterDepartmentsByPermission]);

  return {
    // بيانات المستخدم والأدوار
    user,
    isAdmin,
    isEmployee: isSalesEmployee,
    isDeputy: isDepartmentManager,
    isWarehouse: isWarehouseEmployee,
    isCashier,
    
    // صلاحيات عامة
    canViewAllData,
    canManageSettings,
    canManageEmployees,
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
    
    // فلترة التصنيفات والمتغيرات
    filterCategoriesByPermission,
    filterSizesByPermission,
    filterColorsByPermission,
    filterDepartmentsByPermission,
    filterProductTypesByPermission,
    filterSeasonsOccasionsByPermission,
    filterProductsByPermissions,
    
    // وظائف الصلاحيات
    hasPermission
  };
};

export default usePermissionBasedData;