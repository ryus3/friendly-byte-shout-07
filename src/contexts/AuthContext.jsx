import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast.js';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch user profile
          setTimeout(async () => {
            try {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .single();
              setProfile(profileData);
            } catch (error) {
              console.error('Error fetching profile:', error);
            }
          }, 0);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(async () => {
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('user_id', session.user.id)
              .single();
            setProfile(profileData);
          } catch (error) {
            console.error('Error fetching profile:', error);
          }
        }, 0);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (fullName, username, email, password) => {
    try {
      setLoading(true);
      
      // Check if username already exists
      const { data: existingUser } = await supabase
        .rpc('get_user_by_username', { username_input: username });
      
      if (existingUser && existingUser.length > 0) {
        return { error: { message: 'اسم المستخدم موجود بالفعل' } };
      }

      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            username: username
          }
        }
      });

      if (error) {
        return { error };
      }

      toast({
        title: "تم إنشاء الحساب بنجاح",
        description: "يمكنك الآن تسجيل الدخول",
      });

      return { data, error: null };
    } catch (error) {
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const signInWithUsername = async (username, password) => {
    try {
      setLoading(true);
      
      // Get email from username
      const { data: userData } = await supabase
        .rpc('get_user_by_username', { username_input: username });
      
      if (!userData || userData.length === 0) {
        return { error: { message: 'اسم المستخدم أو كلمة المرور غير صحيحة' } };
      }

      const email = userData[0].email;
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: { message: 'اسم المستخدم أو كلمة المرور غير صحيحة' } };
      }

      return { data, error: null };
    } catch (error) {
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      setSession(null);
      setProfile(null);
      
      toast({
        title: "تم تسجيل الخروج",
        description: "إلى اللقاء",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = () => {
    return profile?.role === 'admin';
  };

  const hasPermission = () => {
    return true; // جميع المستخدمين لهم صلاحيات حالياً
  };

  const value = {
    user: profile, // استخدم profile بدلاً من user
    session,
    profile,
    loading,
    signUp,
    signInWithUsername,
    logout,
    isAdmin,
    hasPermission,
    full_name: profile?.full_name,
    role: profile?.role,
    default_page: '/',
    defaultPage: '/'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};