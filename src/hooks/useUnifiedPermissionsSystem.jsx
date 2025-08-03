import { useState, useEffect, useMemo, createContext, useContext } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * نظام الصلاحيات الموحد النهائي
 * يجمع كل منطق الصلاحيات في مكان واحد ويحسن الأداء
 */

// سياق عالمي للصلاحيات - يتم تحميله مرة واحدة
const UnifiedPermissionsContext = createContext(null);

export const UnifiedPermissionsProvider = ({ children, user }) => {
  const [permissionsData, setPermissionsData] = useState({
    userRoles: [],
    userPermissions: [],
    productPermissions: {},
    loading: true,
    error: null
  });

  // تحميل الصلاحيات مرة واحدة للمستخدم
  useEffect(() => {
    if (!user?.user_id) {
      setPermissionsData(prev => ({ ...prev, loading: false }));
      return;
    }

    const loadUserPermissions = async () => {
      try {
        setPermissionsData(prev => ({ ...prev, loading: true, error: null }));

        // 1. جلب الأدوار
        const { data: roles, error: rolesError } = await supabase
          .from('user_roles')
          .select(`
            role_id,
            roles (
              id,
              name,
              display_name,
              hierarchy_level
            )
          `)
          .eq('user_id', user.user_id)
          .eq('is_active', true);

        if (rolesError) throw rolesError;

        // 2. جلب الصلاحيات
        const roleIds = roles?.map(ur => ur.role_id) || [];
        let permissions = [];

        if (roleIds.length > 0) {
          const { data: perms, error: permsError } = await supabase
            .from('role_permissions')
            .select(`
              permissions (
                id,
                name,
                display_name,
                category
              )
            `)
            .in('role_id', roleIds);

          if (permsError) throw permsError;
          permissions = perms?.map(rp => rp.permissions).filter(Boolean) || [];
        }

        // 3. جلب صلاحيات المنتجات
        const userRolesList = roles?.map(ur => ur.roles).filter(Boolean) || [];
        const isUserAdmin = userRolesList.some(role => ['super_admin', 'admin'].includes(role.name));
        
        let productPermissions = {};
        if (!isUserAdmin) {
          const { data: productPerms, error: productPermsError } = await supabase
            .from('user_product_permissions')
            .select('*')
            .eq('user_id', user.user_id);

          if (!productPermsError && productPerms) {
            productPerms.forEach(perm => {
              productPermissions[perm.permission_type] = {
                allowed_items: perm.allowed_items || [],
                has_full_access: perm.has_full_access || false
              };
            });
          }
        }

        setPermissionsData({
          userRoles: userRolesList,
          userPermissions: permissions,
          productPermissions,
          loading: false,
          error: null
        });

      } catch (error) {
        console.error('خطأ في تحميل الصلاحيات:', error);
        setPermissionsData(prev => ({
          ...prev,
          loading: false,
          error: error.message
        }));
      }
    };

    loadUserPermissions();
  }, [user?.user_id]);

  return (
    <UnifiedPermissionsContext.Provider value={{ ...permissionsData, user }}>
      {children}
    </UnifiedPermissionsContext.Provider>
  );
};

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

  const canViewAllData = useMemo(() => {
    return isAdmin || isDepartmentManager;
  }, [isAdmin, isDepartmentManager]);

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
};

export default useUnifiedPermissionsSystem;