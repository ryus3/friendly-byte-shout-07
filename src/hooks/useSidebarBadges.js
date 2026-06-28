import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/UnifiedAuthContext';

/**
 * عداد صغير للقائمة الجانبية:
 *  - notifications: عدد إشعارات المستخدم غير المقروءة
 *  - offChannel:    عدد التحصيلات بانتظار التأكيد
 *                   • المدير العام/المالك: الكل عالمياً (status = pending_owner_confirmation)
 *                   • الموظف: تحصيلاته التي بانتظار تصنيفه (collector = me, status = pending_classification)
 */
export function useSidebarBadges() {
  const { user } = useAuth();
  const userId = user?.user_id || user?.id;
  const isManager = (user?.roles || []).some((r) => ['super_admin', 'admin'].includes(r));

  const [notifications, setNotifications] = useState(0);
  const [offChannel, setOffChannel] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setNotifications(0);
      setOffChannel(0);
      return;
    }

    try {
      const { count: notifCount } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      setNotifications(notifCount || 0);
    } catch {
      setNotifications(0);
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
    refresh();
  }, [refresh]);

  // ⚡ real-time: تحديث العدّاد فور تغيّر إشعارات المستخدم أو التحصيلات
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`sidebar-badges-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'off_channel_collections' }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, refresh]);

  return { notifications, offChannel, refresh };
}

export default useSidebarBadges;
