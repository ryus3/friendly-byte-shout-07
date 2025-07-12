
import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast.js';
import { Bell, UserPlus, AlertTriangle, ShoppingCart, Bot, CheckCircle } from 'lucide-react';

const NotificationsContext = createContext(null);

export const useNotifications = () => {
    const context = useContext(NotificationsContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationsProvider');
    }
    return context;
};

export const NotificationsProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const { user, hasPermission } = useAuth();
  
    const fetchNotifications = useCallback(async () => {
        if (!user || !supabase) return;
        
        let query = supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (!hasPermission('view_all_notifications')) {
            query = query.or(`user_id.eq.${user.id},and(user_id.is.null,type.not.in.(profit_settlement_request,new_registration,low_stock,order_status_update_admin,new_order))`);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error("Error fetching notifications:", error);
        } else {
            setNotifications(data || []);
        }
    }, [user, hasPermission]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    useEffect(() => {
        if (!user || !supabase) return () => {};

        const handleNewNotification = (payload) => {
            const newNotification = payload.new;
            const isForThisUser = newNotification.user_id === user.id;
            const isGlobalAdminNotification = newNotification.user_id === null;

            let shouldShow = false;

            if (isForThisUser) {
                shouldShow = true;
            } else if (isGlobalAdminNotification) {
                if (hasPermission('view_all_notifications')) {
                    shouldShow = true;
                } else {
                    const adminOnlyGlobalTypes = ['profit_settlement_request', 'new_registration', 'low_stock', 'order_status_update_admin', 'new_order'];
                    if (!adminOnlyGlobalTypes.includes(newNotification.type)) {
                        shouldShow = true;
                    }
                }
            }

            if (shouldShow) {
                if (newNotification.type !== 'welcome') {
                    // تشغيل صوت الإشعار
                    try {
                        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUE');
                        audio.volume = 0.3;
                        audio.play().catch(() => {});
                    } catch (error) {
                        console.log('تعذر تشغيل صوت الإشعار');
                    }
                    
                    toast({
                        title: newNotification.title,
                        description: newNotification.message,
                        variant: newNotification.color === 'orange' ? 'destructive' : (newNotification.color === 'green' ? 'success' : 'default'),
                    });
                }
                setNotifications(prev => [newNotification, ...prev.filter(n => n.id !== newNotification.id)]);
            }
        };

        const channel = supabase.channel('realtime-notifications-ryus')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
            }, handleNewNotification)
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    // console.log('Successfully subscribed to notifications channel!');
                }
                if (err) {
                    console.log('Realtime notification subscription error:', err);
                }
            });

        return () => {
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, [user, hasPermission]);

    const addNotification = useCallback(async (notificationData) => {
        if (!supabase) {
            // إذا لم يكن هناك اتصال بقاعدة البيانات، أضف الإشعار محلياً فقط
            const localNotification = {
                id: Date.now().toString(),
                created_at: new Date().toISOString(),
                is_read: false,
                user_id: user?.id || null,
                type: notificationData.type || 'info',
                title: notificationData.title,
                message: notificationData.message,
                link: notificationData.link || '#',
                data: notificationData.data || null,
                icon: notificationData.icon || 'Bell',
                color: notificationData.color || 'blue',
                auto_delete: notificationData.autoDelete || false
            };
            
            // إضافة الإشعار فوراً
            setNotifications(prev => [localNotification, ...prev]);
            
            // تشغيل صوت الإشعار فوراً للإشعارات المحلية
            if (notificationData.type !== 'welcome') {
                try {
                    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUE');
                    audio.volume = 0.3;
                    audio.play().catch(() => {});
                } catch (error) {
                    console.log('تعذر تشغيل صوت الإشعار');
                }
            }
            return;
        }
        
        const targetUserId = notificationData.user_id === 'admin' ? null : notificationData.user_id;
    
        const { error } = await supabase.from('notifications').insert({
            user_id: targetUserId,
            type: notificationData.type,
            title: notificationData.title,
            message: notificationData.message,
            link: notificationData.link,
            data: notificationData.data,
            icon: notificationData.icon,
            color: notificationData.color,
            auto_delete: notificationData.autoDelete || false
        });

        if (error) {
            console.error("Error adding notification:", error);
        }
    }, [user]);

    const markAsRead = useCallback(async (id) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        if (error) {
            console.error("Error marking notification as read:", error);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: false } : n));
        }
    }, []);

    const deleteNotification = useCallback(async (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        await supabase.from('notifications').delete().eq('id', id);
    }, []);

    const deleteNotificationByTypeAndData = useCallback(async (type, data) => {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('type', type)
            .eq('data->>id', data.id);
        
        if (!error) {
            setNotifications(prev => prev.filter(n => !(n.type === type && n.data?.id === data.id)));
        } else {
            console.error('Error deleting notification by type and data:', error);
        }
    }, []);

    const markAllAsRead = useCallback(async () => {
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
        if (unreadIds.length === 0) return;
        
        const originalNotifications = [...notifications];
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        
        const { error } = await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
        if (error) {
            console.error("Error marking all as read:", error);
            setNotifications(originalNotifications);
        }
    }, [notifications]);

    const clearAll = useCallback(async () => {
        const idsToDelete = notifications.map(n => n.id);
        if (idsToDelete.length === 0) return;
    
        const originalNotifications = [...notifications];
        setNotifications([]);
    
        const { error } = await supabase.from('notifications').delete().in('id', idsToDelete);
        if (error) {
            console.error("Error clearing notifications:", error);
            setNotifications(originalNotifications);
        }
    }, [notifications]);

    const sendTestNotification = useCallback(() => {
        const notificationTypes = [
            {
                title: "تنبيه مخزون منخفض",
                message: "المنتج 'قميص قطني' وصل إلى الحد الأدنى للمخزون",
                type: "low_stock",
                icon: "AlertTriangle",
                color: "orange",
                auto_delete: false
            },
            {
                title: "تسجيل جديد",
                message: "طلب انضمام جديد من أحمد محمد",
                type: "new_registration", 
                icon: "UserPlus",
                color: "purple",
                auto_delete: false
            },
            {
                title: "طلب جديد",
                message: "طلب جديد #1234 من العميل سارة أحمد",
                type: "new_order",
                icon: "CheckCircle",
                color: "blue",
                auto_delete: false
            },
            {
                title: "طلب ذكي جديد",
                message: "تم استلام طلب ذكي جديد من الواسط",
                type: "new_ai_order",
                icon: "Bot",
                color: "green",
                auto_delete: false
            }
        ];
        
        const randomNotification = notificationTypes[Math.floor(Math.random() * notificationTypes.length)];
        addNotification(randomNotification);
        
        toast({
            title: "تم إرسال إشعار تجريبي",
            description: `نوع الإشعار: ${randomNotification.title}`
        });
    }, [addNotification]);

    const value = {
        notifications,
        unreadCount: notifications.filter(n => !n.is_read).length,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearAll,
        deleteNotification,
        deleteNotificationByTypeAndData,
        sendTestNotification
    };

    return (
        <NotificationsContext.Provider value={value}>
            {children}
        </NotificationsContext.Provider>
    );
};
