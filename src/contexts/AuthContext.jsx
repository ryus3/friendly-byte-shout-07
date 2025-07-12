import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const login = (username, password) => {
    setLoading(true);
    
    // Simple login check
    if (username === '1' && password === '1') {
      const userData = {
        id: '1',
        username: '1',
        full_name: 'المستخدم الرئيسي',
        role: 'admin'
      };
      setUser(userData);
      setLoading(false);
      return { success: true };
    } else {
      setLoading(false);
      return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    }
  };

  const logout = () => {
    setUser(null);
  };

  const hasPermission = () => true; // Admin has all permissions

  const value = {
    user,
    login,
    logout,
    loading,
    hasPermission
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};