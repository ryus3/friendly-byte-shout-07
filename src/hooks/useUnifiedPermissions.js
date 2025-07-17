import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const useUnifiedPermissions = () => {
  const { user } = useAuth();
  const [userRoles, setUserRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [productPermissions, setProductPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchUserPermissions();
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchUserPermissions = async () => {
    try {
      setLoading(true);
      
      // 1. Get user roles from new system
      const { data: userRolesData } = await supabase
        .from('user_roles')
        .select(`
          role_id,
          is_active,
          roles (
            id,
            name,
            display_name,
            hierarchy_level
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      setUserRoles(userRolesData || []);

      // 2. Get permissions for user roles
      if (userRolesData?.length > 0) {
        const roleIds = userRolesData.map(ur => ur.role_id);
        
        const { data: permissionsData } = await supabase
          .from('role_permissions')
          .select(`
            permission_id,
            permissions (
              id,
              name,
              display_name,
              category
            )
          `)
          .in('role_id', roleIds);

        const uniquePermissions = [];
        const permissionIds = new Set();
        
        permissionsData?.forEach(rp => {
          if (rp.permissions && !permissionIds.has(rp.permissions.id)) {
            permissionIds.add(rp.permissions.id);
            uniquePermissions.push(rp.permissions);
          }
        });
        
        setPermissions(uniquePermissions);
      }

      // 3. Get product permissions
      const { data: productPermsData } = await supabase
        .from('user_product_permissions')
        .select('*')
        .eq('user_id', user.id);

      const productPermsMap = {};
      productPermsData?.forEach(pp => {
        productPermsMap[pp.permission_type] = {
          has_full_access: pp.has_full_access,
          allowed_items: pp.allowed_items || []
        };
      });
      
      setProductPermissions(productPermsMap);
    } catch (error) {
      console.error('Error fetching user permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Role checks
  const hasRole = (roleName) => {
    return userRoles.some(ur => ur.roles?.name === roleName);
  };

  // Permission checks
  const hasPermission = (permissionName) => {
    return permissions.some(p => p.name === permissionName);
  };

  // Derived role checks based on new system
  const isSuperAdmin = useMemo(() => hasRole('super_admin'), [userRoles]);
  const isDepartmentManager = useMemo(() => hasRole('department_manager'), [userRoles]);
  const isSalesEmployee = useMemo(() => hasRole('sales_employee'), [userRoles]);
  const isWarehouseEmployee = useMemo(() => hasRole('warehouse_employee'), [userRoles]);
  const isCashier = useMemo(() => hasRole('cashier'), [userRoles]);
  
  // Legacy compatibility
  const isAdmin = useMemo(() => isSuperAdmin, [isSuperAdmin]);
  const isEmployee = useMemo(() => isSalesEmployee, [isSalesEmployee]);
  const isDeputy = useMemo(() => isDepartmentManager, [isDepartmentManager]);
  const isWarehouse = useMemo(() => isWarehouseEmployee, [isWarehouseEmployee]);

  // Derived permissions
  const canViewAllData = useMemo(() => hasPermission('view_all_data') || isSuperAdmin, [permissions, isSuperAdmin]);
  const canManageEmployees = useMemo(() => hasPermission('manage_employees') || isSuperAdmin, [permissions, isSuperAdmin]);
  const canManageSettings = useMemo(() => hasPermission('manage_settings') || isSuperAdmin, [permissions, isSuperAdmin]);

  // Data filtering
  const filterDataByUser = useMemo(() => {
    return (data, userIdField = 'created_by') => {
      if (!data) return [];
      if (canViewAllData) return data;
      
      return data.filter(item => {
        const itemUserId = item[userIdField];
        return itemUserId === user?.id;
      });
    };
  }, [canViewAllData, user?.id]);

  const filterProductsByPermissions = useMemo(() => {
    return (products) => {
      if (!products) return [];
      if (isSuperAdmin || canViewAllData) return products;

      return products.filter(product => {
        // Check categories
        const categoryPerm = productPermissions.category;
        if (categoryPerm && !categoryPerm.has_full_access) {
          if (product.categories?.length > 0) {
            const hasAllowedCategory = product.categories.some(cat => 
              categoryPerm.allowed_items.includes(cat.id)
            );
            if (!hasAllowedCategory) return false;
          }
        }

        // Check departments
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
  }, [isSuperAdmin, canViewAllData, productPermissions]);

  const getEmployeeStats = useMemo(() => {
    return (orders, profits) => {
      const filteredOrders = filterDataByUser(orders);
      const filteredProfits = filterDataByUser(profits, 'employee_id');

      const pendingOrders = filteredOrders.filter(o => o.status === 'pending');
      const completedOrders = filteredOrders.filter(o => o.status === 'completed');
      const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.final_amount || 0), 0);
      const totalProfits = filteredProfits.reduce((sum, p) => sum + (p.employee_profit || 0), 0);

      return {
        totalOrders: filteredOrders.length,
        pendingOrders: pendingOrders.length,
        completedOrders: completedOrders.length,
        totalRevenue,
        totalProfits
      };
    };
  }, [filterDataByUser]);

  return {
    user,
    userRoles,
    permissions,
    productPermissions,
    loading,
    hasRole,
    hasPermission,
    // New role checks
    isSuperAdmin,
    isDepartmentManager,
    isSalesEmployee,
    isWarehouseEmployee,
    isCashier,
    // Legacy compatibility
    isAdmin,
    isEmployee,
    isDeputy,
    isWarehouse,
    canViewAllData,
    canManageEmployees,
    canManageSettings,
    filterDataByUser,
    filterProductsByPermissions,
    getEmployeeStats
  };
};

export default useUnifiedPermissions;