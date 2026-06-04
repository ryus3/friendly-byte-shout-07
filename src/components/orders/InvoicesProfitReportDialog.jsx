import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Loader2, TrendingUp, Wallet, Users, Package, Crown, Boxes, Truck, FileText } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { computeInvoiceProfits, fetchInvoiceProfitsData } from '@/lib/invoiceProfitsCalc';

/**
 * تقرير أرباح مجموعة فواتير حسب فترة زمنية أو اختيار يدوي.
 * يعرض إجمالي الإيراد/التكلفة/الربح + توزيع المالكين والموظفين + أعلى المنتجات.
 */
const InvoicesProfitReportDialog = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const { isAdmin, isDepartmentManager } = usePermissions();
  const userId = user?.user_id || user?.id;

  const [dateRange, setDateRange] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from, to };
  });
  const [invoices, setInvoices] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [data, setData] = useState({ orders: [], orderItems: [], profits: [], employeesWithRules: new Set(), namesMap: {} });
  const [computing, setComputing] = useState(false);
  const [supervisedIds, setSupervisedIds] = useState([]);

  // جلب الفواتير ضمن الفترة — مقيدة بحسابات المستخدم الحالي فقط (حتى للمدير)
  useEffect(() => {
    if (!open || !dateRange?.from || !dateRange?.to || !userId) return;
    let cancelled = false;
    (async () => {
      setLoadingInvoices(true);
      try {
        const fromIso = new Date(dateRange.from); fromIso.setHours(0, 0, 0, 0);
        const toIso = new Date(dateRange.to); toIso.setHours(23, 59, 59, 999);
        const { data: invs } = await supabase
          .from('delivery_invoices')
          .select('id, external_id, amount, orders_count, partner, account_username, owner_user_id, created_at, received_at, status')
          .eq('owner_user_id', userId)
          .gte('created_at', fromIso.toISOString())
          .lte('created_at', toIso.toISOString())
          .order('received_at', { ascending: false, nullsFirst: false })
          .order('external_id', { ascending: false });
        if (cancelled) return;
        setInvoices(invs || []);
        setSelectedIds(new Set((invs || []).map(i => i.id))); // تحديد الكل افتراضياً

        if (isDepartmentManager && !isAdmin && userId) {
          const { data: sup } = await supabase
            .from('employee_supervisors')
            .select('employee_id')
            .eq('supervisor_id', userId)
            .eq('is_active', true);
          if (!cancelled) setSupervisedIds((sup || []).map(r => r.employee_id));
        }
      } catch (e) {
        console.error('load invoices error', e);
      } finally {
        if (!cancelled) setLoadingInvoices(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, dateRange?.from, dateRange?.to, userId, isAdmin, isDepartmentManager]);

  // جلب الطلبات المرتبطة بالفواتير المختارة وحساب الأرباح
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
        const { data: dio } = await supabase
          .from('delivery_invoice_orders')
          .select('order_id')
          .in('invoice_id', Array.from(selectedIds))
          .not('order_id', 'is', null);
        const orderIds = Array.from(new Set((dio || []).map(r => r.order_id)));
        const fetched = await fetchInvoiceProfitsData(supabase, orderIds);
        if (!cancelled) setData(fetched);
      } catch (e) {
        console.error('compute report error', e);
      } finally {
        if (!cancelled) setComputing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, Array.from(selectedIds).sort().join(','), invoices.length]);

  const calc = useMemo(() => computeInvoiceProfits(data), [data]);
  const fmt = (n) => `${Math.round(Number(n) || 0).toLocaleString()} د.ع`;

  const toggleAll = () => {
    setSelectedIds(selectedIds.size === invoices.length ? new Set() : new Set(invoices.map(i => i.id)));
  };
  const toggleOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const namesMap = data.namesMap;
  const isManager = isDepartmentManager && !isAdmin;

  const ownerEntries = Object.entries(calc.byOwner)
    .filter(([ownerId]) => !isManager || ownerId === userId)
    .map(([ownerId, stats]) => ({
      ownerId,
      name: ownerId === '__system__' ? 'النظام (المدير العام)' : (namesMap[ownerId] || 'مالك'),
      ...stats,
      netProfit: stats.revenue - stats.cost,
    })).sort((a, b) => b.netProfit - a.netProfit);

  const employeeEntries = Object.entries(calc.employeeCombinedByEmp)
    .filter(([empId, v]) => Number(v) !== 0 && (!isManager || supervisedIds.includes(empId)))
    .map(([empId, amount]) => ({ empId, name: namesMap[empId] || 'موظف', amount, bonus: calc.employeeBonusByEmp[empId] || 0 }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0" dir="rtl">
        <div className="relative overflow-hidden rounded-t-lg" style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.15) 0%, hsl(var(--accent, var(--primary)) / 0.1) 100%)' }}>
          <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 20% 0%, hsl(var(--primary) / 0.4), transparent 50%), radial-gradient(circle at 80% 100%, hsl(var(--accent, var(--primary)) / 0.3), transparent 50%)' }} />
          <DialogHeader className="relative p-5 pb-4">
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-lg shadow-primary/30">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex flex-col items-start">
                <span className="font-bold bg-gradient-to-r from-primary to-foreground bg-clip-text text-transparent">تقرير أرباحي من الفواتير</span>
                <span className="text-xs font-normal text-muted-foreground mt-0.5">حسابات شركة التوصيل الخاصة بك فقط</span>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>
        <div className="px-5 pt-3 pb-5 flex flex-col overflow-hidden flex-1">

        <div className="flex flex-col md:flex-row gap-3 items-start">
          <DateRangePicker date={dateRange} onDateChange={setDateRange} />
          <Button variant="outline" size="sm" onClick={toggleAll} disabled={!invoices.length}>
            {selectedIds.size === invoices.length ? 'إلغاء التحديد' : 'تحديد الكل'} ({selectedIds.size}/{invoices.length})
          </Button>
        </div>

        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-4 mt-3">
            {/* قائمة الفواتير */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">الفواتير ضمن الفترة</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingInvoices ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
                ) : invoices.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4 text-sm">لا توجد فواتير في هذه الفترة</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {invoices.map(inv => (
                      <label key={inv.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/40 cursor-pointer text-sm">
                        <Checkbox checked={selectedIds.has(inv.id)} onCheckedChange={() => toggleOne(inv.id)} />
                        <span className="font-mono text-xs">#{inv.external_id}</span>
                        <Badge variant="outline" className="text-[10px]">{inv.partner}</Badge>
                        {inv.account_username && (
                          <Badge className="text-[10px] bg-primary/10 text-primary border-primary/30">{inv.account_username}</Badge>
                        )}
                        <span className="text-muted-foreground text-xs">{inv.orders_count} طلب</span>
                        <span className="mr-auto font-medium">{fmt(inv.amount)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* الإحصائيات */}
            {computing ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : selectedIds.size > 0 && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Stat icon={TrendingUp} label="إجمالي الإيراد" sub="بدون توصيل" value={fmt(calc.totalRevenue)} color="blue" />
                  <Stat icon={Package} label="إجمالي التكلفة" value={fmt(calc.totalCost)} color="orange" />
                  <Stat icon={Boxes} label="عدد القطع" sub={`${calc.productCount} منتج`} value={`${calc.totalQty}`} color="purple" />
                  <Stat icon={Wallet} label="صافي الربح" value={fmt(calc.totalProfit)} color="emerald" highlight />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Stat icon={Users} label="مستحقات الموظفين" value={fmt(calc.employeeTotalCombined)} color="purple" />
                  <Stat icon={Crown} label="صافي للمالكين" value={fmt(calc.netForOwners)} color="emerald" />
                </div>

                {/* أعلى المنتجات */}
                {calc.productsList.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Boxes className="w-4 h-4 text-primary" /> أعلى المنتجات في الفترة
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1.5 max-h-72 overflow-y-auto">
                        {calc.productsList.slice(0, 30).map(p => (
                          <div key={p.id} className="flex items-center justify-between p-2 rounded bg-muted/40 gap-2 text-sm">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Package className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span className="font-medium truncate">{p.name}</span>
                              <Badge variant="outline" className="text-[10px] shrink-0">×{p.qty}</Badge>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-bold text-blue-600 text-xs">{fmt(p.revenue)}</div>
                              <div className="text-[10px] text-muted-foreground">ربح {fmt(p.revenue - p.cost)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* المالكين */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Crown className="w-4 h-4 text-amber-500" /> توزيع الأرباح على المالكين
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {ownerEntries.length === 0 ? (
                      <p className="text-center text-muted-foreground py-3 text-sm">لا توجد بيانات</p>
                    ) : (
                      <div className="space-y-1.5">
                        {ownerEntries.map(o => (
                          <div key={o.ownerId} className="flex items-center justify-between p-2 rounded bg-muted/40 text-sm">
                            <div className="flex items-center gap-2">
                              <Crown className="w-3.5 h-3.5 text-amber-500" />
                              <span className="font-medium">{o.name}</span>
                              <Badge variant="outline" className="text-[10px]">{o.items} قطعة</Badge>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-emerald-600 text-xs">{fmt(o.netProfit)}</div>
                              <div className="text-[10px] text-muted-foreground">إيراد {fmt(o.revenue)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* الموظفين */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" /> مستحقات الموظفين
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {employeeEntries.length === 0 ? (
                      <p className="text-center text-muted-foreground py-3 text-sm">لا توجد مستحقات</p>
                    ) : (
                      <div className="space-y-1.5">
                        {employeeEntries.map(e => (
                          <div key={e.empId} className="flex items-center justify-between p-2 rounded bg-muted/40 text-sm">
                            <div className="flex flex-col">
                              <span className="font-medium">{e.name}</span>
                              {e.bonus !== 0 && <span className="text-[10px] text-amber-600">+ {fmt(e.bonus)} زيادة/خصم</span>}
                            </div>
                            <Badge variant="secondary" className="text-emerald-600 bg-emerald-500/10">{fmt(e.amount)}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {Math.abs(calc.totalDelta) > 1 && (
                  <div className={`flex items-center justify-center gap-2 p-2 rounded border border-dashed text-xs ${calc.totalDelta > 0 ? 'text-emerald-600 bg-emerald-500/5' : 'text-orange-600 bg-orange-500/5'}`}>
                    <TrendingUp className="w-4 h-4" />
                    <span>إجمالي {calc.totalDelta > 0 ? 'الزيادة' : 'الخصم'}: {fmt(Math.abs(calc.totalDelta))} {calc.employeeBonusTotal !== 0 ? `(منها ${fmt(calc.employeeBonusTotal)} للموظفين)` : '(كاملاً للمالكين)'}</span>
                  </div>
                )}

                {calc.totalDelivery > 0 && (
                  <div className="flex items-center justify-center gap-2 p-2 rounded bg-muted/30 border border-dashed text-xs text-muted-foreground">
                    <Truck className="w-4 h-4" />
                    <span>أجور التوصيل {fmt(calc.totalDelivery)} مستثناة</span>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Stat = ({ icon: Icon, label, sub, value, color = 'blue', highlight = false }) => {
  const map = {
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/30 text-blue-600',
    orange: 'from-orange-500/10 to-orange-500/5 border-orange-500/30 text-orange-600',
    emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/30 text-emerald-600',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/30 text-purple-600',
  };
  return (
    <Card className={`bg-gradient-to-br ${map[color]} ${highlight ? 'ring-2 ring-emerald-500/40' : ''}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <div className="text-lg font-bold">{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
};

export default InvoicesProfitReportDialog;
