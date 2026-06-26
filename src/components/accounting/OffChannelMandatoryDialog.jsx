import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, XCircle, Loader2, Clock, HandCoins, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOffChannelCollections } from '@/hooks/useOffChannelCollections';
import { useToast } from '@/components/ui/use-toast';

const SNOOZE_KEY = 'offChannelInboxSnoozeUntil';
const SNOOZE_MS = 60 * 60 * 1000; // ساعة واحدة

/**
 * نافذة إجبارية للمالك تظهر تلقائياً عند وجود تحصيلات بانتظار التأكيد.
 * لا يمكن إغلاقها بـ Escape أو النقر خارجها — فقط بزرّي:
 *   - تأكيد كل العناصر / تأكيد واحد
 *   - تأجيل لاحقاً (snooze ساعة)
 */
const OffChannelMandatoryDialog = () => {
  const { rows, loading, confirmReceipt, reload } = useOffChannelCollections({ scope: 'inbox' });
  const [ordersMap, setOrdersMap] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [snoozed, setSnoozed] = useState(false);
  const { toast } = useToast();

  // قراءة snooze
  useEffect(() => {
    const until = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    setSnoozed(until > Date.now());
    if (until > Date.now()) {
      const t = setTimeout(() => setSnoozed(false), until - Date.now());
      return () => clearTimeout(t);
    }
  }, []);

  // جلب بيانات الطلبات للعرض
  useEffect(() => {
    const ids = rows.map(r => r.order_id).filter(Boolean);
    if (!ids.length) { setOrdersMap({}); return; }
    supabase.from('orders').select('id, tracking_number, order_number, customer_name')
      .in('id', ids).then(({ data }) => {
        const m = {}; (data || []).forEach(o => m[o.id] = o); setOrdersMap(m);
      });
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
      .update({ status: 'owner_disputed', confirmed_at: null, note: (row.note || '') + ' | لم يصلني (المالك)' })
      .eq('id', row.id);
    setBusyId(null);
    if (error) toast({ variant: 'destructive', title: 'فشل التسجيل', description: error.message });
    else { toast({ title: 'تم تسجيل عدم الاستلام', description: 'سيُراجع الموظف الحالة.' }); reload(); }
  };

  const handleSnooze = () => {
    const until = Date.now() + SNOOZE_MS;
    localStorage.setItem(SNOOZE_KEY, String(until));
    setSnoozed(true);
  };

  const open = !loading && rows.length > 0 && !snoozed;

  return (
    <Dialog open={open} onOpenChange={() => { /* لا يمكن إغلاقها بالنقر خارجاً */ }}>
      <DialogContent
        dir="rtl"
        className="max-w-2xl p-0 overflow-hidden border-0 shadow-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header احترافي بتدرّج */}
        <div className="relative p-6 bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/30 rounded-full -translate-y-20 translate-x-20" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/20 rounded-full translate-y-16 -translate-x-16" />
          </div>
          <div className="relative flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/25 backdrop-blur flex items-center justify-center shadow-lg">
              <HandCoins className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <DialogHeader className="text-right">
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  تحصيلات بانتظار تأكيدك ({rows.length})
                </DialogTitle>
                <DialogDescription className="text-white/90 text-sm mt-1">
                  هذه مبالغ استلمها الموظف من زبائنك خارج شركة التوصيل — أكّد استلامك للمبلغ ليُضاف لقاصتك.
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>
        </div>

        {/* القائمة */}
        <ScrollArea className="max-h-[55vh]">
          <div className="p-4 space-y-3">
            {rows.map(row => {
              const order = ordersMap[row.order_id];
              const amount = Number(row.owner_due_amount) || Number(row.customer_paid_amount) || 0;
              const isBusy = busyId === row.id;
              return (
                <div
                  key={row.id}
                  className="relative p-4 rounded-2xl border-2 border-amber-200 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          #{order?.tracking_number || order?.order_number || row.order_id.slice(0, 8)}
                        </Badge>
                        <Badge className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          {row.status === 'pending_classification' ? 'بانتظار التصنيف' : 'بانتظار تأكيدك'}
                        </Badge>
                      </div>
                      <div className="text-sm font-semibold text-foreground truncate">
                        {order?.customer_name || 'زبون'}
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <div className="text-2xl font-bold bg-gradient-to-br from-emerald-500 to-emerald-700 bg-clip-text text-transparent">
                        {amount.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-muted-foreground">د.ع</div>
                    </div>
                  </div>
                  {row.note && (
                    <div className="text-[11px] text-muted-foreground mb-3 bg-background/50 rounded-md p-2 border">
                      📝 {row.note}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleConfirm(row)}
                      disabled={isBusy}
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold shadow-md"
                    >
                      {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 ms-1" />}
                      استلمت المبلغ
                    </Button>
                    <Button
                      onClick={() => handleReject(row)}
                      disabled={isBusy}
                      variant="outline"
                      className="border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 dark:border-rose-900/50"
                    >
                      <XCircle className="w-4 h-4 ms-1" />
                      لم يصلني
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Footer: زر تأجيل فقط */}
        <div className="p-4 border-t bg-muted/30 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            ستظهر هذه النافذة مجدداً بعد ساعة إن لم تؤكد كل التحصيلات.
          </p>
          <Button variant="ghost" size="sm" onClick={handleSnooze}>
            <Clock className="w-4 h-4 ms-1" />
            تأجيل ساعة
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OffChannelMandatoryDialog;
