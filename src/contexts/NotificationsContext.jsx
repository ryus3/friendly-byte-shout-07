
import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { useAuth } from './UnifiedAuthContext';
import { supabase } from '@/integrations/supabase/client';
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
    const { user } = useAuth();
  
    // Cache management for data optimization
    const [lastFetch, setLastFetch] = useState(0);
    const CACHE_DURATION = 30000; // 30 seconds cache
    
    const fetchNotifications = useCallback(async (force = false) => {
        if (!user || !supabase) return;
        
        // Use cache to reduce data usage
        const now = Date.now();
        if (!force && (now - lastFetch) < CACHE_DURATION) {
            return;
        }
        
        // جلب الإشعارات
        let query = supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(30);

        // فلترة الإشعارات حسب المستخدم
        const isAdmin = user?.roles?.includes('super_admin') || user?.roles?.includes('admin');
        const isDepartmentManager = user?.roles?.includes('department_manager');
        
        if (isAdmin) {
            // المدير العام يرى كل الإشعارات
        } else if (isDepartmentManager) {
            const { data: supervisedData } = await supabase
                .from('employee_supervisors')
                .select('employee_id')
                .eq('supervisor_id', user.id)
                .eq('is_active', true);
            
            const supervisedIds = supervisedData?.map(d => d.employee_id) || [];
            const allAllowedIds = [user.id, ...supervisedIds];
            
            query = query.or(`user_id.in.(${allAllowedIds.join(',')}),and(user_id.is.null,type.not.in.(profit_settlement_request,settlement_request,profit_settlement_completed,new_registration,low_stock,order_status_update_admin,new_order,order_created,cash_correction,balance_correction,main_cash_correction))`);
        } else {
            query = query.or(`user_id.eq.${user.id},and(user_id.is.null,type.not.in.(profit_settlement_request,settlement_request,profit_settlement_completed,new_registration,low_stock,order_status_update_admin,new_order,order_created,cash_correction,balance_correction,main_cash_correction))`);
        }
        
        const { data: notificationsData, error } = await query;
        
        if (error) {
            console.error("Error fetching notifications:", error);
            return;
        }
        
        // جلب قراءات المستخدم الحالي من جدول notification_reads
        const notificationIds = (notificationsData || []).map(n => n.id);
        
        let userReads = [];
        if (notificationIds.length > 0) {
            const { data: readsData } = await supabase
                .from('notification_reads')
                .select('notification_id')
                .eq('user_id', user.id)
                .in('notification_id', notificationIds);
            
            userReads = (readsData || []).map(r => r.notification_id);
        }
        
        // دمج حالة القراءة مع الإشعارات
        const notificationsWithReadStatus = (notificationsData || []).map(n => ({
            ...n,
            is_read: userReads.includes(n.id)
        }));
        
        setNotifications(notificationsWithReadStatus);
        setLastFetch(now);
    }, [user, lastFetch]);

    useEffect(() => {
        fetchNotifications();
        
        // إضافة مستمع لأحداث التحديث
        const handleRefresh = () => {
            fetchNotifications();
        };
        
        window.addEventListener('refresh-notifications', handleRefresh);
        window.refreshNotifications = fetchNotifications;
        
        return () => {
            window.removeEventListener('refresh-notifications', handleRefresh);
            delete window.refreshNotifications;
        };
    }, [fetchNotifications]);

    useEffect(() => {
        if (!user || !supabase) return () => {};

        console.log('🔄 NotificationsContext: Setting up real-time listener for user:', user.id);

        const handleNewNotification = (payload) => {
            const newNotification = payload.new;
            console.log('📬 NotificationsContext: New notification received:', {
                id: newNotification.id,
                type: newNotification.type,
                title: newNotification.title,
                user_id: newNotification.user_id,
                currentUser: user.id
            });

            const isForThisUser = newNotification.user_id === user.id;
            const isGlobalAdminNotification = newNotification.user_id === null;

            let shouldShow = false;

            if (isForThisUser) {
                shouldShow = true;
                console.log('✅ NotificationsContext: Notification is for current user');
            } else if (isGlobalAdminNotification) {
                const isAdmin = user?.roles?.includes('super_admin') || user?.roles?.includes('admin');
                if (isAdmin) {
                    shouldShow = true;
                    console.log('✅ NotificationsContext: Admin notification accepted');
                } else {
                    // التحقق من نوع الإشعار للموظفين
                    const adminOnlyGlobalTypes = ['profit_settlement_request', 'settlement_request', 'profit_settlement_completed', 'new_registration', 'low_stock', 'order_status_update_admin', 'new_order', 'order_created', 'cash_correction', 'balance_correction', 'main_cash_correction'];
                    if (!adminOnlyGlobalTypes.includes(newNotification.type)) {
                        shouldShow = true;
                        console.log('✅ NotificationsContext: Global notification accepted for employee');
                    } else {
                        console.log('❌ NotificationsContext: Admin-only notification blocked for employee');
                    }
                }
            } else {
                console.log('❌ NotificationsContext: Notification not for this user');
            }

            if (shouldShow) {
                // ✅ استثناء إشعارات تغيير حالة الطلبات من التوست - نكتفي بنافذة الإشعارات
                const skipToastForTypes = ['order_status_changed', 'order_status_update', 'alwaseet_status_change'];
                
                if (newNotification.type !== 'welcome' && !skipToastForTypes.includes(newNotification.type)) {
                    // تشغيل صوت الإشعار الاحترافي
                    try {
                        const notificationSettings = JSON.parse(localStorage.getItem('notificationSettings') || '{}');
                        const soundType = notificationSettings.sound || 'gentle';
                        const volume = (notificationSettings.volume || 70) / 100;
                        
                        const soundUrls = {
                            classic: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAo',
                            gentle: 'data:audio/wav;base64,UklGRjIEAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ4EAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAo',
                            bell: 'data:audio/wav;base64,UklGRjIEAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ4EAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAo',
                            chime: 'data:audio/wav;base64,UklGRjIEAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ4EAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAo'
                        };
                        
                        const audio = new Audio(soundUrls[soundType] || soundUrls.gentle);
                        audio.volume = volume;
                        audio.play().catch(() => {});
                    } catch (error) {
                        console.log('تعذر تشغيل صوت الإشعار');
                    }
                    
                    // Enhanced toast with proper variant mapping
                    const getVariantFromColor = (color) => {
                        switch (color) {
                            case 'green': return 'success';
                            case 'orange': return 'warning';
                            case 'red': return 'destructive';
                            case 'blue': return 'info';
                            case 'purple': return 'premium';
                            case 'pink': return 'celebration';
                            default: return 'default';
                        }
                    };

                    toast({
                        title: newNotification.title,
                        description: newNotification.message,
                        variant: getVariantFromColor(newNotification.color),
                        className: "animate-in slide-in-from-right-full duration-300 shadow-xl border-2",
                        duration: newNotification.type === 'welcome' ? 8000 : 6000,
                    });
                }
                
                // ✅ الإشعار يظهر في نافذة الإشعارات دائماً (سواء كان هناك توست أم لا)
                setNotifications(prev => [newNotification, ...prev.filter(n => n.id !== newNotification.id)]);
            }
        };

        const channel = supabase.channel('realtime-notifications-ryus')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
            }, handleNewNotification)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'notifications',
            }, (payload) => {
                // تحديث الإشعار في الحالة المحلية
                setNotifications(prev => prev.map(n => 
                    n.id === payload.new.id ? payload.new : n
                ));
            })
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'notifications',
            }, (payload) => {
                // حذف الإشعار من الحالة المحلية
                setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
            })
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Successfully subscribed to notifications realtime!');
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
    }, [user]);

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
            
            // إضافة الإشعار فوراً للعرض المحلي
            setNotifications(prev => [localNotification, ...prev]);
            
            // عرض الإشعار فوراً مع التأثيرات المحسنة
            if (notificationData.type !== 'welcome') {
                // تشغيل صوت الإشعار الاحترافي فوراً
                try {
                    const notificationSettings = JSON.parse(localStorage.getItem('notificationSettings') || '{}');
                    const soundType = notificationSettings.sound || 'gentle';
                    const volume = (notificationSettings.volume || 70) / 100;
                    
                    const soundUrls = {
                        classic: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAo',
                        gentle: 'data:audio/wav;base64,UklGRjIEAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ4EAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAo',
                        bell: 'data:audio/wav;base64,UklGRjIEAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ4EAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAo',
                        chime: 'data:audio/wav;base64,UklGRjIEAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ4EAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAo'
                    };
                    
                    const audio = new Audio(soundUrls[soundType] || soundUrls.gentle);
                    audio.volume = volume;
                    audio.play().catch(() => {});
                } catch (error) {
                    console.log('تعذر تشغيل صوت الإشعار');
                }
                
                // عرض الإشعار بالتصميم المحسن
                const getVariantFromColor = (color) => {
                    switch (color) {
                        case 'green': return 'success';
                        case 'orange': return 'warning';
                        case 'red': return 'destructive';
                        case 'blue': return 'info';
                        case 'purple': return 'premium';
                        case 'pink': return 'celebration';
                        default: return 'default';
                    }
                };

                toast({
                    title: localNotification.title,
                    description: localNotification.message,
                    variant: getVariantFromColor(localNotification.color),
                    className: "animate-in slide-in-from-right-full duration-300 shadow-xl border-2",
                    duration: 5000,
                });
            }
            return;
        }
        
        const targetUserId = notificationData.user_id === 'admin' ? null : notificationData.user_id;
    
        const { error } = await supabase.from('notifications').insert({
            user_id: targetUserId,
            type: notificationData.type,
            title: notificationData.title,
            message: notificationData.message,
            data: notificationData.data || {
                icon: notificationData.icon,
                color: notificationData.color,
                link: notificationData.link
            },
            auto_delete: notificationData.autoDelete || false
        });

        if (error) {
            console.error("Error adding notification:", error);
        }
    }, [user]);

    const markAsRead = useCallback(async (id) => {
        if (!supabase || !id || !user?.id) {
            console.error("Supabase client not available or invalid ID");
            return;
        }
        
        try {
            // إدراج سجل قراءة في جدول notification_reads
            const { error } = await supabase
                .from('notification_reads')
                .upsert({ 
                    notification_id: id, 
                    user_id: user.id,
                    read_at: new Date().toISOString()
                }, { 
                    onConflict: 'notification_id,user_id' 
                });
            
            if (error) {
                console.error("Error marking notification as read:", error);
                return;
            }
            
            // تحديث الحالة المحلية فقط عند النجاح
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            
        } catch (error) {
            console.error("Error in markAsRead:", error);
        }
    }, [user?.id]);

    const deleteNotification = useCallback(async (id) => {
        if (!supabase || !id) {
            console.error("Supabase client not available or invalid ID");
            return;
        }
        
        console.log("Deleting notification:", id);
        
        try {
            // حذف من قاعدة البيانات أولاً
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', id);
            
            if (error) {
                console.error("Error deleting notification:", error);
                return;
            }
            
            console.log("Successfully deleted notification:", id);
            
            // حذف من الحالة المحلية فقط عند النجاح
            setNotifications(prev => prev.filter(n => n.id !== id));
            
        } catch (error) {
            console.error("Error in deleteNotification:", error);
        }
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
        if (!supabase || !user?.id) {
            console.error("Supabase client not available or user not logged in");
            return;
        }
        
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
        if (unreadIds.length === 0) return;
        
        try {
            // إدراج سجلات قراءة لجميع الإشعارات غير المقروءة
            const readsToInsert = unreadIds.map(id => ({
                notification_id: id,
                user_id: user.id,
                read_at: new Date().toISOString()
            }));
            
            const { error } = await supabase
                .from('notification_reads')
                .upsert(readsToInsert, { 
                    onConflict: 'notification_id,user_id' 
                });
            
            if (error) {
                console.error("Error marking all as read:", error);
                return;
            }
            
            // تحديث الحالة المحلية فقط عند النجاح
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            
        } catch (error) {
            console.error("Error in markAllAsRead:", error);
        }
    }, [notifications, user?.id]);

    const clearAll = useCallback(async () => {
        if (!supabase) {
            console.error("Supabase client not available");
            return;
        }
        
        const idsToDelete = notifications.map(n => n.id);
        if (idsToDelete.length === 0) return;
    
        try {
            // حذف من قاعدة البيانات أولاً
            const { error } = await supabase
                .from('notifications')
                .delete()
                .in('id', idsToDelete);
            
            if (error) {
                console.error("Error clearing notifications:", error);
                return;
            }
            
            // مسح الحالة المحلية فقط عند النجاح
            setNotifications([]);
            
        } catch (error) {
            console.error("Error in clearAll:", error);
        }
    }, [notifications]);

    // حذف الإشعار التجريبي - النظام جاهز للإنتاج
    const sendTestNotification = null;

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
