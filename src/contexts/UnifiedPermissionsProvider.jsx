import { useState, useEffect, createContext } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * سياق الصلاحيات الموحد - منفصل لتجنب الاستيراد الدائري
 */
export const UnifiedPermissionsContext = createContext(null);

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