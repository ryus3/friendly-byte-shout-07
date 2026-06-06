import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, TrendingUp, Wallet, Users, Package, Crown, Boxes, Truck, FileText, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { computeInvoiceProfits } from '@/lib/invoiceProfitsCalc';
import { startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay } from 'date-fns';

const PERIODS = [
  { id: 'day', label: 'اليوم' },
  { id: 'week', label: 'الأسبوع' },
  { id: 'month', label: 'الشهر' },
  { id: 'year', label: 'السنة' },
  { id: 'all', label: 'كل الفترات' },
  { id: 'custom', label: 'مخصص' },
];

const TABS = [
  { id: 'summary', label: 'الملخص', icon: TrendingUp },
  { id: 'invoices', label: 'الفواتير', icon: FileText },
  { id: 'products', label: 'المنتجات', icon: Boxes },
  { id: 'distribution', label: 'التوزيع', icon: Users },
];

const computeRange = (period) => {
  const now = new Date();
  const to = endOfDay(now);
  let from;
  switch (period) {
    case 'day': from = startOfDay(now); break;
    case 'week': from = startOfWeek(now, { weekStartsOn: 6 }); break;
    case 'month': from = startOfMonth(now); break;
    case 'year': from = startOfYear(now); break;
    case 'all': from = new Date(2000, 0, 1); break;
    default: return null;
  }
  return { from, to };
};

const InvoicesProfitReportDialog = ({ open, onOpenChange, scope = 'self', employeeId = null }) => {
  const { user } = useAuth();
  const { isAdmin, isDepartmentManager } = usePermissions();
  const userId = user?.user_id || user?.id;

  const [period, setPeriod] = useState('month');
  const [dateRange, setDateRange] = useState(() => computeRange('month'));
  const [invoices, setInvoices] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [data, setData] = useState({ orders: [], orderItems: [], profits: [], employeesWithRules: new Set(), namesMap: {} });
  const [computing, setComputing] = useState(false);
  const [supervisedIds, setSupervisedIds] = useState([]);
  const [tabIndex, setTabIndex] = useState(0);
  const tabsContainerRef = useRef(null);

  const handlePeriodChange = (p) => {
    setPeriod(p);
    if (p !== 'custom') setDateRange(computeRange(p));
  };

  useEffect(() => {
    if (!open || !dateRange?.from || !dateRange?.to || !userId) return;
    let cancelled = false;
    (async () => {
      setLoadingInvoices(true);
      try {
        const fromIso = new Date(dateRange.from); fromIso.setHours(0, 0, 0, 0);
        const toIso = new Date(dateRange.to); toIso.setHours(23, 59, 59, 999);
        let q = supabase
          .from('delivery_invoices')
          .select('id, external_id, amount, orders_count, partner, account_username, owner_user_id, created_at, received_at, status')
          .gte('created_at', fromIso.toISOString())
          .lte('created_at', toIso.toISOString())
          .order('received_at', { ascending: false, nullsFirst: false })
          .order('external_id', { ascending: false });
        if (!isAdmin) q = q.eq('owner_user_id', userId);
        const { data: invs } = await q;
        if (cancelled) return;
        setInvoices(invs || []);
        setSelectedIds(new Set((invs || []).map(i => i.id)));

        if (isDepartmentManager && !isAdmin && userId) {
          const { data: sup } = await supabase
            .from('employee_supervisors').select('employee_id')
            .eq('supervisor_id', userId).eq('is_active', true);
          if (!cancelled) setSupervisedIds((sup || []).map(r => r.employee_id));
        }
      } finally {
        if (!cancelled) setLoadingInvoices(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, dateRange?.from, dateRange?.to, userId, isAdmin, isDepartmentManager]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      if (selectedIds.size === 0) {
        setData({ orders: [], orderItems: [], profits: [], employeesWithRules: new Set(), namesMap: {} });
        return;
      }
      setComputing(true);
      try {
        const { data: rpc, error } = await supabase.rpc('get_invoice_profits_report', {
          p_invoice_ids: Array.from(selectedIds),
        });
        if (error) throw error;
        if (cancelled) return;
        setData({
          orders: rpc?.orders || [],
          orderItems: rpc?.orderItems || [],
          profits: rpc?.profits || [],
          employeesWithRules: new Set(rpc?.employeesWithRules || []),
          namesMap: rpc?.namesMap || {},
        });
      } catch (e) {
        console.error('report rpc error', e);
      } finally {
        if (!cancelled) setComputing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, Array.from(selectedIds).sort().join(',')]);

  const calc = useMemo(() => computeInvoiceProfits(data), [data]);
  const fmt = (n) => `${Math.round(Number(n) || 0).toLocaleString()} د.ع`;

  const toggleAll = () => setSelectedIds(selectedIds.size === invoices.length ? new Set() : new Set(invoices.map(i => i.id)));
  const toggleOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const namesMap = data.namesMap;
  const isManager = isDepartmentManager && !isAdmin;
  const ownerEntries = Object.entries(calc.byOwner)
    .filter(([ownerId]) => !isManager || ownerId === userId)
    .map(([ownerId, stats]) => ({ ownerId, name: ownerId === '__system__' ? 'النظام' : (namesMap[ownerId] || 'مالك'), ...stats, netProfit: stats.revenue - stats.cost }))
    .sort((a, b) => b.netProfit - a.netProfit);
  const employeeEntries = Object.entries(calc.employeeCombinedByEmp)
    .filter(([empId, v]) => Number(v) !== 0 && (!isManager || supervisedIds.includes(empId)))
    .map(([empId, amount]) => ({ empId, name: namesMap[empId] || 'موظف', amount, bonus: calc.employeeBonusByEmp[empId] || 0 }));

  const goTab = (i) => setTabIndex(Math.max(0, Math.min(TABS.length - 1, i)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[94vh] overflow-hidden flex flex-col p-0 gap-0" dir="rtl">
        {/* Hero */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-purple-600 to-pink-500 opacity-95" />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 30% 0%, hsl(var(--primary-foreground) / 0.25), transparent 50%), radial-gradient(circle at 80% 100%, hsl(var(--primary-foreground) / 0.15), transparent 50%)' }} />
          <DialogHeader className="relative px-5 pt-5 pb-3">
            <DialogTitle className="flex items-center gap-3 text-white">
              <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-md shadow-xl shadow-black/20">
                <FileText className="w-5 h-5" />
              </motion.div>
              <div className="flex flex-col items-start">
                <span className="font-bold text-lg drop-shadow-md">تقرير الأرباح</span>
                <span className="text-[11px] font-normal text-white/85 mt-0.5">فواتيرك وحساباتك فقط</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Quick period filter */}
          <div className="relative px-4 pb-3 flex gap-1.5 overflow-x-auto no-scrollbar">
            {PERIODS.map(p => (
              <button key={p.id} onClick={() => handlePeriodChange(p.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${period === p.id ? 'bg-white text-primary shadow-lg scale-105' : 'bg-white/15 text-white hover:bg-white/25'}`}>
                {p.label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="relative px-4 pb-3">
              <DateRangePicker date={dateRange} onDateChange={setDateRange} />
            </div>
          )}
        </div>

        {/* Tabs header */}
        <div className="flex items-center justify-between px-3 pt-2 pb-1 border-b bg-background sticky top-0 z-10">
          <button onClick={() => goTab(tabIndex - 1)} disabled={tabIndex === 0} className="p-1 rounded-md hover:bg-muted disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="flex-1 flex justify-around">
            {TABS.map((t, i) => {
              const Icon = t.icon;
              const active = i === tabIndex;
              return (
                <button key={t.id} onClick={() => goTab(i)} className="relative px-2 py-1.5 flex flex-col items-center gap-0.5">
                  <Icon className={`w-4 h-4 transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-[10px] font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}>{t.label}</span>
                  {active && <motion.div layoutId="tab-underline" className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full" />}
                </button>
              );
            })}
          </div>
          <button onClick={() => goTab(tabIndex + 1)} disabled={tabIndex === TABS.length - 1} className="p-1 rounded-md hover:bg-muted disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Swipeable content */}
        <div className="flex-1 overflow-hidden relative" ref={tabsContainerRef}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tabIndex}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 overflow-y-auto px-4 py-4"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.x < -50) goTab(tabIndex + 1);
                else if (info.offset.x > 50) goTab(tabIndex - 1);
              }}
            >
              {tabIndex === 0 && (
                <div className="space-y-3">
                  {computing ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <Stat icon={TrendingUp} label="إجمالي الإيراد" sub="بدون توصيل" value={fmt(calc.totalRevenue)} color="blue" />
                        <Stat icon={Package} label="إجمالي التكلفة" value={fmt(calc.totalCost)} color="orange" />
                        <Stat icon={Boxes} label="عدد القطع" sub={`${calc.productCount} منتج`} value={`${calc.totalQty}`} color="purple" />
                        <Stat icon={Wallet} label="صافي الربح" value={fmt(calc.totalProfit)} color="emerald" highlight />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <Stat icon={Users} label="مستحقات الموظفين" value={fmt(calc.employeeTotalCombined)} color="purple" />
                        <Stat icon={Crown} label="صافي للمالكين" value={fmt(calc.netForOwners)} color="emerald" />
                      </div>
                      {Math.abs(calc.totalDelta) > 1 && (
                        <div className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed text-xs ${calc.totalDelta > 0 ? 'text-emerald-600 bg-emerald-500/5 border-emerald-500/30' : 'text-orange-600 bg-orange-500/5 border-orange-500/30'}`}>
                          <TrendingUp className="w-4 h-4" />
                          <span>إجمالي {calc.totalDelta > 0 ? 'الزيادة' : 'الخصم'}: {fmt(Math.abs(calc.totalDelta))} {calc.employeeBonusTotal !== 0 ? `(منها ${fmt(calc.employeeBonusTotal)} للموظفين)` : '(للمالكين)'}</span>
                        </div>
                      )}
                      {calc.totalDelivery > 0 && (
                        <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-muted/30 border border-dashed text-xs text-muted-foreground">
                          <Truck className="w-4 h-4" />
                          <span>أجور التوصيل {fmt(calc.totalDelivery)} مستثناة</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {tabIndex === 1 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-muted-foreground">{selectedIds.size}/{invoices.length} محدّد</span>
                    <Button variant="outline" size="sm" onClick={toggleAll} disabled={!invoices.length} className="h-7 text-xs">
                      {selectedIds.size === invoices.length ? 'إلغاء الكل' : 'تحديد الكل'}
                    </Button>
                  </div>
                  {loadingInvoices ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
                  ) : invoices.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8 text-sm">لا توجد فواتير في هذه الفترة</p>
                  ) : (
                    <div className="space-y-1.5">
                      {invoices.map(inv => {
                        const selected = selectedIds.has(inv.id);
                        return (
                          <label key={inv.id} className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer text-sm transition-all border ${selected ? 'bg-primary/10 border-primary/40' : 'bg-card hover:bg-muted/40 border-border'}`}>
                            <Checkbox checked={selected} onCheckedChange={() => toggleOne(inv.id)} />
                            <span className="font-mono text-xs font-bold">#{inv.external_id}</span>
                            <Badge variant="outline" className="text-[10px]">{inv.partner}</Badge>
                            {inv.account_username && (
                              <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30">{inv.account_username}</Badge>
                            )}
                            <span className="text-muted-foreground text-[11px]">{inv.orders_count} طلب</span>
                            <span className="mr-auto font-bold text-emerald-600 text-xs">{fmt(inv.amount)}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {tabIndex === 2 && (
                calc.productsList.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">لا توجد بيانات منتجات</p>
                ) : (
                  <div className="space-y-1.5">
                    {calc.productsList.map((p, idx) => (
                      <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 gap-2 text-sm border border-border/50">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {idx === 0 && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                          <Package className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="font-medium truncate">{p.name}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">×{p.qty}</Badge>
                        </div>
                        <div className="text-left shrink-0">
                          <div className="font-bold text-blue-600 text-xs">{fmt(p.revenue)}</div>
                          <div className="text-[10px] text-emerald-600">ربح {fmt(p.revenue - p.cost)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {tabIndex === 3 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold mb-2 flex items-center gap-2"><Crown className="w-4 h-4 text-amber-500" /> المالكون</h4>
                    {ownerEntries.length === 0 ? <p className="text-xs text-muted-foreground text-center py-3">لا توجد بيانات</p> : (
                      <div className="space-y-1.5">
                        {ownerEntries.map(o => (
                          <div key={o.ownerId} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-sm border border-border/50">
                            <div className="flex items-center gap-2">
                              <Crown className="w-3.5 h-3.5 text-amber-500" />
                              <span className="font-medium">{o.name}</span>
                              <Badge variant="outline" className="text-[10px]">{o.items} قطعة</Badge>
                            </div>
                            <div className="text-left">
                              <div className="font-bold text-emerald-600 text-xs">{fmt(o.netProfit)}</div>
                              <div className="text-[10px] text-muted-foreground">إيراد {fmt(o.revenue)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold mb-2 flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> الموظفون</h4>
                    {employeeEntries.length === 0 ? <p className="text-xs text-muted-foreground text-center py-3">لا توجد مستحقات</p> : (
                      <div className="space-y-1.5">
                        {employeeEntries.map(e => (
                          <div key={e.empId} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-sm border border-border/50">
                            <div className="flex flex-col">
                              <span className="font-medium">{e.name}</span>
                              {e.bonus !== 0 && <span className="text-[10px] text-amber-600">+ {fmt(e.bonus)} زيادة/خصم</span>}
                            </div>
                            <Badge variant="secondary" className="text-emerald-600 bg-emerald-500/10 font-bold">{fmt(e.amount)}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Stat = ({ icon: Icon, label, sub, value, color = 'blue', highlight = false }) => {
  const map = {
    blue: 'from-blue-500/15 to-blue-500/5 border-blue-500/30 text-blue-600',
    orange: 'from-orange-500/15 to-orange-500/5 border-orange-500/30 text-orange-600',
    emerald: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/30 text-emerald-600',
    purple: 'from-purple-500/15 to-purple-500/5 border-purple-500/30 text-purple-600',
  };
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={`bg-gradient-to-br ${map[color]} backdrop-blur-sm ${highlight ? 'ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/10' : ''}`}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Icon className="w-4 h-4" />
            <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
          </div>
          <div className="text-lg font-bold">{value}</div>
          {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default InvoicesProfitReportDialog;
