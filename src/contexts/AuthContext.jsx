import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from '@/components/ui/use-toast.js';
import { supabase } from '@/lib/customSupabaseClient.js'; // Use the custom client

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [pendingRegistrations, setPendingRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = useCallback(async (supabaseUser) => {
    if (!supabase || !supabaseUser) return null;
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*, default_page')
      .eq('user_id', supabaseUser.id)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      if (error.code === 'PGRST116') {
        return { ...supabaseUser, is_new: true, status: 'pending' };
      }
      return null;
    }
    return { ...supabaseUser, ...profile };
  }, []);

  const fetchAdminData = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) {
      console.error('Error fetching all users:', error);
      return;
    }
    const pending = [];
    data.forEach(u => {
      if (u.status === 'pending') {
        pending.push(u);
      } 
    });
    setAllUsers(data); // Store all users including pending ones
    setPendingRegistrations(pending);
  }, []);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'deputy' || user?.permissions?.includes('*')) {
      fetchAdminData();
    } else if (user) {
      // Regular users should not see other users' data
      setAllUsers([user]);
    }
  }, [user, fetchAdminData]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const getSession = async () => {
      setLoading(true);
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Error getting session:", error.message);
        setLoading(false);
        return;
      }
      
      if (session) {
        const profile = await fetchUserProfile(session.user);
        if (profile?.status === 'active') {
          setUser(profile);
        } else {
          setUser(null);
        }
      }
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const profile = await fetchUserProfile(session.user);
        if (profile?.status === 'active') {
          setUser(profile);
        } else {
          setUser(null);
          if (profile?.status === 'pending') {
             toast({ title: "حسابك قيد المراجعة", description: "سيقوم المدير بمراجعة طلبك وتفعيله قريباً.", duration: 7000 });
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [fetchUserProfile]);

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
      // Check if any user exists at all. If not, this is the first registration.
      const { count: userCount, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      const isFirstUser = userCount === 0;

      // Check for existing username using the RPC function
      const { data: usernameExists, error: usernameCheckError } = await supabase
        .rpc('username_exists', { p_username: username });
      
      if (usernameCheckError) {
        console.error("Error checking username:", usernameCheckError);
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
        // تحديث قائمة التسجيلات المعلقة للمدير
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
    setLoading(false);
  };
  
  const hasPermission = (permission) => {
    if(!permission) return true;
    if (user?.role === 'admin' || user?.permissions?.includes('*')) {
      return true;
    }
    
    // التحقق من صلاحيات التصنيفات والمتغيرات
    if (permission.startsWith('view_category_')) {
      const categoryId = permission.replace('view_category_', '');
      if (categoryId === 'all') return true;
      try {
        const categoryPermissions = JSON.parse(user?.category_permissions || '["all"]');
        return categoryPermissions.includes('all') || categoryPermissions.includes(categoryId);
      } catch (e) {
        return true; // default to allow if parsing fails
      }
    }
    
    if (permission.startsWith('view_color_')) {
      const colorId = permission.replace('view_color_', '');
      if (colorId === 'all') return true;
      try {
        const colorPermissions = JSON.parse(user?.color_permissions || '["all"]');
        return colorPermissions.includes('all') || colorPermissions.includes(colorId);
      } catch (e) {
        return true;
      }
    }
    
    if (permission.startsWith('view_size_')) {
      const sizeId = permission.replace('view_size_', '');
      if (sizeId === 'all') return true;
      try {
        const sizePermissions = JSON.parse(user?.size_permissions || '["all"]');
        return sizePermissions.includes('all') || sizePermissions.includes(sizeId);
      } catch (e) {
        return true;
      }
    }
    
    if (permission.startsWith('view_department_')) {
      const departmentId = permission.replace('view_department_', '');
      if (departmentId === 'all') return true;
      try {
        const departmentPermissions = JSON.parse(user?.department_permissions || '["all"]');
        return departmentPermissions.includes('all') || departmentPermissions.includes(departmentId);
      } catch (e) {
        return true;
      }
    }
    
    if (permission.startsWith('view_product_type_')) {
      const productTypeId = permission.replace('view_product_type_', '');
      if (productTypeId === 'all') return true;
      try {
        const productTypePermissions = JSON.parse(user?.product_type_permissions || '["all"]');
        return productTypePermissions.includes('all') || productTypePermissions.includes(productTypeId);
      } catch (e) {
        return true;
      }
    }
    
    if (permission.startsWith('view_season_occasion_')) {
      const seasonOccasionId = permission.replace('view_season_occasion_', '');
      if (seasonOccasionId === 'all') return true;
      try {
        const seasonOccasionPermissions = JSON.parse(user?.season_occasion_permissions || '["all"]');
        return seasonOccasionPermissions.includes('all') || seasonOccasionPermissions.includes(seasonOccasionId);
      } catch (e) {
        return true;
      }
    }
    
    return user?.permissions?.includes(permission);
  };

  const updateUser = async (userId, data) => {
    if (!supabase) {
      toast({ title: "وضع العرض", description: "لا يمكن تحديث المستخدمين في الوضع المحلي.", variant: "destructive" });
      return { success: false, error: "Local mode" };
    }
    
    try {
      console.log('Updating user:', userId, 'with data:', data);
      
      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('user_id', userId);
        
      if (error) {
        console.error('Update error:', error);
        toast({ title: 'خطأ', description: `فشل تحديث المستخدم: ${error.message}`, variant: 'destructive' });
        return { success: false, error };
      }
      
      console.log('User updated successfully');
      toast({ title: 'نجاح', description: 'تم تحديث المستخدم بنجاح.' });
      
      // تحديث البيانات المحلية
      if (userId === user?.id) {
        const updatedProfile = await fetchUserProfile(user);
        setUser(updatedProfile);
      }
      
      // تحديث قائمة جميع المستخدمين
      await fetchAdminData();
      
      return { success: true };
    } catch (error) {
      console.error('updateUser catch error:', error);
      toast({ title: 'خطأ', description: `خطأ غير متوقع: ${error.message}`, variant: 'destructive' });
      return { success: false, error };
    }
  };

  const updateUserProfile = async (profileData) => {
    if (!user) return;
    setLoading(true);
    try {
        const { data, error } = await supabase
            .from('profiles')
            .update({ full_name: profileData.full_name, username: profileData.username })
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) throw error;
        
        setUser(prevUser => ({ ...prevUser, ...data }));
        toast({ title: 'نجاح', description: 'تم تحديث الملف الشخصي بنجاح.' });
    } catch (error) {
        console.error("Error updating profile:", error);
        toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } finally {
        setLoading(false);
    }
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

  const updatePermissionsByRole = async (role, permissions) => {
    if (!supabase) {
      toast({ title: "Error", description: "Supabase client not available.", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ permissions })
      .eq('role', role);

    if (error) {
      toast({ title: 'خطأ', description: `فشل تحديث الصلاحيات: ${error.message}`, variant: 'destructive' });
    } else {
      toast({ title: 'نجاح', description: `تم تحديث صلاحيات كل المستخدمين من دور "${role}" بنجاح.` });
      await fetchAdminData(); // Refetch all users to update the UI
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    hasPermission,
    registerWithEmail,
    forgotPassword,
    pendingRegistrations,
    allUsers,
    updateUser,
    updateUserProfile,
    changePassword,
    updatePermissionsByRole,
    refetchAdminData: fetchAdminData,
    fetchAdminData, // expose this for the handler
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};