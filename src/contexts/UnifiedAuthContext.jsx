import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from '@/components/ui/use-toast.js';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedPermissionsProvider } from '@/contexts/UnifiedPermissionsProvider';

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
      // 1. جلب البروفايل أولاً بدون inner join على الأدوار
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', supabaseUser.id)
        .maybeSingle();

      if (error) {
        console.error('Profile fetch error:', error);
        return null;
      }

      if (!profile) {
        return { ...supabaseUser, is_new: true, status: 'pending' };
      }

      // 2. جلب الأدوار في استعلام مستقل (لا يؤثر فشله على البروفايل)
      let roles = [];
      try {
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('roles(name, display_name, hierarchy_level)')
          .eq('user_id', supabaseUser.id)
          .eq('is_active', true);
        
        roles = rolesData?.map(ur => ur.roles?.name).filter(Boolean) || [];
      } catch (rolesErr) {
        console.warn('Roles fetch failed, continuing with empty roles:', rolesErr);
      }

      // 3. جلب الشركة الافتراضية
      const { data: defaultPartner } = await supabase
        .from('delivery_partner_tokens')
        .select('partner_name')
        .eq('user_id', supabaseUser.id)
        .eq('is_active', true)
        .order('last_used_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (defaultPartner?.partner_name) {
        localStorage.setItem('active_delivery_partner', defaultPartner.partner_name);
        
        await supabase
          .from('profiles')
          .update({ 
            selected_delivery_partner: defaultPartner.partner_name,
            updated_at: new Date().toISOString()
          })
          .eq('id', profile.id);
      }

      return { 
        ...supabaseUser, 
        ...profile,
        user_id: supabaseUser.id,
        uuid: supabaseUser.id,
        roles,
        id: supabaseUser.id,
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
        return;
      }
      
      // جلب رموز التليغرام مباشرة من جدول employee_telegram_codes
      const { data: telegramCodes } = await supabase
        .from('employee_telegram_codes')
        .select('user_id, telegram_code, telegram_chat_id, linked_at')
        .eq('is_active', true);
      
      // إنشاء map للرموز لسهولة الوصول
      const telegramMap = {};
      telegramCodes?.forEach(tc => {
        telegramMap[tc.user_id] = {
          telegram_code: tc.telegram_code,
          telegram_linked: !!tc.telegram_chat_id, // متصل إذا كان chat_id موجود
          telegram_linked_at: tc.linked_at
        };
      });
      
      // إضافة الأدوار ورموز التليغرام لكل مستخدم
      const usersWithRoles = data.map(user => {
        const activeRoles = user.user_roles
          ?.filter(ur => ur.is_active)
          ?.map(ur => ur.roles.name) || [];
        
        const telegramInfo = telegramMap[user.user_id] || {};
        
        return {
          ...user,
          roles: activeRoles,
          telegram_code: telegramInfo.telegram_code || null,
          telegram_linked: telegramInfo.telegram_linked || false,
          telegram_linked_at: telegramInfo.telegram_linked_at || null
        };
      });
      
      const pending = usersWithRoles.filter(u => u.status === 'pending');
      setAllUsers(usersWithRoles);
      setPendingRegistrations(pending);
    } catch (error) {
      // Silent fail
    }
  }, []);

  // Set up auth state listener with enhanced session management
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let currentUserId = null; // تتبع المستخدم الحالي لتجنب التكرار
    let profileFetchRetries = 0;
    const MAX_RETRIES = 3;

    // دالة مشتركة لجلب البروفايل مع retry
    const handleSession = async (session, source) => {
      if (!isMounted || !session?.user) return;
      
      // تجنب إعادة الجلب لنفس المستخدم (إلا عند TOKEN_REFRESHED)
      if (currentUserId === session.user.id && source !== 'SIGNED_IN') {
        setLoading(false);
        return;
      }

      try {
        const profile = await fetchUserProfile(session.user);
        if (!isMounted) return;
        
        if (profile?.status === 'active') {
          currentUserId = session.user.id;
          profileFetchRetries = 0;
          setUser(profile);
        } else if (profile?.status === 'pending') {
          setUser(null);
          toast({ 
            title: "حسابك قيد المراجعة", 
            description: "سيقوم المدير بمراجعة طلبك وتفعيله قريباً.", 
            duration: 7000 
          });
        } else if (!profile && session.user) {
          // فشل جلب البروفايل لكن الجلسة صالحة - retry
          if (profileFetchRetries < MAX_RETRIES) {
            profileFetchRetries++;
            console.warn(`⚠️ فشل جلب البروفايل، محاولة ${profileFetchRetries}/${MAX_RETRIES}`);
            setTimeout(() => {
              if (isMounted) handleSession(session, 'retry');
            }, 1500 * profileFetchRetries);
            return; // لا نضع loading = false أثناء retry
          } else {
            // بعد كل المحاولات، نعرض المستخدم بدون بروفايل كامل بدلاً من logout
            console.error('❌ فشل جلب البروفايل بعد كل المحاولات');
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Profile fetch error in handleSession:', error);
        // لا نمسح المستخدم إذا كان موجوداً وكانت الجلسة صالحة
        if (!currentUserId) {
          if (isMounted) setUser(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        // Always update session state immediately
        setSession(session);
        
        if (session?.user) {
          if (event === 'TOKEN_REFRESHED') {
            // لا نعيد جلب البروفايل عند تجديد التوكن - فقط نحدث الجلسة
            return;
          }
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(() => handleSession(session, event), 0);
        } else {
          currentUserId = null;
          setUser(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session (browser refresh recovery)
    const checkExistingSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !isMounted) {
          if (isMounted) setLoading(false);
          return;
        }

        setSession(session);
        
        if (session?.user) {
          await handleSession(session, 'INITIAL_SESSION');
        } else {
          if (isMounted) setLoading(false);
        }
      } catch (error) {
        if (isMounted) setLoading(false);
      }
    };

    checkExistingSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
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
        // Silent fail
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

  // ✅ دالة استعادة الجلسة الافتراضية من قاعدة البيانات
  const restoreDefaultSession = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data: defaultAccount, error } = await supabase
        .from('delivery_partner_tokens')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return;
      }

      if (defaultAccount) {
        // ✅ حفظ في localStorage
        localStorage.setItem('active_delivery_partner', defaultAccount.partner_name);
        localStorage.setItem('delivery_partner_default_token', JSON.stringify({
          token: defaultAccount.token,
          partner_name: defaultAccount.partner_name,
          username: defaultAccount.account_username,
          merchant_id: defaultAccount.merchant_id,
          label: defaultAccount.account_label
        }));
      } else {
        localStorage.removeItem('delivery_partner_default_token');
      }
    } catch (error) {
      // Silent fail
    }
  }, [user]);

  // ✅ استدعاء استعادة الجلسة عند تحميل المستخدم
  useEffect(() => {
    if (user?.id) {
      restoreDefaultSession();
    }
  }, [user?.id, restoreDefaultSession]);

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

      // ✅ جلب وحفظ الحساب الافتراضي تلقائياً
      try {
        const { data: defaultAccount } = await supabase
          .from('delivery_partner_tokens')
          .select('*')  // ✅ جلب كل البيانات (ليس فقط partner_name)
          .eq('user_id', profile.user_id)
          .eq('is_default', true)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (defaultAccount) {
          localStorage.setItem('active_delivery_partner', defaultAccount.partner_name);
          
          // ✅ NEW: حفظ Token أيضاً لاستخدامه في AlWaseetContext
          localStorage.setItem('delivery_partner_default_token', JSON.stringify({
            token: defaultAccount.token,
            partner_name: defaultAccount.partner_name,
            username: defaultAccount.account_username,
            merchant_id: defaultAccount.merchant_id,
            label: defaultAccount.account_label
          }));
        } else {
          // مسح البيانات القديمة
          localStorage.removeItem('delivery_partner_default_token');
        }
      } catch (error) {
        console.warn('⚠️ خطأ في جلب الحساب الافتراضي:', error);
      }

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
      // ✅ 1. التحقق من عدد المستخدمين (هل هذا أول مستخدم؟)
      const { count: userCount, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;
      const isFirstUser = userCount === 0;

      // ✅ 2. التحقق من وجود username
      const { data: usernameExists, error: usernameCheckError } = await supabase
        .rpc('username_exists', { p_username: username });
      
      if (usernameCheckError) {
        throw new Error("حدث خطأ أثناء التحقق من اسم المستخدم.");
      }
      if (usernameExists) {
        throw new Error('اسم المستخدم هذا موجود بالفعل.');
      }
      
      // ✅ 3. التحقق من وجود البريد الإلكتروني (الجديد!)
      const { data: emailExists, error: emailCheckError } = await supabase
        .rpc('check_email_exists', { p_email: email });
      
      if (emailCheckError) {
        console.error('خطأ في التحقق من البريد:', emailCheckError);
        throw new Error("حدث خطأ أثناء التحقق من البريد الإلكتروني.");
      }
      
      if (emailExists) {
        throw new Error('هذا البريد الإلكتروني مسجل بالفعل.');
      }
      
      // ✅ 4. التسجيل (بعد التأكد من عدم وجود البريد)
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
        throw error;
      }

      // ✅ 5. فحص إضافي: التأكد من أن التسجيل نجح فعلياً
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        throw new Error('هذا البريد الإلكتروني مسجل بالفعل. الرجاء تسجيل الدخول.');
      }

      // ✅ 6. إظهار رسالة النجاح
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
      redirectTo: "https://pos.ryusbrand.com/update-password",
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
    
    // Clear sensitive data from localStorage for security
    const sensitiveKeys = [
      'processedAiOrders',
      'aiOrdersEmployeeFilter',
      'defaultCustomerName',
      'defaultDeliveryPartner',
      'defaultCustomerPhone',
      'defaultCustomerPhone2',
      'defaultProvince',
      'defaultCity',
      'defaultRegion',
      'selectedDeliveryPartner',
      'employeeFilter'
    ];
    
    sensitiveKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`Failed to remove ${key} from localStorage:`, error);
      }
    });
    
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
      // إذا كان data يحتوي على useCompleteApproval، استخدم دالة الموافقة الكاملة
      if (data?.useCompleteApproval) {
        console.log('Using complete approval function for user:', userId);
        
        const { data: approvalResult, error: approvalError } = await supabase
          .rpc('approve_employee_complete', {
            p_user_id: userId,
            p_full_name: data.full_name
          });
        
        if (approvalError) {
          console.error('Complete approval error:', approvalError);
          toast({ 
            title: 'خطأ في الموافقة', 
            description: `فشل في تفعيل الموظف: ${approvalError.message}`, 
            variant: 'destructive' 
          });
          return { success: false, error: approvalError };
        }
        
        console.log('Complete approval result:', approvalResult);
        toast({ 
          title: 'تمت الموافقة ✅', 
          description: 'تم تفعيل الموظف بنجاح مع دور مبيعات ورمز تليغرام',
          variant: 'default' 
        });
        
        // تحديث البيانات المحلية
        await fetchAdminData();
        return { success: true };
      }
      
      // الطريقة العادية للتحديث (للتوافق مع الكود القديم)
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
        .eq('user_id', getUserUUID(user))
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

  // فلترة المنتجات حسب صلاحيات المستخدم - يدعم جميع أشكال العلاقات
  const filterProductsByPermissions = useMemo(() => {
    return (products) => {
      if (!products) return [];
      if (isAdmin) return products;

      // إذا لم تكن هناك صلاحيات محددة، اعرض جميع المنتجات
      if (!productPermissions || Object.keys(productPermissions).length === 0) {
        return products;
      }

      const getId = (obj, keys) => {
        for (const k of keys) {
          const parts = k.split('.');
          let cur = obj;
          for (const p of parts) {
            cur = cur?.[p];
          }
          if (cur) return cur;
        }
        return null;
      };

      return products.filter(product => {
        // فحص التصنيفات عبر product_categories
        const categoryPerm = productPermissions.category;
        if (categoryPerm && !categoryPerm.has_full_access) {
          const list = product.product_categories || [];
          if (list.length > 0) {
            const hasAllowedCategory = list.some(pc => {
              const cid = getId(pc, ['category_id', 'category.id', 'categories.id']);
              return cid && categoryPerm.allowed_items.includes(cid);
            });
            if (!hasAllowedCategory) return false;
          }
        }

        // فحص الأقسام عبر product_departments
        const departmentPerm = productPermissions.department;
        if (departmentPerm && !departmentPerm.has_full_access) {
          const list = product.product_departments || [];
          if (list.length > 0) {
            const hasAllowedDepartment = list.some(pd => {
              const did = getId(pd, ['department_id', 'department.id', 'departments.id']);
              return did && departmentPerm.allowed_items.includes(did);
            });
            if (!hasAllowedDepartment) return false;
          }
        }

        // فحص المواسم/المناسبات عبر product_seasons_occasions
        const seasonPerm = productPermissions.season_occasion;
        if (seasonPerm && !seasonPerm.has_full_access) {
          const list = product.product_seasons_occasions || [];
          if (list.length > 0) {
            const hasAllowedSeason = list.some(pso => {
              const sid = getId(pso, ['season_occasion_id', 'season_occasion.id', 'seasons_occasions.id']);
              return sid && seasonPerm.allowed_items.includes(sid);
            });
            if (!hasAllowedSeason) return false;
          }
        }

        // فحص أنواع المنتجات عبر product_product_types
        const productTypePerm = productPermissions.product_type;
        if (productTypePerm && !productTypePerm.has_full_access) {
          const list = product.product_product_types || [];
          if (list.length > 0) {
            const hasAllowedProductType = list.some(ppt => {
              const pid = getId(ppt, ['product_type_id', 'product_type.id', 'product_types.id']);
              return pid && productTypePerm.allowed_items.includes(pid);
            });
            if (!hasAllowedProductType) return false;
          }
        }

        // فحص الألوان عبر المتغيرات
        const colorPerm = productPermissions.color;
        if (colorPerm && !colorPerm.has_full_access) {
          const vs = product.variants || product.product_variants || [];
          if (vs.length > 0) {
            const hasAllowedColor = vs.some(variant => {
              const cid = getId(variant, ['color_id', 'colors.id']);
              return cid && colorPerm.allowed_items.includes(cid);
            });
            if (!hasAllowedColor) return false;
          }
        }

        // فحص الأحجام عبر المتغيرات
        const sizePerm = productPermissions.size;
        if (sizePerm && !sizePerm.has_full_access) {
          const vs = product.variants || product.product_variants || [];
          if (vs.length > 0) {
            const hasAllowedSize = vs.some(variant => {
              const sid = getId(variant, ['size_id', 'sizes.id']);
              return sid && sizePerm.allowed_items.includes(sid);
            });
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
      <UnifiedPermissionsProvider user={user}>
        {children}
      </UnifiedPermissionsProvider>
    </UnifiedAuthContext.Provider>
  );
};