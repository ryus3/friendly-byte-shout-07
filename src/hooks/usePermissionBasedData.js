import { useMemo } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';

export const usePermissionBasedData = () => {
  const { user } = useAuth();
  const { hasPermission, isAdmin, isDepartmentManager, isSalesEmployee, isWarehouseEmployee, isCashier } = usePermissions();

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

  // فلترة التصنيفات والمتغيرات حسب الصلاحيات
  const filterCategoriesByPermission = useMemo(() => {
    return (categories) => {
      if (!categories) return [];
      if (isAdmin) return categories;
      
      try {
        const categoryPermissions = JSON.parse(user?.category_permissions || '["all"]');
        if (categoryPermissions.includes('all')) return categories;
        return categories.filter(cat => categoryPermissions.includes(cat.id));
      } catch (e) {
        console.warn('خطأ في تحليل صلاحيات التصنيفات:', e);
        return []; // أكثر أماناً للموظفين
      }
    };
  }, [isAdmin, user?.category_permissions]);

  const filterSizesByPermission = useMemo(() => {
    return (sizes) => {
      if (!sizes) return [];
      if (isAdmin) return sizes;
      
      try {
        const sizePermissions = JSON.parse(user?.size_permissions || '["all"]');
        if (sizePermissions.includes('all')) return sizes;
        return sizes.filter(size => sizePermissions.includes(size.id));
      } catch (e) {
        console.warn('خطأ في تحليل صلاحيات الأحجام:', e);
        return [];
      }
    };
  }, [isAdmin, user?.size_permissions]);

  const filterColorsByPermission = useMemo(() => {
    return (colors) => {
      if (!colors) return [];
      if (isAdmin) return colors;
      
      try {
        const colorPermissions = JSON.parse(user?.color_permissions || '["all"]');
        if (colorPermissions.includes('all')) return colors;
        return colors.filter(color => colorPermissions.includes(color.id));
      } catch (e) {
        console.warn('خطأ في تحليل صلاحيات الألوان:', e);
        return [];
      }
    };
  }, [isAdmin, user?.color_permissions]);

  const filterDepartmentsByPermission = useMemo(() => {
    return (departments) => {
      if (!departments) return [];
      if (isAdmin) return departments;
      
      try {
        const departmentPermissions = JSON.parse(user?.department_permissions || '["all"]');
        if (departmentPermissions.includes('all')) return departments;
        return departments.filter(dept => departmentPermissions.includes(dept.id));
      } catch (e) {
        console.warn('خطأ في تحليل صلاحيات الأقسام:', e);
        return [];
      }
    };
  }, [isAdmin, user?.department_permissions]);

  // فلترة أنواع المنتجات والمواسم
  const filterProductTypesByPermission = useMemo(() => {
    return (productTypes) => {
      if (!productTypes) return [];
      if (isAdmin) return productTypes;
      
      try {
        const productTypePermissions = JSON.parse(user?.product_type_permissions || '["all"]');
        if (productTypePermissions.includes('all')) return productTypes;
        return productTypes.filter(type => productTypePermissions.includes(type.id));
      } catch (e) {
        console.warn('خطأ في تحليل صلاحيات أنواع المنتجات:', e);
        return [];
      }
    };
  }, [isAdmin, user?.product_type_permissions]);

  const filterSeasonsOccasionsByPermission = useMemo(() => {
    return (seasonsOccasions) => {
      if (!seasonsOccasions) return [];
      if (isAdmin) return seasonsOccasions;
      
      try {
        const seasonOccasionPermissions = JSON.parse(user?.season_occasion_permissions || '["all"]');
        if (seasonOccasionPermissions.includes('all')) return seasonsOccasions;
        return seasonsOccasions.filter(item => seasonOccasionPermissions.includes(item.id));
      } catch (e) {
        console.warn('خطأ في تحليل صلاحيات المواسم والمناسبات:', e);
        return [];
      }
    };
  }, [isAdmin, user?.season_occasion_permissions]);

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