import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Wallet, Users, Package, Crown, ShieldCheck, Info, Truck, Boxes } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * تبويب أرباح الفاتورة
 *
 *  ⚠️ قاعدة محاسبية صارمة:
 *  جميع الأرقام (الإيراد، الربح، الصافي) **بدون أجور التوصيل**.
 *  الإيراد الحقيقي = SUM(order_items.quantity * unit_price)
 *  أو fallback: orders.final_amount - orders.delivery_fee
 *  التكلفة = SUM(order_items.quantity * cost_price من المتغير/المنتج)
 *  الربح = الإيراد - التكلفة
 */
const InvoiceProfitsTab = ({ invoice, linkedOrders = [] }) => {
  const { user } = useAuth();
  const { isAdmin, isDepartmentManager } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [profits, setProfits] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [ordersData, setOrdersData] = useState([]);
  const [namesMap, setNamesMap] = useState({});
  const [supervisedIds, setSupervisedIds] = useState([]);
  const [resolvedOrderIds, setResolvedOrderIds] = useState([]);

  const userId = user?.user_id || user?.id;

  const orderIdsFromProps = useMemo(
    () => Array.from(new Set((linkedOrders || []).map(o => o.id).filter(Boolean))),
    [linkedOrders]
  );

  // جلب order_id من delivery_invoice_orders إذا لم تكن الروابط ممررة
  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      if (orderIdsFromProps.length > 0) {
        setResolvedOrderIds(orderIdsFromProps);
        return;
      }
      const externalId = invoice?.external_id || invoice?.id;
      if (!externalId) {
        setResolvedOrderIds([]);
        return;
      }
      try {
        const { data: invRow } = await supabase
          .from('delivery_invoices')
          .select('id')
          .eq('external_id', String(externalId))
          .maybeSingle();
        if (!invRow?.id) {
          if (!cancelled) setResolvedOrderIds([]);
          return;
        }
        const { data: dio } = await supabase
          .from('delivery_invoice_orders')
          .select('order_id')
          .eq('invoice_id', invRow.id)
          .not('order_id', 'is', null);
        const ids = Array.from(new Set((dio || []).map(r => r.order_id).filter(Boolean)));
        if (!cancelled) setResolvedOrderIds(ids);
      } catch {
        if (!cancelled) setResolvedOrderIds([]);
      }
    };
    resolve();
    return () => { cancelled = true; };
  }, [orderIdsFromProps, invoice?.external_id, invoice?.id]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const ids = resolvedOrderIds;
      if (!ids || ids.length === 0) {
        setLoading(false);
        setProfits([]);
        setOrderItems([]);
        setOrdersData([]);
        return;
      }
      setLoading(true);
      try {
        const [{ data: pData }, { data: itemsData }, { data: oData }] = await Promise.all([
          supabase
            .from('profits')
            .select('order_id, employee_id, employee_profit, profit_amount, total_revenue, total_cost, status')
            .in('order_id', ids),
          supabase
            .from('order_items')
            .select(`
              order_id, product_id, variant_id, quantity, unit_price, total_price,
              products:product_id(id, name, owner_user_id, cost_price),
              product_variants:variant_id(id, cost_price)
            `)
            .in('order_id', ids),
          supabase
            .from('orders')
            .select('id, final_amount, total_amount, delivery_fee')
            .in('id', ids),
        ]);

        const employeeIds = (pData || []).map(p => p.employee_id).filter(Boolean);
        const ownerIds = (itemsData || [])
          .map(i => i.products?.owner_user_id)
          .filter(Boolean);
        const allUserIds = Array.from(new Set([...employeeIds, ...ownerIds]));

        let names = {};
        if (allUserIds.length) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', allUserIds);
          (profs || []).forEach(p => { names[p.user_id] = p.full_name; });
        }

        let supIds = [];
        if (isDepartmentManager && !isAdmin && userId) {
          const { data: sup } = await supabase
            .from('employee_supervisors')
            .select('employee_id')
            .eq('supervisor_id', userId)
            .eq('is_active', true);
          supIds = (sup || []).map(r => r.employee_id);
        }

        if (cancelled) return;
        setProfits(pData || []);
        setOrderItems(itemsData || []);
        setOrdersData(oData || []);
        setNamesMap(names);
        setSupervisedIds(supIds);
      } catch (e) {
        console.error('InvoiceProfitsTab load error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [resolvedOrderIds.join(','), userId, isAdmin, isDepartmentManager]);

  const calc = useMemo(() => {
    // ✅ القاعدة: استبعاد أجور التوصيل دائماً
    const totalDeliveryFees = ordersData.reduce((s, o) => s + (Number(o.delivery_fee) || 0), 0);

    // الإيراد الحقيقي بدون توصيل = من order_items (الأدق)
    let revenueFromItems = 0;
    let costFromItems = 0;
    let totalQty = 0;
    const productMap = {}; // product_id -> { name, qty, revenue, cost, ownerId }

    (orderItems || []).forEach(it => {
      const qty = Number(it.quantity) || 0;
      const unitPrice = Number(it.unit_price) || 0;
      const costUnit =
        Number(it.product_variants?.cost_price) ||
        Number(it.products?.cost_price) || 0;
      const revenue = qty * unitPrice;
      const cost = qty * costUnit;
      revenueFromItems += revenue;
      costFromItems += cost;
      totalQty += qty;

      const pid = it.product_id || '__unknown__';
      if (!productMap[pid]) {
        productMap[pid] = {
          id: pid,
          name: it.products?.name || 'منتج',
          ownerId: it.products?.owner_user_id || '__system__',
          qty: 0, revenue: 0, cost: 0,
        };
      }
      productMap[pid].qty += qty;
      productMap[pid].revenue += revenue;
      productMap[pid].cost += cost;
    });

    // Fallback: إذا لم تتوفر order_items، نحسب من orders (final_amount - delivery_fee)
    const itemsAvailable = (orderItems || []).length > 0;
    const revenueFromOrders = ordersData.reduce(
      (s, o) => s + ((Number(o.final_amount) || Number(o.total_amount) || 0) - (Number(o.delivery_fee) || 0)),
      0
    );

    const totalRevenue = itemsAvailable ? revenueFromItems : revenueFromOrders;

    // التكلفة من order_items فقط (الأدق)
    const totalCost = costFromItems;

    // مستحقات الموظفين تبقى من جدول profits
    const employeeProfitTotal = profits.reduce((s, p) => s + (Number(p.employee_profit) || 0), 0);

    // الربح الإجمالي بدون توصيل
    const totalProfit = totalRevenue - totalCost;
    const netForOwners = totalProfit - employeeProfitTotal;

    const employeeProfitByEmp = {};
    profits.forEach(p => {
      const k = p.employee_id || '__unknown__';
      employeeProfitByEmp[k] = (employeeProfitByEmp[k] || 0) + (Number(p.employee_profit) || 0);
    });

    // توزيع على المالكين
    const byOwner = {};
    Object.values(productMap).forEach(prod => {
      const ownerId = prod.ownerId;
      if (!byOwner[ownerId]) byOwner[ownerId] = { revenue: 0, cost: 0, items: 0, products: [] };
      byOwner[ownerId].revenue += prod.revenue;
      byOwner[ownerId].cost += prod.cost;
      byOwner[ownerId].items += prod.qty;
      byOwner[ownerId].products.push(prod);
    });

    const productsList = Object.values(productMap).sort((a, b) => b.revenue - a.revenue);

    return {
      totalRevenue, totalCost, totalProfit,
      employeeProfitTotal, netForOwners,
      employeeProfitByEmp, byOwner,
      itemsAvailable, totalDeliveryFees, totalQty,
      productsList, productCount: productsList.length,
    };
  }, [profits, orderItems, ordersData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!resolvedOrderIds.length) {
    return (
      <div className="text-center py-8 text-muted-foreground" dir="rtl">
        لا توجد طلبات محلية مرتبطة لحساب الأرباح
      </div>
    );
  }

  if (profits.length === 0 && !calc.itemsAvailable) {
    return (
      <div className="text-center py-8 text-muted-foreground space-y-2" dir="rtl">
        <Info className="w-6 h-6 mx-auto text-muted-foreground" />
        <div>لم يتم تسجيل أرباح لهذه الفاتورة بعد</div>
      </div>
    );
  }

  const fmt = (n) => `${Math.round(Number(n) || 0).toLocaleString()} د.ع`;

  // === الموظف ===
  if (!isAdmin && !isDepartmentManager) {
    const myProfit = calc.employeeProfitByEmp[userId] || 0;
    const myOrdersCount = profits.filter(p => p.employee_id === userId).length;
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
            <p className="text-xs text-muted-foreground mt-2">
              * المبلغ صافي بدون أجور التوصيل
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // === مدير القسم ===
  if (isDepartmentManager && !isAdmin) {
    const myOwnerStats = calc.byOwner[userId] || { revenue: 0, cost: 0, items: 0, products: [] };
    const myEmployeesProfits = Object.entries(calc.employeeProfitByEmp)
      .filter(([empId]) => supervisedIds.includes(empId))
      .map(([empId, amount]) => ({
        empId, name: namesMap[empId] || 'موظف', amount,
      }));
    const myEmployeesTotal = myEmployeesProfits.reduce((s, e) => s + e.amount, 0);
    const myNet = (myOwnerStats.revenue - myOwnerStats.cost) - myEmployeesTotal;

    return (
      <div className="space-y-4 p-1" dir="rtl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={TrendingUp} label="إيراد منتجاتك" sub="بدون توصيل" value={fmt(myOwnerStats.revenue)} color="blue" />
          <StatCard icon={Package} label="تكلفة منتجاتك" value={fmt(myOwnerStats.cost)} color="orange" />
          <StatCard icon={Boxes} label="عدد القطع" value={`${myOwnerStats.items}`} color="purple" />
          <StatCard icon={Wallet} label="صافي ربحك" value={fmt(myNet)} color="emerald" highlight />
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

        <DeliveryNote totalDelivery={calc.totalDeliveryFees} fmt={fmt} />
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

  const employeeEntries = Object.entries(calc.employeeProfitByEmp)
    .filter(([, amount]) => Number(amount) !== 0)
    .map(([empId, amount]) => ({
      empId, name: namesMap[empId] || 'موظف', amount,
    }));

  return (
    <div className="space-y-4 p-1" dir="rtl">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={TrendingUp} label="إجمالي الإيراد" sub="بدون توصيل" value={fmt(calc.totalRevenue)} color="blue" />
        <StatCard icon={Package} label="إجمالي التكلفة" value={fmt(calc.totalCost)} color="orange" />
        <StatCard icon={Boxes} label="عدد القطع" sub={`${calc.productCount} منتج`} value={`${calc.totalQty}`} color="purple" />
        <StatCard icon={Wallet} label="صافي الربح" value={fmt(calc.totalProfit)} color="emerald" highlight />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Users} label="مستحقات الموظفين" value={fmt(calc.employeeProfitTotal)} color="purple" />
        <StatCard icon={Crown} label="صافي للمالكين" value={fmt(calc.netForOwners)} color="emerald" />
      </div>

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
            <p className="text-center text-muted-foreground py-4">
              تفاصيل المنتجات غير متاحة لهذه الفاتورة
            </p>
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
            * توزيع الأرباح يعرض صافي ما يعود لكل مالك منتج (الإيراد - التكلفة) بدون أجور التوصيل
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-right">
            <Users className="w-5 h-5 text-primary" />
            مستحقات الموظفين ({fmt(calc.employeeProfitTotal)})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {employeeEntries.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">لا توجد مستحقات موظفين</p>
          ) : (
            <div className="space-y-2">
              {employeeEntries.map(e => (
                <div key={e.empId} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                  <span className="font-medium">{e.name}</span>
                  <Badge variant="secondary" className="text-emerald-600 bg-emerald-500/10">{fmt(e.amount)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DeliveryNote totalDelivery={calc.totalDeliveryFees} fmt={fmt} />
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
    <Card className={`bg-gradient-to-br ${colorMap[color]} ${highlight ? 'ring-2 ring-emerald-500/40' : ''}`}>
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

export default InvoiceProfitsTab;
