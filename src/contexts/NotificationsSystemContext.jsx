import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './UnifiedAuthContext';
import { useUnifiedPermissionsSystem as usePermissions } from '@/hooks/useUnifiedPermissionsSystem.jsx';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

const NotificationsSystemContext = createContext();

export const useNotificationsSystem = () => {
  const context = useContext(NotificationsSystemContext);
  if (!context) throw new Error('useNotificationsSystem must be used within NotificationsSystemProvider');
  return context;
};

export const NotificationsSystemProvider = ({ children }) => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // جلب الإشعارات من قاعدة البيانات
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${user.id},user_id.is.null`) // إشعارات للمستخدم أو عامة
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }
      
      const formattedNotifications = data.map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        target_user_id: n.user_id,
        target_role: n.data?.target_role,
        related_entity_type: n.data?.related_entity_type,
        related_entity_id: n.data?.related_entity_id,
        created_at: n.created_at,
        read: n.is_read,
        priority: n.priority || 'normal',
        data: n.data || {}
      }));
      
      setNotifications(formattedNotifications);
      setUnreadCount(formattedNotifications.filter(n => !n.read).length);
      
    } catch (error) {
      console.error('Error in fetchNotifications:', error);
    }
  }, [user]);

  // تفعيل Real-time للإشعارات
  useEffect(() => {
    if (!user) return;
    
    fetchNotifications();
    
    const notificationsChannel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications'
      }, (payload) => {
        console.log('New notification detected:', payload);
        fetchNotifications(); // إعادة جلب فقط عند إضافة إشعار جديد
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications'
      }, (payload) => {
        console.log('Notification updated:', payload);
        // تحديث محلي للإشعار بدلاً من إعادة جلب الكل
        if (payload.new.is_read !== payload.old.is_read) {
          setNotifications(prev => prev.map(n => 
            n.id === payload.new.id ? { ...n, read: payload.new.is_read } : n
          ));
          setUnreadCount(prev => payload.new.is_read ? Math.max(0, prev - 1) : prev + 1);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(notificationsChannel);
    };
  }, [user, fetchNotifications]);

  // إنشاء إشعار جديد
  const createNotification = useCallback(async (data) => {
    try {
      const notification = {
        id: Date.now() + Math.random(),
        title: data.title,
        message: data.message,
        type: data.type || 'info', // info, success, warning, error
        target_user_id: data.target_user_id,
        target_role: data.target_role, // 'manager', 'employee', 'all'
        related_entity_type: data.related_entity_type, // 'order', 'settlement_request', etc.
        related_entity_id: data.related_entity_id,
        created_at: new Date().toISOString(),
        read: false,
        priority: data.priority || 'normal' // high, normal, low
      };

      // إضافة للذاكرة المحلية
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);

      // حفظ في قاعدة البيانات
      const { error: insertError } = await supabase
        .from('notifications')
        .insert([{
          title: notification.title,
          message: notification.message,
          type: notification.type,
          user_id: notification.target_user_id,
          data: {
            target_role: notification.target_role,
            related_entity_type: notification.related_entity_type,
            related_entity_id: notification.related_entity_id
          },
          priority: notification.priority
        }]);
      
      if (insertError) {
        console.error('Error saving notification to database:', insertError);
      }

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  }, []);

  // إشعارات الطلبات
  const notifyOrderCreated = useCallback(async (order, createdBy) => {
    // إشعار للمدير
    if (hasPermission('manage_orders')) {
      await createNotification({
        title: 'طلب جديد',
        message: `تم إنشاء طلب جديد #${order.trackingnumber} بواسطة ${createdBy.name}`,
        type: 'info',
        target_role: 'manager',
        related_entity_type: 'order',
        related_entity_id: order.id,
        priority: 'normal'
      });
    }
  }, [createNotification, hasPermission]);

  // إنشاء أو تحديث إشعار حالة الطلب
  const updateOrCreateOrderNotification = useCallback(async (orderId, trackingNumber, status, statusText) => {
    try {
      console.log('🔍 البحث عن إشعار موجود:', { orderId, trackingNumber, status });
      
      // البحث عن إشعار موجود في قاعدة البيانات
      const { data: existingNotifications, error: searchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('type', 'order_status_update')
        .or(`data->>related_entity_id.eq.${orderId},data->>tracking_number.eq.${trackingNumber},data->>order_number.eq.${trackingNumber}`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (searchError) {
        console.error('خطأ في البحث عن الإشعارات:', searchError);
        return;
      }

      const message = `${trackingNumber} ${statusText}`;

      if (existingNotifications && existingNotifications.length > 0) {
        // تحديث الإشعار الموجود
        const existingNotification = existingNotifications[0];
        console.log('📝 تحديث إشعار موجود:', existingNotification.id);
        
        const { error: updateError } = await supabase
          .from('notifications')
          .update({
            message: message,
            updated_at: new Date().toISOString(),
            is_read: false, // جعل الإشعار غير مقروء عند التحديث
            data: {
              ...existingNotification.data,
              related_entity_id: orderId,
              tracking_number: trackingNumber,
              order_number: trackingNumber,
              delivery_status: status,
              status_text: statusText,
              updated_at: new Date().toISOString()
            }
          })
          .eq('id', existingNotification.id);

        if (updateError) {
          console.error('خطأ في تحديث الإشعار:', updateError);
        } else {
          console.log('✅ تم تحديث الإشعار بنجاح');
        }
      } else {
        // إنشاء إشعار جديد
        console.log('➕ إنشاء إشعار جديد');
        
        const { error: insertError } = await supabase
          .from('notifications')
          .insert([{
            title: 'تحديث حالة الطلب',
            message: message,
            type: 'order_status_update',
            user_id: null, // إشعار عام
            data: {
              related_entity_id: orderId,
              tracking_number: trackingNumber,
              order_number: trackingNumber,
              delivery_status: status,
              status_text: statusText,
              created_at: new Date().toISOString()
            },
            priority: 'medium'
          }]);

        if (insertError) {
          console.error('خطأ في إنشاء الإشعار:', insertError);
        } else {
          console.log('✅ تم إنشاء إشعار جديد');
        }
      }
    } catch (error) {
      console.error('خطأ في updateOrCreateOrderNotification:', error);
    }
  }, []);

  // تم إلغاء دالة notifyOrderStatusChanged - الإشعارات تأتي الآن من database trigger فقط
  const notifyOrderStatusChanged = useCallback(() => {
    // تم إلغاء هذه الدالة لمنع الإشعارات المكررة
    // الإشعارات تأتي الآن من database trigger عند تغيير delivery_status
    console.log('تم إلغاء إرسال الإشعارات من هنا - التريغر يتولى الأمر');
  }, []);

  // إشعارات التحاسب
  const notifySettlementRequested = useCallback(async (request, employee) => {
    // إشعار للمدير
    if (hasPermission('manage_settlements')) {
      await createNotification({
        title: 'طلب تحاسب جديد',
        message: `${employee.name} يطلب التحاسب على ${request.order_ids.length} طلب بقيمة ${request.total_profit.toLocaleString()} د.ع`,
        type: 'warning',
        target_role: 'manager',
        related_entity_type: 'settlement_request',
        related_entity_id: request.id,
        priority: 'high'
      });
    }
  }, [createNotification, hasPermission]);

  const notifySettlementApproved = useCallback(async (request, invoice, approvedBy) => {
    // إشعار للموظف
    await createNotification({
      title: 'تم الموافقة على التحاسب',
      message: `تم الموافقة على طلب التحاسب الخاص بك. فاتورة رقم ${invoice.invoice_number} بقيمة ${invoice.total_amount.toLocaleString()} د.ع`,
      type: 'success',
      target_user_id: request.employee_id,
      related_entity_type: 'settlement_invoice',
      related_entity_id: invoice.id,
      priority: 'high'
    });
  }, [createNotification]);

  const notifySettlementRejected = useCallback(async (request, reason, rejectedBy) => {
    // إشعار للموظف
    await createNotification({
      title: 'تم رفض طلب التحاسب',
      message: `تم رفض طلب التحاسب الخاص بك. السبب: ${reason || 'غير محدد'}`,
      type: 'error',
      target_user_id: request.employee_id,
      related_entity_type: 'settlement_request',
      related_entity_id: request.id,
      priority: 'high'
    });
  }, [createNotification]);

  // إشعارات المخزون
  const notifyLowStock = useCallback(async (product, variant) => {
    if (!hasPermission('manage_inventory')) return;
    
    try {
      // التحقق من آخر إشعار تم إرساله لهذا المنتج
      const { data: existingNotifications, error } = await supabase
        .from('stock_notification_history')
        .select('*')
        .eq('product_id', product.id)
        .eq('variant_id', variant.id)
        .order('notification_sent_at', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error('Error checking notification history:', error);
        return;
      }
      
      // الحصول على إعدادات التكرار من الإعدادات المحفوظة
      const { data: stockSettings } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'stock_notification_settings')
        .single();
      
      // استخدام الإعدادات المحفوظة أو القيم الافتراضية
      const userSettings = stockSettings?.value || {};
      const frequencyHours = userSettings.notificationFrequencyHours || 168; // افتراضي أسبوع
      
      // التحقق من تفعيل الإشعارات
      if (!userSettings.enableLowStockNotifications && !userSettings.enableOutOfStockNotifications) {
        return; // الإشعارات معطلة
      }
      
      const now = new Date();
      
      // التحقق من عدم إرسال إشعار خلال الفترة المحددة
      if (existingNotifications && existingNotifications.length > 0) {
        const lastNotification = existingNotifications[0];
        const lastNotificationTime = new Date(lastNotification.notification_sent_at);
        const hoursSinceLastNotification = (now - lastNotificationTime) / (1000 * 60 * 60);
        
        if (hoursSinceLastNotification < frequencyHours) {
          return; // لا نرسل إشعار جديد إذا كان الوقت لم يحن بعد
        }
      }
      
      // إنشاء الإشعار
      await createNotification({
        title: 'تنبيه نقص مخزون',
        message: `المنتج ${product.name} (${variant.color} - ${variant.size}) كمية منخفضة: ${variant.quantity}`,
        type: 'warning',
        target_role: 'manager',
        related_entity_type: 'product',
        related_entity_id: product.id,
        priority: 'high'
      });
      
      // تسجيل الإشعار في التاريخ
      await supabase.from('stock_notification_history').insert({
        product_id: product.id,
        variant_id: variant.id,
        stock_level: variant.quantity,
        notification_type: 'low_stock',
        user_id: user?.id
      });
      
    } catch (error) {
      console.error('Error in notifyLowStock:', error);
    }
  }, [createNotification, hasPermission, user?.id]);

  // قراءة الإشعار
  const markAsRead = useCallback(async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      
      if (error) {
        console.error('Error marking notification as read:', error);
        return;
      }
      
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error in markAsRead:', error);
    }
  }, []);

  // قراءة جميع الإشعارات
  const markAllAsRead = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .neq('is_read', true);
      
      if (error) {
        console.error('Error marking all notifications as read:', error);
        return;
      }
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error in markAllAsRead:', error);
    }
  }, []);

  // حذف إشعار
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      // حذف من قاعدة البيانات أولاً
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);
      
      if (error) {
        console.error('Error deleting notification from database:', error);
        toast({
          title: "خطأ",
          description: "حدث خطأ أثناء حذف الإشعار",
          variant: "destructive",
        });
        return;
      }
      
      // تحديث الحالة المحلية
      setNotifications(prev => {
        const notification = prev.find(n => n.id === notificationId);
        if (notification && !notification.read) {
          setUnreadCount(prevCount => Math.max(0, prevCount - 1));
        }
        return prev.filter(n => n.id !== notificationId);
      });
      
    } catch (error) {
      console.error('Error in deleteNotification:', error);
    }
  }, []);

  // فلترة الإشعارات حسب المستخدم
  const userNotifications = notifications.filter(n => {
    if (n.target_user_id && n.target_user_id === user?.id) return true;
    if (n.target_role === 'manager' && hasPermission('manage_orders')) return true;
    if (n.target_role === 'employee' && !hasPermission('manage_orders')) return true;
    if (n.target_role === 'all') return true;
    return false;
  });

  const value = {
    notifications: userNotifications,
    unreadCount,
    createNotification,
    notifyOrderCreated,
    notifyOrderStatusChanged,
    updateOrCreateOrderNotification,
    notifySettlementRequested,
    notifySettlementApproved,
    notifySettlementRejected,
    notifyLowStock,
    markAsRead,
    markAllAsRead,
    deleteNotification
  };

  return (
    <NotificationsSystemContext.Provider value={value}>
      {children}
    </NotificationsSystemContext.Provider>
  );
};