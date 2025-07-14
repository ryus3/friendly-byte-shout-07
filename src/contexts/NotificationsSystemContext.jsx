import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

const NotificationsSystemContext = createContext();

export const useNotificationsSystem = () => {
  const context = useContext(NotificationsSystemContext);
  if (!context) throw new Error('useNotificationsSystem must be used within NotificationsSystemProvider');
  return context;
};

export const NotificationsSystemProvider = ({ children }) => {
  const { user, hasPermission } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

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

      // هنا يمكن إضافة حفظ في قاعدة البيانات
      // await supabase.from('notifications').insert([notification]);

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

  const notifyOrderStatusChanged = useCallback(async (order, oldStatus, newStatus, changedBy) => {
    const statusLabels = {
      pending: 'قيد التجهيز',
      shipped: 'تم الشحن',
      processing: 'قيد التسليم',
      delivered: 'تم التوصيل',
      returned: 'راجع',
      cancelled: 'ملغي'
    };

    // إشعار للمدير
    if (hasPermission('manage_orders')) {
      await createNotification({
        title: 'تغيير حالة طلب',
        message: `الطلب #${order.trackingnumber} تغير من ${statusLabels[oldStatus]} إلى ${statusLabels[newStatus]}`,
        type: newStatus === 'delivered' ? 'success' : 'info',
        target_role: 'manager',
        related_entity_type: 'order',
        related_entity_id: order.id,
        priority: newStatus === 'delivered' ? 'high' : 'normal'
      });
    }

    // إشعار للموظف صاحب الطلب
    if (order.created_by && order.created_by !== user?.id) {
      await createNotification({
        title: 'تحديث طلبك',
        message: `طلبك #${order.trackingnumber} تغير إلى ${statusLabels[newStatus]}`,
        type: newStatus === 'delivered' ? 'success' : 'info',
        target_user_id: order.created_by,
        related_entity_type: 'order',
        related_entity_id: order.id,
        priority: 'normal'
      });
    }
  }, [createNotification, hasPermission, user?.id]);

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
      
      // الحصول على إعدادات التكرار
      const { data: settings } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'stock_notification_frequency')
        .single();
      
      const frequencyHours = settings?.value?.hours || 24;
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
    setNotifications(prev => prev.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // قراءة جميع الإشعارات
  const markAllAsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  // حذف إشعار
  const deleteNotification = useCallback(async (notificationId) => {
    setNotifications(prev => {
      const notification = prev.find(n => n.id === notificationId);
      if (notification && !notification.read) {
        setUnreadCount(prevCount => Math.max(0, prevCount - 1));
      }
      return prev.filter(n => n.id !== notificationId);
    });
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