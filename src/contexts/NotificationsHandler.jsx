import { useEffect } from 'react';
import { useAuth } from './UnifiedAuthContext';
import { useNotifications } from './NotificationsContext';
import { supabase } from '@/integrations/supabase/client';
import { notificationService } from '@/utils/NotificationService';
import { useUnreadNotificationsCheck } from '@/hooks/useUnreadNotificationsCheck';
import { useReliableAiOrderNotifications } from '@/hooks/useReliableAiOrderNotifications';
import { useAiOrderEventListener } from '@/hooks/useAiOrderEventListener';
import { useAiOrderFallbackChecker } from '@/hooks/useAiOrderFallbackChecker';

const NotificationsHandler = () => {
  const { user, fetchAdminData } = useAuth();
  const { addNotification } = useNotifications();
  
  // فحص الإشعارات غير المقروءة عند فتح الموقع
  useUnreadNotificationsCheck(user);
  
  // نظام إشعارات الطلبات الذكية الموثوق
  useReliableAiOrderNotifications(user);
  
  // مستمع أحداث الطلبات الذكية
  useAiOrderEventListener(user);
  
  // نظام احتياطي للتحقق من الطلبات الذكية الجديدة عند فتح الموقع
  useAiOrderFallbackChecker(user);

  useEffect(() => {
    // التحقق من الشروط الأساسية
    if (!supabase || !user || !addNotification) {
      console.log('❌ NotificationsHandler: Missing requirements', { 
        supabase: !!supabase, 
        user: !!user, 
        addNotification: !!addNotification 
      });
      return;
    }
    
    console.log('🔄 NotificationsHandler: Setting up notifications for user:', {
      userId: user.id,
      role: user.role,
      roles: user.roles,
      employeeCode: user.employee_code,
      isAdmin: user.roles?.includes('super_admin')
    });
    
    // فحص إذا كان المستخدم مدير - استخدام user.roles بدلاً من user.role
    const isAdmin = user.roles?.includes('super_admin');
    
    // ADMIN ONLY NOTIFICATIONS - These create notifications directly
    
    // New user registration
    const profilesChannel = supabase
      .channel('profiles-changes-notifications-handler-admin')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'profiles' },
        (payload) => {
          if (payload.new.status === 'pending') {
            fetchAdminData?.();
            addNotification({
              type: 'new_registration',
              title: 'طلب تسجيل جديد',
              message: `الموظف ${payload.new.full_name || 'الجديد'} سجل في النظام.`,
              icon: 'UserPlus',
              color: 'purple',
              data: { id: payload.new.id },
              user_id: null, // Admin only
            });
          }
        }
      )
      .subscribe();

    // إشعارات الطلبات الجديدة معطلة نهائياً لتجنب الإزعاج
    // const ordersChannel = supabase
    //   .channel('orders-notifications-handler-admin')
    //   .on(
    //     'postgres_changes',
    //     { event: 'INSERT', schema: 'public', table: 'orders' },
    //     (payload) => {
    //       // إشعارات new_order معطلة نهائياً بناءً على طلب المستخدم
    //       console.log('🔕 إشعار طلب جديد معطل:', payload.new.order_number);
    //     }
    //   )
    //   .subscribe();

    // إشعارات طلبات تليجرام (AI Orders) - نظام مبسط وموثوق
    const aiOrdersChannel = supabase
      .channel(`ai-orders-notifications-simplified-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_orders' },
        async (payload) => {
          console.log('🔥 SIMPLIFIED: AI Orders Real-time INSERT detected:', {
            orderId: payload.new?.id,
            currentUser: user.id,
            userRole: user.role,
            userRoles: user.roles,
            userEmployeeCode: user.employee_code,
            orderCreatedBy: payload.new?.created_by,
            orderSource: payload.new?.source,
            isAdmin: user?.roles?.includes('super_admin')
          });

          try {
            // جلب بيانات الموظف الذي أنشأ الطلب
            let employeeName = 'موظف جديد';
            if (payload.new?.created_by) {
              console.log('🔍 SIMPLIFIED: Looking up employee with user_id:', payload.new.created_by);
              
              const { data: emp, error: empError } = await supabase
                .from('profiles')
                .select('user_id, full_name, employee_code')
                .eq('user_id', payload.new.created_by)
                .maybeSingle();
              
              if (emp?.full_name) {
                employeeName = emp.full_name;
                console.log('✅ SIMPLIFIED: Found employee name:', employeeName);
              } else {
                employeeName = `موظف ${payload.new.created_by.substring(0, 8)}`;
                console.log('⚠️ SIMPLIFIED: Using fallback name:', employeeName);
              }
            }
            
            // منطق إشعارات مبسط وواضح
            const isAdmin = user?.roles?.includes('super_admin');
            const isOrderCreator = payload.new.created_by === user.id;
            const isManagerOrder = payload.new.created_by === '91484496-b887-44f7-9e5d-be9db5567604';

            console.log('🔍 SIMPLIFIED: Notification conditions:', {
              isAdmin,
              isOrderCreator,
              isManagerOrder,
              willCreateNotification: isOrderCreator || (isAdmin && !isManagerOrder)
            });

            // حفظ الإشعار في قاعدة البيانات أولاً
            let notificationSaved = false;
            
            if (isOrderCreator) {
              // إشعار للمستخدم الذي أنشأ الطلب (موظف أو مدير)
              console.log('✅ SIMPLIFIED: Creating notification for order creator');
              const { error: notifError } = await supabase
                .from('notifications')
                .insert({
                  user_id: payload.new.created_by,
                  type: 'new_ai_order',
                  title: 'طلب ذكي جديد',
                   message: `استلام طلب جديد من التليغرام يحتاج للمراجعة`,
                  data: { 
                    ai_order_id: payload.new.id,
                    created_by: payload.new.created_by,
                    source: payload.new.source || 'telegram',
                    employee_name: employeeName
                  },
                  is_read: false
                });
                
              if (notifError) {
                console.error('❌ SIMPLIFIED: Error saving creator notification:', notifError);
              } else {
                console.log('✅ SIMPLIFIED: Creator notification saved to database');
                notificationSaved = true;
              }
            }

            if (isAdmin && !isManagerOrder && user.id !== payload.new.created_by) {
              // إشعار إضافي للمدير إذا كان الطلب من موظف
              console.log('✅ SIMPLIFIED: Creating additional admin notification');
              const { error: adminNotifError } = await supabase
                .from('notifications')
                .insert({
                  user_id: null, // إشعار عام للمدير
                  type: 'new_ai_order',
                  title: 'طلب ذكي جديد من موظف',
                   message: `استلام طلب جديد من التليغرام بواسطة ${employeeName} يحتاج للمراجعة`,
                  data: { 
                    ai_order_id: payload.new.id,
                    created_by: payload.new.created_by,
                    employee_name: employeeName,
                    source: payload.new.source || 'telegram'
                  },
                  is_read: false
                });
                
              if (adminNotifError) {
                console.error('❌ SIMPLIFIED: Error saving admin notification:', adminNotifError);
              } else {
                console.log('✅ SIMPLIFIED: Admin notification saved to database');
                notificationSaved = true;
              }
            }

            // إضافة الإشعار للسياق المحلي فوراً بغض النظر عن قاعدة البيانات
            if (isOrderCreator) {
              addNotification({
                type: 'new_ai_order',
                title: 'طلب ذكي جديد',
                 message: `استلام طلب جديد من التليغرام يحتاج للمراجعة`,
                icon: 'MessageSquare',
                color: 'green',
                data: { 
                  ai_order_id: payload.new.id,
                  created_by: payload.new.created_by,
                  source: payload.new.source || 'telegram'
                },
                user_id: payload.new.created_by,
                is_read: false
              });
              console.log('✅ SIMPLIFIED: Added creator notification to local context');
            }

            if (isAdmin && !isManagerOrder && user.id !== payload.new.created_by) {
              addNotification({
                type: 'new_ai_order',
                title: 'طلب ذكي جديد من موظف',
                 message: `استلام طلب جديد من التليغرام بواسطة ${employeeName} يحتاج للمراجعة`,
                icon: 'MessageSquare',
                color: 'amber',
                data: { 
                  ai_order_id: payload.new.id,
                  created_by: payload.new.created_by,
                  employee_name: employeeName,
                  source: payload.new.source || 'telegram'
                },
                user_id: null,
                is_read: false
              });
              console.log('✅ SIMPLIFIED: Added admin notification to local context');
            }

            // إشعار متصفح فوري
            try {
              await notificationService.notifyAiOrder({
                id: payload.new.id,
                source: payload.new.source || 'telegram',
                employee_name: employeeName,
                created_by: payload.new.created_by
              });
              console.log('✅ SIMPLIFIED: Browser notification sent');
            } catch (browserNotifError) {
              console.log('⚠️ SIMPLIFIED: Browser notification failed:', browserNotifError);
            }

            // أحداث فورية للواجهة - دائماً
            console.log('🔄 SIMPLIFIED: Dispatching UI refresh events');
            window.dispatchEvent(new CustomEvent('newAiOrderNotification', { 
              detail: { 
                orderId: payload.new.id,
                employeeName,
                createdBy: payload.new.created_by,
                timestamp: new Date().toISOString()
              } 
            }));

            window.dispatchEvent(new CustomEvent('aiOrderCreated', { 
              detail: { ...payload.new, employeeName } 
            }));

            // تحديث الإشعارات فوراً
            if (window.refreshNotifications) {
              window.refreshNotifications();
              console.log('✅ SIMPLIFIED: Triggered notifications refresh');
            }
            
          } catch (e) {
            console.error('❌ SIMPLIFIED: Critical AI order notification error:', e);
            
            // إشعار احتياطي أساسي في حالة الخطأ
            addNotification({
              type: 'new_ai_order',
              title: 'طلب ذكي جديد',
              message: 'تم استلام طلب ذكي جديد من التليغرام',
              icon: 'MessageSquare',
              color: 'amber',
              data: { ai_order_id: payload.new?.id || null },
              user_id: user.id,
              is_read: false
            });
            console.log('✅ SIMPLIFIED: Fallback notification created');
          }
        }
      )
      .subscribe((status) => {
        console.log('📊 SIMPLIFIED: AI Orders Real-time subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ SIMPLIFIED: Successfully subscribed to AI orders Real-time updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ SIMPLIFIED: Error in AI orders Real-time subscription');
        }
      });

    // إشعارات المخزون تتم الآن من خلال StockMonitoringSystem


    // تنظيف القنوات
    return () => {
      console.log('🧹 SIMPLIFIED: Cleaning up notification channels');
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(aiOrdersChannel);
    };
    
  }, [user, fetchAdminData, addNotification]);

  return null;
};

export default NotificationsHandler;