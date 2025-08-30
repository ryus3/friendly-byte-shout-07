import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './UnifiedAuthContext';
import { toast } from '@/hooks/use-toast';

const UnifiedNotificationsContext = createContext();

export const useUnifiedNotifications = () => {
  const context = useContext(UnifiedNotificationsContext);
  if (!context) {
    throw new Error('useUnifiedNotifications must be used within UnifiedNotificationsProvider');
  }
  return context;
};

export const UnifiedNotificationsProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch notifications with deduplication
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${user.id},target_users.cs.{${user.id}}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Remove duplicates based on unique notification signature
      const uniqueNotifications = data.reduce((acc, notification) => {
        const signature = `${notification.type}_${notification.related_id}_${notification.data?.order_id || notification.data?.user_id || ''}`;
        
        if (!acc.find(n => {
          const nSig = `${n.type}_${n.related_id}_${n.data?.order_id || n.data?.user_id || ''}`;
          return nSig === signature;
        })) {
          acc.push(notification);
        }
        
        return acc;
      }, []);

      setNotifications(uniqueNotifications);
      setUnreadCount(uniqueNotifications.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Real-time subscription with deduplication
  useEffect(() => {
    if (!user?.id) return;

    fetchNotifications();

    const channel = supabase
      .channel('unified-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newNotification = payload.new;
          
          // Check for duplicates before adding
          setNotifications(prev => {
            const signature = `${newNotification.type}_${newNotification.related_id}_${newNotification.data?.order_id || newNotification.data?.user_id || ''}`;
            
            const isDuplicate = prev.find(n => {
              const nSig = `${n.type}_${n.related_id}_${n.data?.order_id || n.data?.user_id || ''}`;
              return nSig === signature;
            });

            if (isDuplicate) return prev;

            const updated = [newNotification, ...prev];
            setUnreadCount(updated.filter(n => !n.read).length);
            
            // Show toast notification
            displayNotificationToast(newNotification);
            
            return updated;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const updatedNotification = payload.new;
          setNotifications(prev => 
            prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
          );
          setUnreadCount(prev => prev.filter(n => !n.read).length);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchNotifications]);

  // Display notification toast with vibrant design
  const displayNotificationToast = (notification) => {
    const getNotificationVariant = (type) => {
      switch (type) {
        case 'order_created':
        case 'order_updated':
          return 'success';
        case 'low_stock':
        case 'stock_alert':
          return 'destructive';
        case 'alwaseet_status_change':
          return 'info';
        default:
          return 'default';
      }
    };

    const getNotificationIcon = (type) => {
      switch (type) {
        case 'order_created':
          return '🛍️';
        case 'order_updated':
          return '📦';
        case 'low_stock':
          return '⚠️';
        case 'alwaseet_status_change':
          return '🚚';
        default:
          return '🔔';
      }
    };

    toast({
      title: `${getNotificationIcon(notification.type)} ${notification.title}`,
      description: notification.message,
      variant: getNotificationVariant(notification.type),
      duration: 5000,
    });
  };

  // Create notification with duplicate prevention
  const createNotification = async (notificationData) => {
    if (!user?.id) return;

    try {
      // Check for existing similar notification
      const signature = `${notificationData.type}_${notificationData.related_id}_${notificationData.data?.order_id || notificationData.data?.user_id || ''}`;
      
      const existingNotification = notifications.find(n => {
        const nSig = `${n.type}_${n.related_id}_${n.data?.order_id || n.data?.user_id || ''}`;
        return nSig === signature && !n.read;
      });

      if (existingNotification) {
        console.log('Duplicate notification prevented:', signature);
        return existingNotification;
      }

      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          ...notificationData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  };

  // Mark notification as read
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
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setUnreadCount(prev => {
        const deleted = notifications.find(n => n.id === notificationId);
        return deleted && !deleted.read ? prev - 1 : prev;
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Clear all notifications
  const clearAllNotifications = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error clearing all notifications:', error);
    }
  };

  // Notification helpers for specific events
  const notifyOrderCreated = (orderData) => {
    return createNotification({
      type: 'order_created',
      title: 'طلب جديد',
      message: `تم إنشاء طلب جديد برقم ${orderData.id}`,
      related_id: orderData.id,
      data: { order_id: orderData.id, customer_name: orderData.customer_name }
    });
  };

  const notifyLowStock = (productData) => {
    return createNotification({
      type: 'low_stock',
      title: 'تنبيه مخزون منخفض',
      message: `المنتج ${productData.name} أصبح منخفض المخزون`,
      related_id: productData.id,
      data: { product_id: productData.id, quantity: productData.quantity }
    });
  };

  const notifyAlWaseetStatus = (invoiceData) => {
    return createNotification({
      type: 'alwaseet_status_change',
      title: 'تحديث حالة الشحن',
      message: `تم تحديث حالة الشحن للفاتورة ${invoiceData.invoice_number}`,
      related_id: invoiceData.id,
      data: { invoice_id: invoiceData.id, status: invoiceData.status }
    });
  };

  const value = {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    createNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    notifyOrderCreated,
    notifyLowStock,
    notifyAlWaseetStatus
  };

  return (
    <UnifiedNotificationsContext.Provider value={value}>
      {children}
    </UnifiedNotificationsContext.Provider>
  );
};