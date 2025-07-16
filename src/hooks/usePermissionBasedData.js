import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export const usePermissionBasedData = () => {
  const { user, hasPermission } = useAuth();

  const isAdmin = useMemo(() => {
    return user?.role === 'admin';
  }, [user?.role]);

  const isEmployee = useMemo(() => {
    return user?.role === 'employee';
  }, [user?.role]);

  const isDeputy = useMemo(() => {
    return user?.role === 'deputy';
  }, [user?.role]);

  const canViewAllData = useMemo(() => {
    return isAdmin || hasPermission('view_all_orders') || hasPermission('*');
  }, [isAdmin, hasPermission]);

  const canManageSettings = useMemo(() => {
    return isAdmin || hasPermission('manage_settings');
  }, [isAdmin, hasPermission]);

  const canManageEmployees = useMemo(() => {
    return isAdmin || hasPermission('manage_employees');
  }, [isAdmin, hasPermission]);

  const filterDataByUser = useMemo(() => {
    return (data, userIdField = 'created_by') => {
      if (!data) return [];
      if (canViewAllData) return data;
      return data.filter(item => item[userIdField] === user?.id || item[userIdField] === user?.user_id);
    };
  }, [canViewAllData, user?.id, user?.user_id]);

  const filterProfitsByUser = useMemo(() => {
    return (profits) => {
      if (!profits) return [];
      if (canViewAllData) return profits;
      return profits.filter(profit => profit.employee_id === user?.id || profit.employee_id === user?.user_id);
    };
  }, [canViewAllData, user?.id, user?.user_id]);

  const getUserSpecificTelegramCode = useMemo(() => {
    return (employeeCodes) => {
      if (!employeeCodes) return [];
      if (canViewAllData) return employeeCodes;
      return employeeCodes.filter(code => code.user_id === user?.id || code.user_id === user?.user_id);
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
      if (canViewAllData) return notifications; // المدير يرى كل الإشعارات
      
      // الموظف يرى فقط إشعاراته الشخصية أو الإشعارات العامة للموظفين
      return notifications.filter(notification => {
        // الإشعارات الشخصية للمستخدم
        if (notification.user_id === user?.user_id || notification.user_id === user?.id) {
          return true;
        }
        // الإشعارات العامة (null) فقط للمدراء والنواب
        if (notification.user_id === null && (isAdmin || isDeputy)) {
          return true;
        }
        return false;
      });
    };
  }, [canViewAllData, user?.id, user?.user_id, isAdmin, isDeputy]);

  const filterCategoriesByPermission = useMemo(() => {
    return (categories) => {
      if (!categories) return [];
      if (isAdmin) return categories;
      
      try {
        const categoryPermissions = JSON.parse(user?.category_permissions || '["all"]');
        if (categoryPermissions.includes('all')) return categories;
        return categories.filter(cat => categoryPermissions.includes(cat.id));
      } catch (e) {
        return categories; // fallback إذا فشل التحليل
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
        return sizes;
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
        return colors;
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
        return departments;
      }
    };
  }, [isAdmin, user?.department_permissions]);

  return {
    user,
    isAdmin,
    isEmployee,
    isDeputy,
    canViewAllData,
    canManageSettings,
    canManageEmployees,
    canAccessPage,
    filterDataByUser,
    filterProfitsByUser,
    getUserSpecificTelegramCode,
    getNotificationsForUser,
    filterCategoriesByPermission,
    filterSizesByPermission,
    filterColorsByPermission,
    filterDepartmentsByPermission,
    hasPermission
  };
};

export default usePermissionBasedData;