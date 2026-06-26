import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, Inbox, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOffChannelCollections } from '@/hooks/useOffChannelCollections';
import { useToast } from '@/components/ui/use-toast';

/**
 * صندوق "تحصيلات بانتظار تأكيدي" للمالك.
 * - يعرض كل سجل بحالة pending_owner_confirmation حيث owner = me.
 * - زرّان: استلمت / لم يصلني.
 * - عند "استلمت" يُسجَّل cash_movement تلقائياً وتُقفل الحالة → settled.
 */
const OffChannelOwnerInbox = () => {
  const { rows, loading, confirmReceipt, reload } = useOffChannelCollections({ scope: 'inbox' });
  const [ordersMap, setOrdersMap] = useState({});
  const [usersMap, setUsersMap] = useState({});
  const [busyId, setBusyId] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    const ids = rows.map(r => r.order_id).filter(Boolean);
    const uids = Array.from(new Set(rows.map(r => r.collector_user_id).filter(Boolean)));
    if (ids.length) {
      supabase.from('orders').select('id, tracking_number, order_number, customer_name')
        .in('id', ids).then(({ data }) => {
          const m = {}; (data || []).forEach(o => m[o.id] = o); setOrdersMap(m);
        });
    }
    if (uids.length) {
      supabase.from('profiles').select('user_id, full_name')
        .in('user_id', uids).then(({ data }) => {
          const m = {}; (data || []).forEach(p => m[p.user_id] = p.full_name); setUsersMap(m);
        });
    }
  }, [rows]);

  const handleConfirm = async (row) => {
    setBusyId(row.id);
    const { error } = await confirmReceipt(row.id, true);
    setBusyId(null);
    if (error) toast({ variant: 'destructive', title: 'فشل التأكيد', description: error.message });
    else toast({ title: 'تم التأكيد', description: 'تمت إضافة المبلغ للقاصة.' });
  };

  const handleReject = async (row) => {
    setBusyId(row.id);
    const { error } = await supabase
      .from('off_channel_collections')
      .update({ status: 'owner_disputed', confirmed_at: null, note: (row.note || '') + ' | لم يصلني (المالك)' })
      .eq('id', row.id);
    setBusyId(null);
    if (error) toast({ variant: 'destructive', title: 'فشل التسجيل', description: error.message });
    else { toast({ title: 'تم تسجيل عدم الاستلام', description: 'سيُراجع الموظف الحالة.' }); reload(); }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-right">
          <Inbox className="w-5 h-5 text-primary" />
          تحصيلات بانتظار تأكيدي ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">لا توجد تحصيلات بانتظار تأكيدك حالياً.</p>
        )}
        {rows.map(row => {
          const order = ordersMap[row.order_id];
          const empName = usersMap[row.collector_user_id] || 'موظف';
          const amount = Number(row.owner_due_amount) || Number(row.customer_paid_amount) || 0;
          return (
            <div key={row.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/20">
              <div className="flex-1 min-w-0 text-right">
                <div className="font-bold text-sm">#{order?.tracking_number || order?.order_number || row.order_id.slice(0,8)}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {order?.customer_name || '—'} • الموظف: {empName}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {row.collection_type && <Badge variant="outline" className="text-[10px]">{row.collection_type}</Badge>}
                  <Badge variant="secondary" className="text-[10px]">{row.status}</Badge>
                  <span className="text-sm font-bold text-emerald-600">{amount.toLocaleString()} د.ع</span>
                </div>
                {row.note && <div className="text-[10px] text-muted-foreground mt-1">{row.note}</div>}
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <Button size="sm" onClick={() => handleConfirm(row)} disabled={busyId === row.id}>
                  {busyId === row.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 ms-1" />}
                  استلمت
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleReject(row)} disabled={busyId === row.id}>
                  <Clock className="w-3 h-3 ms-1" /> لم يصلني
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default OffChannelOwnerInbox;
