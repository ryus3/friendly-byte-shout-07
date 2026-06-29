import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/UnifiedAuthContext';

/**
 * عداد القائمة الجانبية:
 *  - notifications: إشعارات المستخدم غير المقروءة فعلياً
 *      (is_read=false AND notification_id غير موجود في notification_reads للمستخدم)
 *  - offChannel:    تحصيلات بانتظار التأكيد
 *      • المدير/المالك: عالمياً (status = pending_owner_confirmation)
 *      • الموظف:       تحصيلاته التي بانتظار تصنيفه
 */
export function useSidebarBadges() {
  const { user } = useAuth();
  const userId = user?.user_id || user?.id;
  const isManager = (user?.roles || []).some((r) =>
    ['super_admin', 'admin', 'department_manager'].includes(r)
  );

  const [notifications, setNotifications] = useState(0);
  const [offChannel, setOffChannel] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setNotifications(0);
      setOffChannel(0);
      return;
    }

    // ✅ إشعارات غير مقروءة: استبعد ما يوجد له سجل في notification_reads
    try {
      const [unreadRes, readsRes] = await Promise.all([
        supabase
          .from('notifications')
          .select('id')
          .eq('user_id', userId)
          .eq('is_read', false)
          .limit(2000),
        supabase
          .from('notification_reads')
          .select('notification_id')
          .eq('user_id', userId)
          .limit(5000),
      ]);

      const readSet = new Set((readsRes.data || []).map((r) => r.notification_id));
      const realUnread = (unreadRes.data || []).filter((n) => !readSet.has(n.id));
      setNotifications(realUnread.length);
    } catch {
      setNotifications(0);
    }

    // ✅ تحصيلات
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

  // ⚡ real-time: تحديث فور تغيّر الإشعارات أو التحصيلات
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`sidebar-badges-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        refresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notification_reads', filter: `user_id=eq.${userId}` },
        refresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'off_channel_collections' },
        refresh
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, refresh]);

  return { notifications, offChannel, refresh };
}

export default useSidebarBadges;
