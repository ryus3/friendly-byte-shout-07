import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/UnifiedAuthContext';

/**
 * Hook لإدارة سجلات `off_channel_collections`.
 *
 * scope:
 *   'mine'           — السجلات التي يجب على المستخدم تصنيفها (collector = me)
 *   'inbox'          — السجلات بانتظار تأكيد المالك (owner = me)
 *   'order'          — سجلات لطلبات محددة
 *   'all'            — كل السجلات (للمدير)
 */
export function useOffChannelCollections({ scope = 'inbox', orderIds = null } = {}) {
  const { user } = useAuth();
  const userId = user?.user_id || user?.id;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId && scope !== 'order' && scope !== 'manager_all' && scope !== 'manager_pending') {
      setRows([]); setLoading(false); return;
    }
    setLoading(true);
    let q = supabase.from('off_channel_collections').select('*').order('created_at', { ascending: false });
    if (scope === 'mine') q = q.eq('collector_user_id', userId).eq('status', 'pending_classification');
    // ✅ inbox للمالك: فقط التحصيلات التي صنّفها البائع وبانتظار تأكيد المالك
    else if (scope === 'inbox') q = q.eq('owner_user_id', userId).eq('status', 'pending_owner_confirmation');
    // ✅ المدير: عدّاد التحصيلات المعلقة عالمياً
    else if (scope === 'manager_pending') q = q.eq('status', 'pending_owner_confirmation');
    // ✅ المدير: كل السجلات (للصفحة)
    else if (scope === 'manager_all') { /* no extra filter */ }
    else if (scope === 'order' && Array.isArray(orderIds) && orderIds.length) q = q.in('order_id', orderIds);
    const { data, error } = await q;
    if (!error) setRows(data || []);
    setLoading(false);
  }, [scope, userId, JSON.stringify(orderIds || [])]);

  useEffect(() => { load(); }, [load]);

  /** تصنيف الموظف للسجل (يدعم upsert عبر order_id إذا لم يوجد id) */
  const classify = useCallback(async (idOrNull, payload, orderCtx = null) => {
    const ownerDue = Number(payload.owner_due_amount) || 0;
    const status = payload.collection_type === 'full_discount'
      ? 'waived'
      : (ownerDue > 0 ? 'pending_owner_confirmation' : 'settled');
    const base = {
      collection_type: payload.collection_type,
      customer_paid_amount: Number(payload.customer_paid_amount) || 0,
      employee_profit_share: Number(payload.employee_profit_share) || 0,
      owner_due_amount: ownerDue,
      note: payload.note || null,
      status,
      classified_at: new Date().toISOString(),
      confirmed_at: status === 'settled' ? new Date().toISOString() : null,
    };
    if (idOrNull) {
      const { error } = await supabase.from('off_channel_collections').update(base).eq('id', idOrNull);
      if (!error) await load();
      return { error };
    }
    // Insert path: نحتاج order_id + collector + owner
    if (!orderCtx?.order_id) return { error: { message: 'order_id مطلوب لإنشاء السجل' } };
    // اشتقاق owner_user_id من مالك المنتج الأعلى قيمة في الطلب
    let owner_user_id = orderCtx.owner_user_id || null;
    if (!owner_user_id) {
      const { data: items } = await supabase
        .from('order_items')
        .select('quantity, unit_price, total_price, products!inner(owner_user_id)')
        .eq('order_id', orderCtx.order_id);
      const groups = {};
      (items || []).forEach(it => {
        const ow = it.products?.owner_user_id; if (!ow) return;
        groups[ow] = (groups[ow] || 0) + (Number(it.quantity) || 1) * (Number(it.unit_price) || Number(it.total_price) || 0);
      });
      owner_user_id = Object.entries(groups).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    }
    const insertRow = {
      ...base,
      order_id: orderCtx.order_id,
      invoice_id: orderCtx.invoice_id || null,
      collector_user_id: orderCtx.collector_user_id || userId,
      owner_user_id,
      delivery_fee_absorbed: Number(orderCtx.delivery_fee_absorbed) || 0,
    };
    const { error } = await supabase.from('off_channel_collections').insert(insertRow);
    if (!error) await load();
    return { error };
  }, [load, userId]);

  /** تأكيد المالك (استلمت / لم يصلني) */
  const confirmReceipt = useCallback(async (id, received = true) => {
    const update = received
      ? { status: 'settled', confirmed_at: new Date().toISOString() }
      : { status: 'pending_owner_confirmation', confirmed_at: null };
    const { error } = await supabase.from('off_channel_collections').update(update).eq('id', id);
    if (!error) await load();
    return { error };
  }, [load]);

  return { rows, loading, reload: load, classify, confirmReceipt };
}

export default useOffChannelCollections;
