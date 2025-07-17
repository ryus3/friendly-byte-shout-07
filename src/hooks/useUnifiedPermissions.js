import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { supabase } from '@/lib/customSupabaseClient';

export const useUnifiedPermissions = (passedUser) => {
  const auth = useAuth();
  const user = passedUser || auth?.user;
  const [userRoles, setUserRoles] = useState([]);
  const [userPermissions, setUserPermissions] = useState([]);
  const [productPermissions, setProductPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  // جلب أدوار وصلاحيات المستخدم
  useEffect(() => {
    if (!user?.user_id) return;

    const fetchUserPermissions = async () => {
      try {
        setLoading(true);

        // جلب أدوار المستخدم
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

        // جلب صلاحيات المستخدم عبر الأدوار
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
          permissions = perms?.map(rp => rp.permissions) || [];
        }

        // جلب صلاحيات المنتجات
        const { data: productPerms, error: productPermsError } = await supabase
          .from('user_product_permissions')
          .select('*')
          .eq('user_id', user.user_id);

        if (productPermsError) throw productPermsError;

        // تنظيم صلاحيات المنتجات
        const productPermissionsMap = {};
        productPerms?.forEach(perm => {
          productPermissionsMap[perm.permission_type] = {
            allowed_items: perm.allowed_items || [],
            has_full_access: perm.has_full_access || false
          };
        });

        setUserRoles(roles || []);
        setUserPermissions(permissions || []);
        setProductPermissions(productPermissionsMap);
      } catch (error) {
        console.error('خطأ في جلب صلاحيات المستخدم:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserPermissions();
  }, [user?.user_id]);

  // التحقق من صلاحية معينة
  const hasPermission = useMemo(() => {
    return (permissionName) => {
      return userPermissions.some(perm => perm.name === permissionName);
    };
  }, [userPermissions]);

  // التحقق من دور معين
  const hasRole = useMemo(() => {
    return (roleName) => {
      return userRoles.some(ur => ur.roles.name === roleName);
    };
  }, [userRoles]);

  // فحص الأدوار الأساسية
  const isAdmin = useMemo(() => hasRole('super_admin'), [hasRole]);
  const isDepartmentManager = useMemo(() => hasRole('department_manager'), [hasRole]);
  const isSalesEmployee = useMemo(() => hasRole('sales_employee'), [hasRole]);
  const isWarehouseEmployee = useMemo(() => hasRole('warehouse_employee'), [hasRole]);
  const isCashier = useMemo(() => hasRole('cashier'), [hasRole]);

  // فحص الصلاحيات الأساسية
  const canViewAllData = useMemo(() => {
    return isAdmin || hasPermission('view_all_data');
  }, [isAdmin, hasPermission]);

  const canManageEmployees = useMemo(() => {
    return isAdmin || hasPermission('manage_employees');
  }, [isAdmin, hasPermission]);

  const canManageFinances = useMemo(() => {
    return isAdmin || hasPermission('manage_finances');
  }, [isAdmin, hasPermission]);

  // فلترة البيانات حسب الصلاحيات
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

  // فلترة المنتجات حسب الصلاحيات
  const filterProductsByPermissions = useMemo(() => {
    return (products) => {
      if (!products) return [];
      if (isAdmin) return products;

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

  // حساب إحصائيات الموظف الشخصية
  const getEmployeeStats = useMemo(() => {
    return (orders, profits) => {
      const userOrders = filterDataByUser(orders);
      const userProfits = filterDataByUser(profits, 'employee_id');

      const pendingOrders = userOrders.filter(o => o.status === 'pending');
      const completedOrders = userOrders.filter(o => o.status === 'completed');
      const pendingProfits = userProfits.filter(p => p.status === 'pending');
      const settledProfits = userProfits.filter(p => p.status === 'settled');

      return {
        totalOrders: userOrders.length,
        pendingOrders: pendingOrders.length,
        completedOrders: completedOrders.length,
        totalRevenue: userOrders.reduce((sum, o) => sum + (o.final_amount || 0), 0),
        pendingProfits: pendingProfits.reduce((sum, p) => sum + (p.employee_profit || 0), 0),
        settledProfits: settledProfits.reduce((sum, p) => sum + (p.employee_profit || 0), 0),
        totalProfits: userProfits.reduce((sum, p) => sum + (p.employee_profit || 0), 0)
      };
    };
  }, [filterDataByUser]);

  return {
    // البيانات الأساسية
    user,
    userRoles,
    userPermissions,
    productPermissions,
    loading,

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

    // فلترة البيانات
    filterDataByUser,
    filterProductsByPermissions,
    getEmployeeStats
  };
};

export default useUnifiedPermissions;