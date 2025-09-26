import { useEffect } from 'react';
import { useAuth } from './UnifiedAuthContext';
import { useNotifications } from './NotificationsContext';
import { supabase } from '@/integrations/supabase/client';
import { notificationService } from '@/utils/NotificationService';
import { useUnreadNotificationsCheck } from '@/hooks/useUnreadNotificationsCheck';

const NotificationsHandler = () => {
  const { user, fetchAdminData } = useAuth();
  const { addNotification } = useNotifications();
  
  // فحص الإشعارات غير المقروءة عند فتح الموقع
  useUnreadNotificationsCheck(user);

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

    // إشعارات طلبات تليجرام (AI Orders) - للمدير والموظفين مع تسجيل مفصل
    const aiOrdersChannel = supabase
      .channel(`ai-orders-notifications-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_orders' },
        async (payload) => {
          console.log('🔥 NotificationsHandler: AI Orders Real-time INSERT detected:', {
            payload: payload.new,
            currentUser: user.id,
            userRole: user.role,
            userEmployeeCode: user.employee_code,
            orderCreatedBy: payload.new?.created_by,
            orderSource: payload.new?.source
          });

          try {
            // محاولة جلب بيانات الموظف الذي أنشأ الطلب
            let employeeName = 'طلب تليغرام';
            let employeeProfile = null;
            
            if (payload.new?.created_by) {
              console.log('🔍 Looking up employee with user_id:', payload.new.created_by);
              
              // البحث بـ user_id في جدول profiles  
              const { data: emp, error: empError } = await supabase
                .from('profiles')
                .select('user_id, full_name, employee_code')
                .eq('user_id', payload.new.created_by)
                .maybeSingle();
              
              if (empError) {
                console.error('❌ Error fetching employee profile:', empError);
              }
              
              console.log('👤 Employee profile lookup result:', emp);
              
              if (emp?.full_name) {
                employeeName = emp.full_name;
                employeeProfile = emp;
              } else {
                employeeName = `موظف ${payload.new.created_by}`;
              }
            }
            
            console.log('📝 Final employee name for notification:', employeeName);
            
            // منطق مبسط وواضح للإشعارات
            console.log('🔍 Checking notification conditions:', {
              currentUserId: user.id,
              orderCreatedBy: payload.new.created_by,
              isAdmin,
              managerIdHardcoded: '91484496-b887-44f7-9e5d-be9db5567604'
            });

            // إشعار دائماً للشخص الذي أنشأ الطلب (موظف أو مدير)
            if (payload.new.created_by === user.id) {
              console.log('✅ Creating notification for order creator (current user)');
              const creatorNotification = {
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
              };
              console.log('📤 Creator notification data:', creatorNotification);
              addNotification(creatorNotification);
            }

            // إشعار إضافي للمدير إذا كان الطلب من موظف وليس من المدير نفسه
            if (isAdmin && 
                payload.new.created_by !== '91484496-b887-44f7-9e5d-be9db5567604' && 
                user.id !== payload.new.created_by) {
              console.log('✅ Creating additional admin notification for employee order');
              const adminNotification = {
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
                user_id: null, // Admin notification
                is_read: false
              };
              console.log('📤 Admin notification data:', adminNotification);
              addNotification(adminNotification);
            }

            // إشعار فوري بدون تأخير للوصول الفوري
            console.log('🔔 Dispatching immediate notification event for UI refresh');
            window.dispatchEvent(new CustomEvent('newAiOrderNotification', { 
              detail: { 
                orderId: payload.new.id,
                employeeName,
                createdBy: payload.new.created_by,
                timestamp: new Date().toISOString()
              } 
            }));

            // إشعار متصفح فوري للطلبات الذكية
            if (payload.new?.id) {
              notificationService.notifyAiOrder({
                id: payload.new.id,
                source: payload.new.source || 'telegram',
                employee_name: employeeName,
                created_by: payload.new.created_by
              }).catch(error => {
                console.log('⚠️ Browser notification not available:', error);
              });
            }
            
            // بث حدث متصفح احتياطي لتحديث الواجهات فوراً
            console.log('🔄 Dispatching aiOrderCreated browser event');
            window.dispatchEvent(new CustomEvent('aiOrderCreated', { 
              detail: { ...payload.new, employeeName } 
            })); 
            
          } catch (e) {
            console.error('❌ AI order notification error:', e);
            // إشعار احتياطي في حالة الخطأ
            console.log('⚠️ Creating fallback notification due to error');
            addNotification({
              type: 'new_ai_order',
              title: 'طلب ذكي جديد',
              message: 'تم استلام طلب ذكي جديد من التليغرام',
              icon: 'MessageSquare',
              color: 'amber',
              data: { ai_order_id: payload.new?.id || null },
              user_id: isAdmin ? null : user.id,
              is_read: false
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('📊 NotificationsHandler: AI Orders Real-time subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to AI orders Real-time updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error in AI orders Real-time subscription');
        }
      });

    // إشعارات المخزون تتم الآن من خلال StockMonitoringSystem


    return () => {
      supabase.removeChannel(profilesChannel);
      // ordersChannel معطل
      supabase.removeChannel(aiOrdersChannel);
    };
    
  }, [user, fetchAdminData, addNotification]);

  return null;
};

export default NotificationsHandler;