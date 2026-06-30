import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';

/**
 * عداد القائمة الجانبية — موحَّد مع عداد الهيدر:
 *  - notifications: مأخوذ مباشرةً من NotificationsContext.unreadCount
 *    (نفس المصدر الذي يستخدمه جرس الهيدر تماماً → الأرقام متطابقة)
 *  - offChannel:    تحصيلات بانتظار التأكيد
 */
export function useSidebarBadges() {
  const { user } = useAuth();
  const userId = user?.user_id || user?.id;
  const isManager = (user?.roles || []).some((r) =>
    ['super_admin', 'admin', 'department_manager'].includes(r)
  );

  // ✅ المصدر الموحَّد للإشعارات (نفس مصدر الهيدر)
  const { unreadCount = 0 } = useNotifications() || {};

  const [offChannel, setOffChannel] = useState(0);

  const refreshOffChannel = useCallback(async () => {
    if (!userId) {
      setOffChannel(0);
      return;
    }
    try {
      let query = supabase
        .from('off_channel_collections')
        .select('id', { count: 'exact', head: true });
      if (isManager) {
        query = query.eq('status', 'pending_owner_confirmation');
      } else {
        query = query.eq('collector_user_id', userId).eq('status', 'pending_classification');
      }
      const { count } = await query;
      setOffChannel(count || 0);
    } catch {
      setOffChannel(0);
    }
  }, [userId, isManager]);

  useEffect(() => {
    refreshOffChannel();
  }, [refreshOffChannel]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`sidebar-offchannel-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'off_channel_collections' },
        refreshOffChannel
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, refreshOffChannel]);

  return { notifications: unreadCount, offChannel, refresh: refreshOffChannel };
}

export default useSidebarBadges;

