import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, Wallet, Users, Package, Crown, ShieldCheck, Info, Truck, Boxes, ArrowDownUp, Banknote } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { computeInvoiceProfits, fetchInvoiceProfitsData } from '@/lib/invoiceProfitsCalc';

/**
 * تبويب أرباح الفاتورة - منطق دقيق:
 * - الإيراد = orders.final_amount - delivery_fee (سعر شركة التوصيل الفعلي).
 * - الزيادة/الخصم لكل طلب توزَّع تلقائياً:
 *   • للموظف منشئ الطلب إذا له قاعدة ربح فعّالة.
 *   • وإلا تُضاف لمالكي المنتجات بنسبة حصتهم.
 * - التكلفة تأخذ products.cost_price أولاً (الأحدث) ثم product_variants.cost_price.
 * - أجور التوصيل مستثناة دائماً.
 */
const InvoiceProfitsTab = ({ invoice, linkedOrders = [] }) => {
  const { user } = useAuth();
  const { isAdmin, isDepartmentManager } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ orders: [], orderItems: [], profits: [], employeesWithRules: new Set(), namesMap: {} });
  const [supervisedIds, setSupervisedIds] = useState([]);

  const userId = user?.user_id || user?.id;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // الإستراتيجية الجديدة: استخدم RPC الآمن دائماً عندما توجد فاتورة
      const invoiceDbId = invoice?.id && typeof invoice.id === 'string' && invoice.id.includes('-') ? invoice.id : null;
      // نحاول أولاً جلب معرف الفاتورة من DB إذا لم يكن متاحاً
      let dbInvoiceId = invoiceDbId;
      if (!dbInvoiceId) {
        const externalId = invoice?.external_id || invoice?.id;
        if (externalId) {
          try {
            const { data: invRow } = await supabase
              .from('delivery_invoices').select('id')
              .eq('external_id', String(externalId)).maybeSingle();
            dbInvoiceId = invRow?.id || null;
          } catch { dbInvoiceId = null; }
        }
      }

      if (!dbInvoiceId) {
        if (!cancelled) { setLoading(false); setData({ orders: [], orderItems: [], profits: [], employeesWithRules: new Set(), namesMap: {} }); }
        return;
      }

      setLoading(true);
      try {
        const { data: rpc, error } = await supabase.rpc('get_invoice_profits_report', { p_invoice_ids: [dbInvoiceId] });
        if (error) throw error;
        let supIds = [];
        if (isDepartmentManager && !isAdmin && userId) {
          const { data: sup } = await supabase
            .from('employee_supervisors').select('employee_id')
            .eq('supervisor_id', userId).eq('is_active', true);
          supIds = (sup || []).map(r => r.employee_id);
        }
        if (cancelled) return;
        setData({
          orders: rpc?.orders || [],
          orderItems: rpc?.orderItems || [],
          profits: rpc?.profits || [],
          employeesWithRules: new Set(rpc?.employeesWithRules || []),
          namesMap: rpc?.namesMap || {},
        });
        setSupervisedIds(supIds);
      } catch (e) {
        console.error('InvoiceProfitsTab load error', e);
        if (!cancelled) setData({ orders: [], orderItems: [], profits: [], employeesWithRules: new Set(), namesMap: {} });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [invoice?.id, invoice?.external_id, userId, isAdmin, isDepartmentManager]);

  const calc = useMemo(() => computeInvoiceProfits(data), [data]);
  const namesMap = data.namesMap;
  const isInvoiceProductOwner = Boolean(calc.byOwner?.[userId]?.items > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if ((data.orders || []).length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground" dir="rtl">
        لا توجد طلبات مرتبطة بهذه الفاتورة بعد
      </div>
    );
  }

  if (!calc.itemsAvailable && calc.employeeTotalCombined === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground space-y-2" dir="rtl">
        <Info className="w-6 h-6 mx-auto text-muted-foreground" />
        <div>لم يتم تسجيل أرباح لهذه الفاتورة بعد</div>
      </div>
    );
  }

  const fmt = (n) => `${Math.round(Number(n) || 0).toLocaleString()} د.ع`;

  // === الموظف / أي مستخدم لا يملك منتجات في هذه الفاتورة ===
  if (!isAdmin && !isInvoiceProductOwner) {
    const myProfit = calc.employeeCombinedByEmp[userId] || 0;
    const myBonus = calc.employeeBonusByEmp[userId] || 0;
    const myOrdersCount = (data.profits || []).filter(p => p.employee_id === userId).length;
    return (
      <div className="space-y-4 p-1" dir="rtl">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-right">
              <Wallet className="w-5 h-5 text-emerald-600" />
              ربحك من هذه الفاتورة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600 mb-2">{fmt(myProfit)}</div>
            <p className="text-sm text-muted-foreground">
              من {myOrdersCount} طلب{myOrdersCount > 1 ? 'اً' : ''} مرتبط بهذه الفاتورة
            </p>
            {myBonus !== 0 && (
              <p className="text-xs text-amber-600 mt-1">
                يشمل {fmt(myBonus)} من الزيادة/الخصم على طلباتك
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2">* المبلغ صافي بدون أجور التوصيل</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // === مالك منتجات الفاتورة فقط ===
  if (isInvoiceProductOwner && !isAdmin) {
    const myOwnerStats = calc.byOwner[userId] || { revenue: 0, cost: 0, items: 0, products: [] };
    const myEmployeesProfits = Object.entries(calc.employeeCombinedByEmp)
      .filter(([empId]) => supervisedIds.includes(empId))
      .map(([empId, amount]) => ({ empId, name: namesMap[empId] || 'موظف', amount }));
    const myEmployeesTotal = myEmployeesProfits.reduce((s, e) => s + e.amount, 0);
    const myNet = (myOwnerStats.revenue - myOwnerStats.cost) - myEmployeesTotal;

    return (
      <div className="space-y-4 p-1" dir="rtl">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard icon={TrendingUp} label="إيراد منتجاتك" sub="بدون توصيل" value={fmt(myOwnerStats.revenue)} color="blue" />
          <StatCard icon={Package} label="تكلفة منتجاتك" value={fmt(myOwnerStats.cost)} color="orange" />
          <StatCard icon={Boxes} label="عدد القطع" sub="مُسلَّمة فعلاً" value={`${myOwnerStats.items}`} color="purple" />
          <StatCard icon={Wallet} label="صافي ربحك" value={fmt(myNet)} color="emerald" highlight />
          <DeltaStatCard delta={calc.totalDelta} fmt={fmt} />
          <OffChannelStatCard calc={calc} fmt={fmt} />
        </div>

        {myOwnerStats.products?.length > 0 && (
          <ProductsBreakdown products={myOwnerStats.products} fmt={fmt} />
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-right">
              <Users className="w-5 h-5 text-primary" />
              مستحقات موظفيك من هذه الفاتورة ({fmt(myEmployeesTotal)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myEmployeesProfits.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">لا توجد مستحقات لموظفيك في هذه الفاتورة</p>
            ) : (
              <div className="space-y-2">
                {myEmployeesProfits.map(emp => (
                  <div key={emp.empId} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                    <span className="font-medium">{emp.name}</span>
                    <Badge variant="secondary" className="text-emerald-600 bg-emerald-500/10">{fmt(emp.amount)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <DeltaNote calc={calc} fmt={fmt} />
        <DeliveryNote totalDelivery={calc.totalDelivery} fmt={fmt} />
      </div>
    );
  }

  // === المدير العام ===
  const ownerEntries = Object.entries(calc.byOwner).map(([ownerId, stats]) => ({
    ownerId,
    name: ownerId === '__system__' ? 'النظام (المدير العام)' : (namesMap[ownerId] || 'مالك غير معروف'),
    ...stats,
    netProfit: stats.revenue - stats.cost,
  })).sort((a, b) => b.netProfit - a.netProfit);

  const employeeEntries = Object.entries(calc.employeeCombinedByEmp)
    .filter(([, amount]) => Number(amount) !== 0)
    .map(([empId, amount]) => ({
      empId,
      name: namesMap[empId] || 'موظف',
      amount,
      bonus: calc.employeeBonusByEmp[empId] || 0,
    }));

  // عدد الطلبات لكل موظف (من profits)
  const employeeOrderCounts = {};
  (data.profits || []).forEach(p => {
    if (!p.employee_id || !p.order_id) return;
    if (!employeeOrderCounts[p.employee_id]) employeeOrderCounts[p.employee_id] = new Set();
    employeeOrderCounts[p.employee_id].add(p.order_id);
  });
  const employeeEntriesWithCounts = employeeEntries.map(e => ({
    ...e,
    ordersCount: (employeeOrderCounts[e.empId]?.size) || 0,
  })).sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-4 p-1" dir="rtl">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard icon={TrendingUp} label="إجمالي الإيراد" sub="حسب شركة التوصيل بدون توصيل" value={fmt(calc.totalRevenue)} color="blue" />
        <StatCard icon={Package} label="إجمالي التكلفة" value={fmt(calc.totalCost)} color="orange" />
        <StatCard icon={Boxes} label="عدد القطع" sub={`${calc.productCount} منتج • مُسلَّمة فعلاً`} value={`${calc.totalQty}`} color="purple" />
        <StatCard icon={Wallet} label="صافي الربح" value={fmt(calc.totalProfit)} color="emerald" highlight />
        <StatCard icon={Crown} label="صافي للمالكين" value={fmt(calc.netForOwners)} color="emerald" />
        <StatCard icon={Users} label="مستحقات الموظفين" sub={`${employeeEntriesWithCounts.length} موظف`} value={fmt(calc.employeeTotalCombined)} color="purple" />
        <DeltaStatCard delta={calc.totalDelta} fmt={fmt} />
        <OffChannelStatCard calc={calc} fmt={fmt} />
      </div>

      {employeeEntriesWithCounts.length > 0 && (
        <Card className="bg-gradient-to-br from-purple-500/10 to-fuchsia-500/5 border-purple-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-right text-sm">
              <Users className="w-4 h-4 text-purple-600" />
              تفاصيل مستحقات الموظفين ({fmt(calc.employeeTotalCombined)})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {employeeEntriesWithCounts.map(e => (
              <div key={e.empId} className="flex items-center justify-between gap-2 p-2 rounded-md bg-background/40 border border-purple-500/15">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/30 to-fuchsia-500/20 flex items-center justify-center text-xs font-bold text-purple-700 dark:text-purple-300 shrink-0">
                    {(e.name || '?').charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold truncate">{e.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {e.ordersCount} طلب{e.bonus !== 0 ? ` • زيادة/خصم ${fmt(e.bonus)}` : ''}
                    </div>
                  </div>
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 font-bold shrink-0">
                  {fmt(e.amount)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {calc.productsList.length > 0 && (
        <ProductsBreakdown products={calc.productsList} fmt={fmt} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-right">
            <Crown className="w-5 h-5 text-amber-500" />
            توزيع الأرباح على المالكين
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ownerEntries.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">تفاصيل المنتجات غير متاحة لهذه الفاتورة</p>
          ) : (
            <div className="space-y-2">
              {ownerEntries.map(o => (
                <div key={o.ownerId} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                  <div className="flex items-center gap-2">
                    {o.ownerId === '__system__' ? (
                      <ShieldCheck className="w-4 h-4 text-blue-500" />
                    ) : (
                      <Crown className="w-4 h-4 text-amber-500" />
                    )}
                    <span className="font-medium">{o.name}</span>
                    <Badge variant="outline" className="text-xs">{o.items} قطعة</Badge>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-600">{fmt(o.netProfit)}</div>
                    <div className="text-xs text-muted-foreground">إيراد {fmt(o.revenue)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3 text-center">
            * الإيراد لكل مالك يشمل حصته من الزيادة/الخصم (لما لا يأخذها موظف صاحب قاعدة ربح)
          </p>
        </CardContent>
      </Card>

      <DeltaNote calc={calc} fmt={fmt} />
      <DeliveryNote totalDelivery={calc.totalDelivery} fmt={fmt} />
    </div>
  );
};

const ProductsBreakdown = ({ products, fmt }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-right">
        <Boxes className="w-5 h-5 text-primary" />
        تفاصيل المنتجات في الفاتورة ({products.length})
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        {products.map(p => (
          <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Package className="w-4 h-4 text-primary shrink-0" />
              <span className="font-medium truncate">{p.name}</span>
              <Badge variant="outline" className="text-xs shrink-0">×{p.qty}</Badge>
            </div>
            <div className="text-right shrink-0">
              <div className="font-bold text-blue-600 text-sm">{fmt(p.revenue)}</div>
              <div className="text-xs text-muted-foreground">تكلفة {fmt(p.cost)}</div>
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

const DeltaNote = ({ calc, fmt }) => {
  if (Math.abs(calc.totalDelta) < 1) return null;
  const isIncrease = calc.totalDelta > 0;
  return (
    <div className={`flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed text-xs ${isIncrease ? 'text-emerald-600 bg-emerald-500/5' : 'text-orange-600 bg-orange-500/5'}`} dir="rtl">
      <TrendingUp className="w-4 h-4" />
      <span>
        إجمالي {isIncrease ? 'الزيادة' : 'الخصم'} على هذه الفاتورة: {fmt(Math.abs(calc.totalDelta))}
        {' — '}
        {calc.employeeBonusTotal !== 0 ? `وُزِّع ${fmt(calc.employeeBonusTotal)} للموظفين أصحاب قواعد الربح` : 'وُزِّع كاملاً على مالكي المنتجات'}
      </span>
    </div>
  );
};

const DeliveryNote = ({ totalDelivery, fmt }) => {
  if (!totalDelivery) return null;
  return (
    <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-muted/30 border border-dashed text-xs text-muted-foreground" dir="rtl">
      <Truck className="w-4 h-4" />
      <span>أجور التوصيل {fmt(totalDelivery)} مستثناة من الحسابات أعلاه</span>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, sub, value, color = 'blue', highlight = false }) => {
  const colorMap = {
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/30 text-blue-600',
    orange: 'from-orange-500/10 to-orange-500/5 border-orange-500/30 text-orange-600',
    emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/30 text-emerald-600',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/30 text-purple-600',
  };
  return (
    <Card className={`h-full min-h-[104px] bg-gradient-to-br ${colorMap[color]} ${highlight ? 'ring-2 ring-emerald-500/40' : ''}`}>
      <CardContent className="p-3 h-full flex flex-col justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <div>
          <div className="text-lg font-bold leading-tight">{value}</div>
          {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * كارت الزيادة/الخصم البارز — لون ديناميكي
 *  - أخضر إذا الفرق موجب (زيادة من شركة التوصيل)
 *  - برتقالي إذا الفرق سالب (خصم من شركة التوصيل)
 *  - رمادي إذا = 0
 */
const DeltaStatCard = ({ delta, fmt }) => {
  const d = Math.round(Number(delta) || 0);
  const isPositive = d > 0;
  const isNegative = d < 0;
  const Icon = isPositive ? TrendingUp : (isNegative ? TrendingDown : ArrowDownUp);
  const grad = isPositive
    ? 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
    : isNegative
      ? 'from-orange-500/15 to-orange-500/5 border-orange-500/40 text-orange-700 dark:text-orange-300'
      : 'from-muted/40 to-muted/10 border-border text-muted-foreground';
  const label = isPositive ? 'إجمالي الزيادة' : (isNegative ? 'إجمالي الخصم' : 'لا زيادة/خصم');
  const sub = isPositive
    ? 'من شركة التوصيل'
    : isNegative
      ? 'من شركة التوصيل'
      : 'لا فرق على الفاتورة';
  return (
    <Card className={`h-full min-h-[104px] bg-gradient-to-br ${grad}`}>
      <CardContent className="p-3 h-full flex flex-col justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <span className="text-xs">{label}</span>
        </div>
        <div>
          <div className="text-lg font-bold leading-tight">
            {isPositive ? '+' : (isNegative ? '−' : '')}{fmt(Math.abs(d))}
          </div>
          <div className="text-[10px] opacity-80 mt-0.5">{sub}</div>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * كارت تحصيلات خارج القناة (Off-Channel):
 *  طلبات مبلغها من شركة التوصيل = 0 لكنها مُسلَّمة فعلاً
 *  (دفع إلكتروني/المالك أو الموظف يتحمل التوصيل).
 *  - المبلغ المتوقّع تحصيله off-channel
 *  - عدد الطلبات
 *  - أجور التوصيل المُتحمَّلة
 */
const OffChannelStatCard = ({ calc, fmt }) => {
  const count = Number(calc.offChannelCount) || 0;
  const expected = Number(calc.offChannelExpectedAmount) || 0;
  const absorbed = Number(calc.offChannelAbsorbedDelivery) || 0;
  if (!count) {
    return (
      <Card className="h-full min-h-[104px] bg-gradient-to-br from-muted/30 to-muted/10 border-border">
        <CardContent className="p-3 h-full flex flex-col justify-between text-muted-foreground">
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4" />
            <span className="text-xs">تحصيلات خارج القناة</span>
          </div>
          <div>
            <div className="text-lg font-bold leading-tight">—</div>
            <div className="text-[10px] opacity-80 mt-0.5">لا توجد</div>
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="h-full min-h-[104px] bg-gradient-to-br from-amber-500/15 to-amber-500/5 border-amber-500/40 text-amber-700 dark:text-amber-300">
      <CardContent className="p-3 h-full flex flex-col justify-between">
        <div className="flex items-center gap-2">
          <Banknote className="w-4 h-4" />
          <span className="text-xs">تحصيلات خارج القناة</span>
        </div>
        <div>
          <div className="text-lg font-bold leading-tight">{fmt(expected)}</div>
          <div className="text-[10px] opacity-80 mt-0.5">
            {count} طلب{count > 1 ? '' : ''} • توصيل بحساب المالك {fmt(absorbed)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default InvoiceProfitsTab;
