import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, XCircle, Inbox, Loader2, Search, HandCoins, Crown, ShieldCheck, AlertTriangle, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOffChannelCollections } from '@/hooks/useOffChannelCollections';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/components/ui/use-toast';

/**
 * صفحة تحصيلات بانتظار التأكيد — احترافية للمالك والمدير.
 *  - المالك: يرى تحصيلاته فقط (scope=inbox).
 *  - المدير العام: يرى الكل (scope=all) ويستطيع التأكيد نيابة عن المالك.
 */
const OffChannelOwnerInbox = () => {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const userId = user?.user_id || user?.id;
  const scope = isAdmin ? 'manager_all' : 'inbox';

  const { rows, loading, confirmReceipt, reload } = useOffChannelCollections({ scope });

  const [ordersMap, setOrdersMap] = useState({});
  const [usersMap, setUsersMap] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState('pending'); // pending | settled | disputed | all
  const [query, setQuery] = useState('');
  const { toast } = useToast();

  // Real-time updates
  useEffect(() => {
    const channel = supabase.channel('off_channel_collections_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'off_channel_collections' }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [reload]);

  // جلب بيانات الطلبات والمستخدمين
  useEffect(() => {
    const ids = rows.map(r => r.order_id).filter(Boolean);
    const uids = Array.from(new Set([
      ...rows.map(r => r.collector_user_id),
      ...rows.map(r => r.owner_user_id),
    ].filter(Boolean)));
    if (ids.length) {
      supabase.from('orders').select('id, tracking_number, order_number, customer_name')
        .in('id', ids).then(({ data }) => {
          const m = {}; (data || []).forEach(o => m[o.id] = o); setOrdersMap(m);
        });
    } else setOrdersMap({});
    if (uids.length) {
      supabase.from('profiles').select('user_id, full_name')
        .in('user_id', uids).then(({ data }) => {
          const m = {}; (data || []).forEach(p => m[p.user_id] = p.full_name); setUsersMap(m);
        });
    } else setUsersMap({});
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      // فلتر الحالة
      if (filter === 'pending' && !['pending_classification', 'pending_owner_confirmation'].includes(r.status)) return false;
      if (filter === 'settled' && r.status !== 'settled') return false;
      if (filter === 'disputed' && r.status !== 'owner_disputed') return false;
      // فلتر البحث
      if (q) {
        const order = ordersMap[r.order_id];
        const haystack = [
          order?.tracking_number, order?.order_number, order?.customer_name,
          usersMap[r.collector_user_id], usersMap[r.owner_user_id], r.note,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filter, query, ordersMap, usersMap]);

  // إحصاءات سريعة
  const stats = useMemo(() => {
    const pending = rows.filter(r => ['pending_classification', 'pending_owner_confirmation'].includes(r.status));
    const settled = rows.filter(r => r.status === 'settled');
    const disputed = rows.filter(r => r.status === 'owner_disputed');
    const totalPending = pending.reduce((s, r) => s + (Number(r.owner_due_amount) || Number(r.customer_paid_amount) || 0), 0);
    return { pendingCount: pending.length, settledCount: settled.length, disputedCount: disputed.length, totalPending };
  }, [rows]);

  const handleConfirm = async (row) => {
    setBusyId(row.id);
    const { error } = await confirmReceipt(row.id, true);
    setBusyId(null);
    if (error) toast({ variant: 'destructive', title: 'فشل التأكيد', description: error.message });
    else toast({ title: 'تم التأكيد ✅', description: 'تمت إضافة المبلغ للقاصة.' });
  };

  const handleReject = async (row) => {
    setBusyId(row.id);
    const { error } = await supabase
      .from('off_channel_collections')
      .update({ status: 'owner_disputed', confirmed_at: null, note: (row.note || '') + ' | لم يصلني' })
      .eq('id', row.id);
    setBusyId(null);
    if (error) toast({ variant: 'destructive', title: 'فشل التسجيل', description: error.message });
    else { toast({ title: 'تم تسجيل عدم الاستلام', description: 'سيُراجع الموظف الحالة.' }); reload(); }
  };

  const fmt = (n) => `${Math.round(Number(n) || 0).toLocaleString()} د.ع`;

  return (
    <div className="space-y-5 p-1" dir="rtl">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-6 text-white shadow-xl">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/30 rounded-full" />
          <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-white/20 rounded-full" />
        </div>
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/25 backdrop-blur flex items-center justify-center shadow-lg">
              <HandCoins className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                تحصيلات بانتظار التأكيد
                {isAdmin && <Crown className="w-5 h-5 text-yellow-200" />}
              </h1>
              <p className="text-white/90 text-sm mt-1">
                {isAdmin ? 'إدارة وتأكيد كل تحصيلات الملاك' : 'أكّد استلام مبالغك من تحصيلات الموظفين'}
              </p>
            </div>
          </div>
          <div className="text-left bg-white/15 backdrop-blur rounded-2xl px-4 py-2 shadow-lg">
            <div className="text-xs text-white/80">إجمالي المعلق</div>
            <div className="text-2xl font-bold">{fmt(stats.totalPending)}</div>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatMini label="بانتظار التأكيد" value={stats.pendingCount} icon={AlertTriangle} from="from-amber-500" to="to-orange-600" />
        <StatMini label="مؤكدة" value={stats.settledCount} icon={CheckCircle2} from="from-emerald-500" to="to-emerald-700" />
        <StatMini label="غير مستلمة" value={stats.disputedCount} icon={XCircle} from="from-rose-500" to="to-rose-700" />
      </div>

      {/* Filters + Search */}
      <Card className="border-2">
        <CardContent className="p-3 flex flex-wrap items-center gap-3">
          <Tabs value={filter} onValueChange={setFilter} className="flex-1 min-w-[260px]">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="pending">معلق ({stats.pendingCount})</TabsTrigger>
              <TabsTrigger value="settled">مؤكد ({stats.settledCount})</TabsTrigger>
              <TabsTrigger value="disputed">غير مستلم ({stats.disputedCount})</TabsTrigger>
              <TabsTrigger value="all">الكل ({rows.length})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث برقم الطلب، الزبون، الموظف…" className="pr-9" />
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 rounded-2xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : filteredRows.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="p-12 text-center space-y-3">
            <Sparkles className="w-12 h-12 mx-auto text-muted-foreground/50" />
            <p className="text-lg font-bold">لا توجد تحصيلات تطابق المرشّحات</p>
            <p className="text-sm text-muted-foreground">جرّب تغيير المرشّحات أو البحث.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredRows.map(row => {
            const order = ordersMap[row.order_id];
            const collector = usersMap[row.collector_user_id] || '—';
            const owner = usersMap[row.owner_user_id] || '—';
            const amount = Number(row.owner_due_amount) || Number(row.customer_paid_amount) || 0;
            const isPending = ['pending_classification', 'pending_owner_confirmation'].includes(row.status);
            const isSettled = row.status === 'settled';
            const isDisputed = row.status === 'owner_disputed';
            const isBusy = busyId === row.id;
            const canConfirm = isPending && (isAdmin || row.owner_user_id === userId);

            return (
              <Card key={row.id} className={`relative overflow-hidden border-2 transition-all hover:shadow-lg ${
                isPending ? 'border-amber-300 bg-gradient-to-br from-amber-50/60 to-orange-50/40 dark:from-amber-950/15 dark:to-orange-950/10' :
                isSettled ? 'border-emerald-300 bg-gradient-to-br from-emerald-50/60 to-emerald-50/30 dark:from-emerald-950/15 dark:to-emerald-950/5' :
                'border-rose-300 bg-gradient-to-br from-rose-50/60 to-rose-50/30 dark:from-rose-950/15 dark:to-rose-950/5'
              }`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          #{order?.tracking_number || order?.order_number || row.order_id.slice(0, 8)}
                        </Badge>
                        <StatusBadge status={row.status} />
                      </div>
                      <div className="text-sm font-bold truncate">{order?.customer_name || 'زبون'}</div>
                      <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                        <span>الموظف: <b>{collector}</b></span>
                        {isAdmin && <span>• المالك: <b>{owner}</b></span>}
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <div className="text-xl font-bold bg-gradient-to-br from-emerald-600 to-emerald-700 bg-clip-text text-transparent">
                        {amount.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-muted-foreground">د.ع</div>
                    </div>
                  </div>
                  {row.note && (
                    <div className="text-[11px] text-muted-foreground bg-background/60 rounded-md p-2 border border-dashed">
                      📝 {row.note}
                    </div>
                  )}
                  {canConfirm && (
                    <div className="flex gap-2 pt-1">
                      <Button onClick={() => handleConfirm(row)} disabled={isBusy} size="sm"
                        className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold">
                        {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 ms-1" />}
                        {isAdmin && row.owner_user_id !== userId ? 'تأكيد كمدير' : 'استلمت'}
                      </Button>
                      <Button onClick={() => handleReject(row)} disabled={isBusy} size="sm" variant="outline"
                        className="border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">
                        <XCircle className="w-3 h-3 ms-1" />
                        لم يصلني
                      </Button>
                    </div>
                  )}
                  {isSettled && (
                    <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      تم التأكيد {row.confirmed_at ? `• ${new Date(row.confirmed_at).toLocaleDateString('ar-IQ')}` : ''}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

const StatMini = ({ label, value, icon: Icon, from, to }) => (
  <Card className="overflow-hidden border-2">
    <CardContent className="p-3 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${from} ${to} flex items-center justify-center text-white shadow`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold">{value}</div>
      </div>
    </CardContent>
  </Card>
);

const StatusBadge = ({ status }) => {
  const map = {
    pending_classification: { label: 'بانتظار التصنيف', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
    pending_owner_confirmation: { label: 'بانتظار تأكيدك', cls: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30' },
    settled: { label: 'مؤكد', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
    owner_disputed: { label: 'لم يصل', cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30' },
    waived: { label: 'بدون مقابل', cls: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30' },
  };
  const v = map[status] || { label: status, cls: 'bg-muted text-muted-foreground' };
  return <Badge className={`text-[10px] border ${v.cls}`}>{v.label}</Badge>;
};

export default OffChannelOwnerInbox;
