import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { supabase } from '@/lib/customSupabaseClient';

export const useUnifiedPermissions = (passedUser) => {
  // تعريف الـ state أولاً
  const [userRoles, setUserRoles] = useState([]);
  const [userPermissions, setUserPermissions] = useState([]);
  const [productPermissions, setProductPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  
  // استدعاء useAuth مع معالجة الأخطاء
  let auth;
  try {
    auth = useAuth();
  } catch (error) {
    console.warn('useAuth hook called outside React context');
    auth = null;
  }
  
  // تحديد المستخدم - passedUser له الأولوية
  const user = passedUser || auth?.user;
  
  // التحقق من صحة السياق
  const hasValidContext = user && (passedUser || auth);

  // جلب أدوار وصلاحيات المستخدم
  useEffect(() => {
    // إذا لم يكن لدينا سياق صحيح أو مستخدم، نتوقف
    if (!hasValidContext || !user?.user_id) {
      setLoading(false);
      return;
    }

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

        // جلب صلاحيات المنتجات (محدود للمديرين)
        const userRolesList = roles?.map(ur => ur.roles) || [];
        const isUserAdmin = userRolesList.some(role => ['super_admin', 'admin'].includes(role.name));
        
        let productPermissions = {};
        if (!isUserAdmin) {
          const { data: productPerms } = await supabase
            .from('user_product_permissions')
            .select('*')
            .eq('user_id', user.user_id);

          productPerms?.forEach(perm => {
            productPermissions[perm.permission_type] = {
              allowed_items: perm.allowed_items || [],
              has_full_access: perm.has_full_access || false
            };
          });
        }

        // تحديث الحالة مرة واحدة
        setUserRoles(userRolesList);
        setUserPermissions(permissions || []);
        setProductPermissions(productPermissions);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching permissions:', error);
        setLoading(false);
      }
    };

    fetchUserPermissions();
  }, [user?.user_id]);

  // فحص الأدوار - محسن للأداء
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

  // فحص الصلاحيات - محسن للأداء
  const hasPermission = useMemo(() => {
    return (permissionName) => {
      // المدير له كل الصلاحيات
      if (isAdmin) return true;
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

  // فلترة البيانات حسب المستخدم
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

  // فلترة المنتجات حسب الصلاحيات - محسن للأداء
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

  // إحصائيات الموظف
  const getEmployeeStats = useMemo(() => {
    return (data) => {
      if (!data) return { total: 0, personal: 0 };
      
      const total = data.length;
      const personal = data.filter(item => 
        item.created_by === user?.user_id || item.created_by === user?.id
      ).length;
      
      return { total, personal };
    };
  }, [user?.user_id, user?.id]);

  // إذا لم يكن لدينا سياق صحيح، نعيد قيم افتراضية آمنة
  if (!hasValidContext) {
    return {
      userRoles: [],
      userPermissions: [],
      productPermissions: {},
      loading: false,
      isAdmin: false,
      isDepartmentManager: false,
      isSalesEmployee: false,
      isWarehouseEmployee: false,
      isCashier: false,
      hasRole: () => false,
      hasPermission: () => false,
      canViewAllData: false,
      canManageEmployees: false,
      canManageFinances: false,
      filterDataByUser: (data) => data || [],
      filterProductsByPermissions: (products) => products || [],
      getEmployeeStats: () => ({ total: 0, personal: 0 })
    };
  }

  return {
    // بيانات
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