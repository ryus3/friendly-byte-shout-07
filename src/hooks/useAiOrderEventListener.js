// مستمع الأحداث المخصص للطلبات الذكية
import { useEffect } from 'react';
import { useNotifications } from '@/contexts/NotificationsContext';

export const useAiOrderEventListener = (user) => {
  const { addNotification } = useNotifications();

  useEffect(() => {
    if (!user) return;

    console.log('🎧 LISTENER: Setting up AI order event listeners');

    // مستمع إشعارات الطلبات الذكية الموثوقة
    const handleReliableNotification = async (event) => {
      const { detail } = event;
      console.log('🔔 LISTENER: Reliable AI order notification:', detail);

      try {
        const isAdmin = user?.roles?.includes('super_admin');
        const isCreator = detail.createdBy === user.id;
        const isManagerOrder = detail.createdBy === '91484496-b887-44f7-9e5d-be9db5567604';

        // إضافة الإشعار للسياق المحلي
        if (isCreator) {
          await addNotification({
            type: 'new_ai_order',
            title: 'طلب ذكي جديد',
            message: `استلام طلب جديد من ${detail.source || 'التليغرام'} يحتاج للمراجعة`,
            icon: 'MessageSquare',
            color: 'green',
            data: { 
              ai_order_id: detail.orderId,
              created_by: detail.createdBy,
              source: detail.source || 'telegram'
            },
            user_id: detail.createdBy,
            is_read: false
          });
          console.log('✅ LISTENER: Creator notification added');
        }

        if (isAdmin && !isManagerOrder && user.id !== detail.createdBy) {
          await addNotification({
            type: 'new_ai_order',
            title: 'طلب ذكي جديد من موظف',
            message: `استلام طلب جديد من ${detail.source || 'التليغرام'} بواسطة ${detail.creatorName} يحتاج للمراجعة`,
            icon: 'MessageSquare',
            color: 'amber',
            data: { 
              ai_order_id: detail.orderId,
              created_by: detail.createdBy,
              employee_name: detail.creatorName,
              source: detail.source || 'telegram'
            },
            user_id: null,
            is_read: false
          });
          console.log('✅ LISTENER: Admin notification added');
        }

        // تحديث العداد والواجهة
        if (window.refreshNotifications) {
          window.refreshNotifications();
        }

      } catch (error) {
        console.error('❌ LISTENER: Error handling notification:', error);
      }
    };

    // ربط المستمعات
    window.addEventListener('reliableAiOrderNotification', handleReliableNotification);

    // تنظيف المستمعات
    return () => {
      window.removeEventListener('reliableAiOrderNotification', handleReliableNotification);
      console.log('🧹 LISTENER: Event listeners cleaned up');
    };

  }, [user, addNotification]);

  return null;
};