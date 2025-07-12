import React, { createContext, useContext, useState, useEffect } from 'react';
import { getFromStorage, saveToStorage, removeFromStorage, localStorageKeys, defaultUser, initializeDefaultData } from '@/lib/localStorage';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // تهيئة البيانات الافتراضية
    initializeDefaultData();
    
    // تحميل المستخدم من التخزين المحلي
    const savedUser = getFromStorage(localStorageKeys.USER);
    if (savedUser) {
      setUser(savedUser);
    }
    setLoading(false);
  }, []);

  const login = async (credentials) => {
    try {
      // بيانات الدخول الافتراضية
      const validCredentials = [
        { username: 'admin', password: '123456' },
        { username: 'مدير', password: '123456' },
        { email: 'admin@ryus.com', password: '123456' }
      ];

      const isValid = validCredentials.some(cred => 
        (cred.username === credentials.username || cred.email === credentials.email) && 
        cred.password === credentials.password
      );

      if (!isValid) {
        throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
      }

      const userData = { ...defaultUser };
      setUser(userData);
      saveToStorage(localStorageKeys.USER, userData);

      return { success: true, user: userData };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    setUser(null);
    removeFromStorage(localStorageKeys.USER);
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    return user.permissions.includes('all') || user.permissions.includes(permission);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    hasPermission,
    // دوال فارغة للتوافق مع الكود الموجود
    register: () => Promise.resolve({ success: false, error: 'التسجيل غير متاح' }),
    resetPassword: () => Promise.resolve({ success: false, error: 'إعادة تعيين كلمة المرور غير متاحة' }),
    updateProfile: () => Promise.resolve({ success: false, error: 'تحديث الملف الشخصي غير متاح' })
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};