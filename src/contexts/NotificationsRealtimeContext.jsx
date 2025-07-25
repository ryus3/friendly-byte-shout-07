import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { toast } from '@/hooks/use-toast';

const NotificationsRealtimeContext = createContext();

export const useNotificationsRealtime = () => {
  const context = useContext(NotificationsRealtimeContext);
  if (!context) {
    throw new Error('useNotificationsRealtime must be used within NotificationsRealtimeProvider');
  }
  return context;
};

export const NotificationsRealtimeProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // تحديث الإشعارات
  const refreshNotifications = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // جلب جميع الإشعارات الحديثة
      const { data: notificationsData, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const processedNotifications = (notificationsData || []).map(notification => ({
        ...notification,
        read: notification.read || false,
        type: notification.type || 'info',
        created_at: notification.created_at || new Date().toISOString()
      }));

      setNotifications(processedNotifications);
      
      // حساب الإشعارات غير المقروءة
      const unread = processedNotifications.filter(n => !n.read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('خطأ في جلب الإشعارات:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // تحديد الإشعار كمقروء
  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('خطأ في تحديد الإشعار كمقروء:', error);
    }
  };

  // تحديد جميع الإشعارات كمقروءة
  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('خطأ في تحديد جميع الإشعارات كمقروءة:', error);
    }
  };

  // Real-time subscription للإشعارات
  useEffect(() => {
    if (!user) return;

    // تحديث أولي
    refreshNotifications();
    
    // إعداد قناة real-time للإشعارات
    const notificationsChannel = supabase
      .channel('notifications-changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newNotification = {
            ...payload.new,
            read: false,
            type: payload.new.type || 'info'
          };
          
          setNotifications(prev => [newNotification, ...prev.slice(0, 49)]);
          setUnreadCount(prev => prev + 1);
          
          // إظهار toast للإشعار الجديد
          toast({
            title: "🔔 إشعار جديد",
            description: newNotification.message || newNotification.title || 'لديك إشعار جديد',
            className: "z-[9999] text-right bg-blue-500 text-white border-blue-600",
            duration: 4000
          });
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications' },
        (payload) => {
          setNotifications(prev => 
            prev.map(n => n.id === payload.new.id ? { ...n, ...payload.new } : n)
          );
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications' },
        (payload) => {
          setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      )
      .subscribe();

    // إعداد event listener لتحديث الإشعارات عند الضغط على زر التحديث
    const handleRefreshNotifications = () => {
      refreshNotifications();
    };

    window.addEventListener('refresh-notifications', handleRefreshNotifications);

    return () => {
      console.log('🔌 إغلاق Real-time للإشعارات');
      supabase.removeChannel(notificationsChannel);
      window.removeEventListener('refresh-notifications', handleRefreshNotifications);
    };
  }, [user]);

  const value = {
    notifications,
    unreadCount,
    isLoading,
    refreshNotifications,
    markAsRead,
    markAllAsRead
  };

  return (
    <NotificationsRealtimeContext.Provider value={value}>
      {children}
    </NotificationsRealtimeContext.Provider>
  );
};

export default NotificationsRealtimeProvider;