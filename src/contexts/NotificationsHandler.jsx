import { useEffect } from 'react';
import { useAuth } from './UnifiedAuthContext';
import { useNotifications } from './NotificationsContext';
import { supabase } from '@/integrations/supabase/client';

const NotificationsHandler = () => {
  const { user, fetchAdminData } = useAuth();
  const { addNotification } = useNotifications();

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
      employeeCode: user.employee_code,
      isAdmin: user.role === 'admin'
    });
    
    // فحص إذا كان المستخدم مدير
    const isAdmin = user.role === 'admin';
    
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

    // New order notifications for admin
    const ordersChannel = supabase
      .channel('orders-notifications-handler-admin')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          // جلب اسم المستخدم صاحب الطلب مع معالجة حالة created_by = null
          const getUserName = async () => {
            try {
              let userName = 'مستخدم غير معروف';
              
              // إذا كان created_by موجود، جلب اسم المستخدم
              if (payload.new.created_by) {
                const { data: userData } = await supabase
                  .from('profiles')
                  .select('full_name')
                  .eq('user_id', payload.new.created_by)
                  .maybeSingle(); // استخدام maybeSingle بدلاً من single
                
                userName = userData?.full_name || 'موظف غير معروف';
              } else {
                // إذا كان created_by فارغ، هذا طلب من التليغرام
                userName = 'طلب من التليغرام';
              }
              
              addNotification({
                type: 'new_order',
                title: 'طلب جديد',
                message: `طلب رقم ${payload.new.order_number} بواسطة ${userName}`,
                icon: 'ShoppingCart',
                color: 'blue',
                data: { orderId: payload.new.id, orderNumber: payload.new.order_number },
                user_id: null, // Admin only
              });
            } catch (error) {
              console.error('Error fetching user name:', error);
              // fallback notification
              addNotification({
                type: 'new_order',
                title: 'طلب جديد',
                message: `طلب رقم ${payload.new.order_number} بواسطة مستخدم غير معروف`,
                icon: 'ShoppingCart',
                color: 'blue',
                data: { orderId: payload.new.id, orderNumber: payload.new.order_number },
                user_id: null, // Admin only
              });
            }
          };
          
          getUserName();
        }
      )
      .subscribe();

    // إشعارات طلبات تليجرام (AI Orders) - للمدير والموظفين
    const aiOrdersChannel = supabase
      .channel('ai-orders-notifications-handler-all-users')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_orders' },
        async (payload) => {
          console.log('🔥 AI Orders Real-time INSERT detected:', {
            payload: payload.new,
            currentUser: user.id,
            userRole: user.role,
            userEmployeeCode: user.employee_code,
            orderCreatedBy: payload.new?.created_by
          });

          try {
            // محاولة جلب بيانات الموظف الذي أنشأ الطلب
            let employeeName = 'طلب تليغرام';
            let employeeProfile = null;
            
            if (payload.new?.created_by) {
              // البحث بـ employee_code في جدول profiles  
              const { data: emp } = await supabase
                .from('profiles')
                .select('user_id, full_name, employee_code')
                .eq('employee_code', payload.new.created_by)
                .maybeSingle();
              
              console.log('👤 Employee profile lookup result:', emp);
              
              if (emp?.full_name) {
                employeeName = emp.full_name;
                employeeProfile = emp;
              } else {
                employeeName = `موظف ${payload.new.created_by}`;
              }
            }
            
            // إشعار للموظف الذي أنشأ الطلب
            if (employeeProfile && user.employee_code === payload.new.created_by) {
              console.log('✅ Adding notification for employee who created the order');
              addNotification({
                type: 'new_ai_order',
                title: `طلب ذكي جديد - ${payload.new.customer_name}`,
                message: `تم إنشاء طلب ذكي جديد من ${payload.new.customer_name} بقيمة ${payload.new.total_amount} دينار`,
                icon: 'MessageSquare',
                color: 'green',
                data: { 
                  ai_order_id: payload.new.id,
                  customer_name: payload.new.customer_name,
                  total_amount: payload.new.total_amount,
                  source: payload.new.source,
                  created_by: payload.new.created_by
                },
                user_id: user.id,
              });
            }

            // إشعار للمديرين (بغض النظر عن من أنشأ الطلب)
            if (isAdmin) {
              console.log('✅ Adding admin notification for AI order');
              addNotification({
                type: 'new_ai_order',
                title: 'طلب ذكي جديد من تليغرام',
                message: `طلب ذكي جديد من ${employeeName} - ${payload.new.customer_name} بقيمة ${payload.new.total_amount} دينار`,
                icon: 'MessageSquare',
                color: 'amber',
                data: { 
                  ai_order_id: payload.new.id,
                  customer_name: payload.new.customer_name,
                  total_amount: payload.new.total_amount,
                  source: payload.new.source,
                  created_by: payload.new.created_by,
                  employee_name: employeeName
                },
                user_id: null, // Admin notification
              });
            }
            
            // بث حدث متصفح احتياطي لتحديث الواجهات فوراً
            console.log('🔄 Dispatching aiOrderCreated event');
            window.dispatchEvent(new CustomEvent('aiOrderCreated', { 
              detail: { ...payload.new, employeeName } 
            })); 
            
          } catch (e) {
            console.error('❌ AI order notification error:', e);
            // إشعار احتياطي في حالة الخطأ
            if (isAdmin) {
              addNotification({
                type: 'new_ai_order',
                title: 'طلب ذكي جديد',
                message: 'تم استلام طلب ذكي جديد من التليغرام',
                icon: 'MessageSquare',
                color: 'amber',
                data: { ai_order_id: payload.new?.id || null },
                user_id: null,
              });
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('🔄 AI Orders Real-time subscription status:', status);
      });

    // إشعارات المخزون تتم الآن من خلال StockMonitoringSystem


    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(aiOrdersChannel);
    };
    
  }, [user, fetchAdminData, addNotification]);

  return null;
};

export default NotificationsHandler;