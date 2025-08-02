import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from '@/components/ui/use-toast.js';
import { supabase } from '@/lib/customSupabaseClient.js';

const UnifiedAuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(UnifiedAuthContext);
  if (!context) {
    // إرجاع قيم افتراضية آمنة بدلاً من رمي خطأ
    return {
      user: null,
      session: null,
      loading: false,
      allUsers: [],
      pendingRegistrations: [],
      userRoles: [],
      userPermissions: [],
      productPermissions: {},
      hasPermission: () => false,
      hasRole: () => false,
      isAdmin: false,
      isDepartmentManager: false,
      isSalesEmployee: false,
      isWarehouseEmployee: false,
      isCashier: false,
      canViewAllData: false,
      canManageEmployees: false,
      canManageFinances: false,
      filterDataByUser: (data) => data || [],
      filterProductsByPermissions: (products) => products || [],
      getEmployeeStats: () => ({ total: 0, personal: 0 }),
      login: async () => false,
      register: async () => false,
      logout: async () => {},
      resetPassword: async () => false,
      updatePassword: async () => false,
      refreshUserData: async () => {},
      updateUserStatus: async () => false,
      updateUserRole: async () => false
    };
  }
  return context;
};

export const UnifiedAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [pendingRegistrations, setPendingRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // حالات الصلاحيات
  const [userRoles, setUserRoles] = useState([]);
  const [userPermissions, setUserPermissions] = useState([]);
  const [productPermissions, setProductPermissions] = useState({});

  const fetchUserProfile = useCallback(async (supabaseUser) => {
    if (!supabase || !supabaseUser) return null;
    
    try {
      // جلب بيانات المستخدم الأساسية مع الأدوار
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(`
          *,
          user_roles!user_roles_user_id_fkey!inner(
            roles(
              name,
              display_name,
              hierarchy_level
            )
          )
        `)
        .eq('user_id', supabaseUser.id)
        .eq('user_roles.is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      if (!profile) {
        return { ...supabaseUser, is_new: true, status: 'pending' };
      }

      // استخراج الأدوار
      const roles = profile.user_roles?.map(ur => ur.roles.name) || [];
      
      return { 
        ...supabaseUser, 
        ...profile,
        roles,
        // توحيد المعرف: استخدم id من supabaseUser (وهو auth.users.id)
        id: supabaseUser.id,
        user_id: supabaseUser.id  // للتوافق مع الكود القديم
      };
    } catch (error) {
      console.error('Profile fetch failed:', error);
      return null;
    }
  }, []);

  const fetchAdminData = useCallback(async () => {
    if (!supabase) return;
    
    try {
      // جلب جميع المستخدمين مع أدوارهم
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          user_roles!user_roles_user_id_fkey(
            roles(
              name,
              display_name,
              hierarchy_level
            ),
            is_active
          )
        `);
      
      if (error) {
        console.error('Error fetching all users:', error);
        return;
      }
      
      // إضافة الأدوار لكل مستخدم
      const usersWithRoles = data.map(user => {
        const activeRoles = user.user_roles
          ?.filter(ur => ur.is_active)
          ?.map(ur => ur.roles.name) || [];
        
        
        return {
          ...user,
          roles: activeRoles
        };
      });
      
      const pending = usersWithRoles.filter(u => u.status === 'pending');
      setAllUsers(usersWithRoles);
      setPendingRegistrations(pending);
    } catch (error) {
      console.error('Admin data fetch failed:', error);
    }
  }, []);

  // Set up auth state listener
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        
        if (session?.user) {
          // Defer profile fetch to avoid blocking
          setTimeout(async () => {
            const profile = await fetchUserProfile(session.user);
            if (profile?.status === 'active') {
              setUser(profile);
            } else {
              setUser(null);
              if (profile?.status === 'pending') {
                toast({ 
                  title: "حسابك قيد المراجعة", 
                  description: "سيقوم المدير بمراجعة طلبك وتفعيله قريباً.", 
                  duration: 7000 
                });
              }
            }
            setLoading(false);
          }, 0);
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setTimeout(async () => {
          const profile = await fetchUserProfile(session.user);
          if (profile?.status === 'active') {
            setUser(profile);
          } else {
            setUser(null);
          }
          setLoading(false);
        }, 0);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserProfile]);

  // جلب صلاحيات المستخدم
  useEffect(() => {
    if (!user?.user_id) return;

    const fetchUserPermissions = async () => {
      try {
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
      }
    };

    fetchUserPermissions();
  }, [user?.user_id]);

  // Fetch admin data when needed
  useEffect(() => {
    if (user?.status === 'active') {
      // Defer admin data fetch
      setTimeout(() => {
        fetchAdminData();
      }, 100);
    } else if (user) {
      setAllUsers([user]);
    }
  }, [user, fetchAdminData]);

  const login = async (loginIdentifier, password) => {
    if (!supabase) {
      return { success: false, error: 'Supabase not connected.' };
    }

    setLoading(true);
    let email = loginIdentifier;
    const isEmail = loginIdentifier.includes('@');

    try {
      if (!isEmail) {
        // Use the smart auth function
        const { data: authResult, error: authError } = await supabase
          .rpc('auth_with_username', { 
            username_input: loginIdentifier, 
            password_input: password 
          });
        
        if (authError || !authResult || authResult.length === 0) {
          throw new Error('اسم المستخدم غير صحيح أو غير موجود.');
        }
        
        const result = authResult[0];
        if (!result.success) {
          throw new Error(result.error_message || 'خطأ في التحقق من اسم المستخدم.');
        }
        email = result.user_email;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('كلمة المرور غير صحيحة.');
        }
        throw error;
      }

      const profile = await fetchUserProfile(data.user);
      if (profile?.status !== 'active') {
        await supabase.auth.signOut();
        throw new Error('حسابك غير نشط. يرجى مراجعة المدير.');
      }
      
      setUser(profile);
      return { success: true };

    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message || 'حدث خطأ غير متوقع.' };
    } finally {
      setLoading(false);
    }
  };

  const registerWithEmail = async (fullName, username, email, password) => {
    if (!supabase) {
      toast({ title: "وضع العرض", description: "لا يمكن تسجيل حسابات جديدة في الوضع المحلي.", variant: "destructive" });
      return { success: false, error: "Local mode" };
    }

    setLoading(true);
    try {
      // Check if this is the first user
      const { count: userCount, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;
      const isFirstUser = userCount === 0;

      // Check for existing username
      const { data: usernameExists, error: usernameCheckError } = await supabase
        .rpc('username_exists', { p_username: username });
      
      if (usernameCheckError) {
        throw new Error("حدث خطأ أثناء التحقق من اسم المستخدم.");
      }
      if (usernameExists) {
        throw new Error('اسم المستخدم هذا موجود بالفعل.');
      }
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName,
            username: username,
          }
        }
      });

      if (error) {
        if (error.message.includes('unique constraint')) {
          throw new Error('هذا البريد الإلكتروني مسجل بالفعل.');
        }
        throw error;
      }

      if (isFirstUser) {
        toast({
          title: "أهلاً بك أيها المدير!",
          description: `مرحباً ${fullName}، تم إنشاء حساب المدير الخاص بك بنجاح.`,
          duration: 7000,
        });
      } else {
        setTimeout(() => {
          fetchAdminData();
        }, 1000);
        
        toast({
          title: "تم التسجيل بنجاح",
          description: `مرحباً ${fullName}، سيقوم المدير بمراجعة طلبك وتفعيله قريباً.`,
        });
      }

      return { success: true };

    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: "خطأ في التسجيل",
        description: error.message,
        variant: "destructive",
      });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async (email) => {
    if (!supabase) {
      toast({ title: "وضع العرض", description: "هذه الميزة غير متاحة في الوضع المحلي.", variant: "destructive" });
      return { success: false, error: "Local mode" };
    }
    
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    setLoading(false);
    
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      return { success: false, error };
    }
    
    toast({ title: 'تم الإرسال', description: 'تفقد بريدك الإلكتروني للحصول على رابط استعادة كلمة المرور.' });
    return { success: true };
  };

  const logout = async () => {
    setLoading(true);
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setLoading(false);
  };

  const updateUser = async (userId, data) => {
    if (!supabase) {
      toast({ title: "وضع العرض", description: "لا يمكن تحديث المستخدمين في الوضع المحلي.", variant: "destructive" });
      return { success: false, error: "Local mode" };
    }
    
    try {
      const { data: result, error } = await supabase
        .from('profiles')
        .update(data)
        .eq('user_id', userId)
        .select();
        
      if (error) {
        console.error('Update error:', error);
        toast({ title: 'خطأ', description: `فشل تحديث المستخدم: ${error.message}`, variant: 'destructive' });
        return { success: false, error };
      }
      
      if (!result || result.length === 0) {
        toast({ title: 'خطأ', description: 'لم يتم العثور على المستخدم أو لا توجد صلاحيات للتحديث', variant: 'destructive' });
        return { success: false, error: 'No rows updated' };
      }
      
      toast({ title: 'نجاح', description: 'تم تحديث المستخدم بنجاح.' });
      
      // تحديث البيانات المحلية
      if (userId === user?.user_id) {
        const updatedProfile = await fetchUserProfile(user);
        setUser(updatedProfile);
      }
      
      await fetchAdminData();
      return { success: true };
    } catch (error) {
      console.error('updateUser error:', error);
      toast({ title: 'خطأ', description: `خطأ غير متوقع: ${error.message}`, variant: 'destructive' });
      return { success: false, error };
    }
  };

  const updateProfile = async (profileData) => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('user_id', user.user_id || user.id)
        .select()
        .single();

      if (error) throw error;
      
      setUser(prevUser => ({ ...prevUser, ...data }));
      toast({ title: 'نجاح', description: 'تم تحديث الملف الشخصي بنجاح.' });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      throw error; // إعادة طرح الخطأ لمعالجته في المكون
    } finally {
      setLoading(false);
    }
  };

  // دالة منفصلة للتوافق مع الكود القديم
  const updateUserProfile = async (profileData) => {
    return updateProfile({ full_name: profileData.full_name, username: profileData.username });
  };

  const changePassword = async (newPassword) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: 'نجاح', description: 'تم تغيير كلمة المرور بنجاح.' });
      return { success: true };
    } catch (error) {
      console.error("Error changing password:", error);
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  // إنشاء functions الصلاحيات
  const hasPermission = useMemo(() => {
    return (permissionName) => {
      if (!user || !userPermissions) return false;
      
      // Super admin and admin have all permissions
      if (user.role === 'super_admin' || user.role === 'admin') {
        return true;
      }
      
      return userPermissions.some(perm => perm.name === permissionName);
    };
  }, [user, userPermissions]);

  const hasRole = useMemo(() => {
    return (roleName) => {
      return userRoles.some(ur => ur.roles.name === roleName);
    };
  }, [userRoles]);

  const isAdmin = useMemo(() => hasRole('super_admin') || hasRole('admin'), [hasRole]);

  // فلترة المنتجات حسب الصلاحيات
  const filterProductsByPermissions = useMemo(() => {
    return (products) => {
      if (!products) return [];
      if (isAdmin) return products;

      // إذا لم تكن هناك صلاحيات محددة، اعرض جميع المنتجات
      if (!productPermissions || Object.keys(productPermissions).length === 0) {
        return products;
      }

      return products.filter(product => {
        // فحص التصنيفات عبر product_categories
        const categoryPerm = productPermissions.category;
        if (categoryPerm && !categoryPerm.has_full_access) {
          if (product.product_categories && product.product_categories.length > 0) {
            const hasAllowedCategory = product.product_categories.some(pc => 
              categoryPerm.allowed_items.includes(pc.category_id)
            );
            if (!hasAllowedCategory) return false;
          }
        }

        // فحص الأقسام عبر product_departments
        const departmentPerm = productPermissions.department;
        if (departmentPerm && !departmentPerm.has_full_access) {
          if (product.product_departments && product.product_departments.length > 0) {
            const hasAllowedDepartment = product.product_departments.some(pd => 
              departmentPerm.allowed_items.includes(pd.department_id)
            );
            if (!hasAllowedDepartment) return false;
          }
        }

        // فحص المواسم عبر product_seasons_occasions
        const seasonPerm = productPermissions.season_occasion;
        if (seasonPerm && !seasonPerm.has_full_access) {
          if (product.product_seasons_occasions && product.product_seasons_occasions.length > 0) {
            const hasAllowedSeason = product.product_seasons_occasions.some(pso => 
              seasonPerm.allowed_items.includes(pso.season_occasion_id)
            );
            if (!hasAllowedSeason) return false;
          }
        }

        // فحص أنواع المنتجات عبر product_product_types
        const productTypePerm = productPermissions.product_type;
        if (productTypePerm && !productTypePerm.has_full_access) {
          if (product.product_product_types && product.product_product_types.length > 0) {
            const hasAllowedProductType = product.product_product_types.some(ppt => 
              productTypePerm.allowed_items.includes(ppt.product_type_id)
            );
            if (!hasAllowedProductType) return false;
          }
        }

        // فحص الألوان عبر المتغيرات
        const colorPerm = productPermissions.color;
        if (colorPerm && !colorPerm.has_full_access) {
          if (product.variants && product.variants.length > 0) {
            const hasAllowedColor = product.variants.some(variant => 
              colorPerm.allowed_items.includes(variant.color_id)
            );
            if (!hasAllowedColor) return false;
          }
        }

        // فحص الأحجام عبر المتغيرات
        const sizePerm = productPermissions.size;
        if (sizePerm && !sizePerm.has_full_access) {
          if (product.variants && product.variants.length > 0) {
            const hasAllowedSize = product.variants.some(variant => 
              sizePerm.allowed_items.includes(variant.size_id)
            );
            if (!hasAllowedSize) return false;
          }
        }

        return true;
      });
    };
  }, [isAdmin, productPermissions]);

  const value = {
    user,
    session,
    loading,
    login,
    logout,
    registerWithEmail,
    forgotPassword,
    pendingRegistrations,
    allUsers,
    updateUser,
    updateProfile,
    updateUserProfile,
    changePassword,
    refetchAdminData: fetchAdminData,
    fetchAdminData,
    // إضافة الصلاحيات
    hasPermission,
    hasRole,
    isAdmin,
    userRoles,
    userPermissions,
    productPermissions,
    filterProductsByPermissions,
    // إضافة debug للصلاحيات
    debugPermissions: () => {
      console.log('🔍 Debug الصلاحيات:', {
        userRoles,
        userPermissions,
        productPermissions,
        isAdmin,
        user
      });
    }
  };

  return (
    <UnifiedAuthContext.Provider value={value}>
      {children}
    </UnifiedAuthContext.Provider>
  );
};

// Hook لاستخدام النظام الموحد للصلاحيات
export const usePermissions = () => {
  const { user, hasPermission, hasRole, isAdmin, userRoles, userPermissions } = useAuth();
  return { user, hasPermission, hasRole, isAdmin, userRoles, userPermissions };
};