/**
 * 🌟 مزود البيانات الموحد
 * 
 * يستبدل جميع الـ Context Providers المعقدة بواحد بسيط
 * - بيانات مشتركة عالمياً
 * - حالة المستخدم والأذونات
 * - إعدادات التطبيق
 * - Real-time updates
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useAPI } from '../api';
import { useData } from '../hooks/useData';

// إنشاء الـ Context الوحيد
const DataContext = createContext();

export const useAppData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useAppData must be used within DataProvider');
  }
  return context;
};

export const DataProvider = ({ children }) => {
  const { user } = useAuth();
  const api = useAPI();

  // البيانات الأساسية المشتركة
  const [appSettings, setAppSettings] = useState({});
  const [userPermissions, setUserPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // تحميل الإعدادات والأذونات عند تسجيل الدخول
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadUserData = async () => {
      try {
        // تحميل الإعدادات
        const settings = await api.get('settings', {
          filters: { key: 'app_settings' },
          useCache: true
        });
        
        if (settings?.[0]?.value) {
          setAppSettings(settings[0].value);
        }

        // تحميل أذونات المستخدم
        const permissions = await api.get('user_roles', {
          filters: { user_id: user.user_id },
          select: `
            role_id,
            roles (
              name,
              role_permissions (
                permissions (name, display_name)
              )
            )
          `,
          useCache: true
        });

        // استخراج الأذونات
        const userPerms = permissions.flatMap(role => 
          role.roles?.role_permissions?.map(rp => rp.permissions) || []
        );
        
        setUserPermissions(userPerms);

      } catch (error) {
        console.error('خطأ في تحميل بيانات المستخدم:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [user, api]);

  // دالة فحص الأذونات
  const hasPermission = (permissionName) => {
    return userPermissions.some(perm => perm.name === permissionName);
  };

  // دالة تحديث الإعدادات
  const updateSettings = async (newSettings) => {
    try {
      await api.update('settings', appSettings.id, { value: newSettings });
      setAppSettings(newSettings);
    } catch (error) {
      console.error('خطأ في تحديث الإعدادات:', error);
      throw error;
    }
  };

  // القيم المشتركة
  const value = {
    // بيانات المستخدم
    user,
    userPermissions,
    hasPermission,
    
    // إعدادات التطبيق
    appSettings,
    updateSettings,
    
    // حالة التحميل
    loading,
    
    // API accessor
    api,
    
    // دوال مساعدة
    isAdmin: hasPermission('admin_access'),
    isManager: hasPermission('manager_access'),
    canViewProducts: hasPermission('view_products'),
    canManageProducts: hasPermission('manage_products'),
    canViewOrders: hasPermission('view_orders'),
    canManageOrders: hasPermission('manage_orders'),
    canViewAccounting: hasPermission('view_accounting'),
    canManageEmployees: hasPermission('manage_employees'),
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};