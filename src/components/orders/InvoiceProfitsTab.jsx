import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, TrendingUp, Wallet, Users, Package, Crown, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * تبويب يعرض الأرباح والمستحقات الخاصة بالفاتورة بحسب دور المستخدم:
 * - الموظف: أرباحه فقط من طلبات هذه الفاتورة + إجمالي مبيعات منتجاته
 * - مدير القسم: أرباحه (كصاحب منتجات) + مستحقات موظفيه + التكلفة
 * - المدير العام: تفصيل كامل (إيراد، تكلفة، مستحقات الموظفين، أرباح المالكين، صافي)
 */
const InvoiceProfitsTab = ({ invoice, linkedOrders = [] }) => {
  const { user } = useAuth();
  const { isAdmin, isDepartmentManager } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [profits, setProfits] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [productsMap, setProductsMap] = useState({}); // product_id -> { owner_user_id, cost_price }
  const [variantsMap, setVariantsMap] = useState({}); // variant_id -> cost_price
  const [ownersMap, setOwnersMap] = useState({}); // user_id -> full_name
  const [supervisedIds, setSupervisedIds] = useState([]);

  const orderIds = useMemo(
    () => (linkedOrders || []).map(o => o.id).filter(Boolean),
    [linkedOrders]
  );

  const userId = user?.user_id || user?.id;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!orderIds.length) {
        setLoading(false);
        setProfits([]);
        setOrderItems([]);
        return;
      }
      setLoading(true);

      try {
        // 1) Profits for these orders
        const { data: pData } = await supabase
          .from('profits')
          .select('order_id, employee_id, employee_profit, profit_amount, total_revenue, total_cost')
          .in('order_id', orderIds);

        // 2) Order items + product/variant info
        const { data: itemsData } = await supabase
          .from('order_items')
          .select('order_id, product_id, variant_id, quantity, unit_price, total_price, cost_price, products:product_id(id, name, owner_user_id, cost_price)')
          .in('order_id', orderIds);

        // 3) Variants cost price (for accuracy)
        const variantIds = [...new Set((itemsData || []).map(i => i.variant_id).filter(Boolean))];
        let vData = [];
        if (variantIds.length) {
          const { data } = await supabase
            .from('product_variants')
            .select('id, cost_price')
            .in('id', variantIds);
          vData = data || [];
        }

        // 4) Owners (profiles for owner names)
        const ownerIds = [...new Set((itemsData || [])
          .map(i => i.products?.owner_user_id)
          .filter(Boolean))];
        const employeeIds = [...new Set((pData || []).map(p => p.employee_id).filter(Boolean))];
        const allUserIds = [...new Set([...ownerIds, ...employeeIds])];
        let ownersData = [];
        if (allUserIds.length) {
          const { data } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', allUserIds);
          ownersData = data || [];
        }

        // 5) For department manager: supervised employees
        let supIds = [];
        if (isDepartmentManager && !isAdmin && userId) {
          const { data } = await supabase
            .from('employee_supervisors')
            .select('employee_id')
            .eq('supervisor_id', userId);
          supIds = (data || []).map(r => r.employee_id);
        }

        if (cancelled) return;

        const pMap = {};
        (itemsData || []).forEach(i => {
          if (i.products) pMap[i.products.id] = i.products;
        });
        const vMap = {};
        vData.forEach(v => { vMap[v.id] = v.cost_price; });
        const oMap = {};
        ownersData.forEach(o => { oMap[o.user_id] = o.full_name; });

        setProfits(pData || []);
        setOrderItems(itemsData || []);
        setProductsMap(pMap);
        setVariantsMap(vMap);
        setOwnersMap(oMap);
        setSupervisedIds(supIds);
      } catch (e) {
        console.error('InvoiceProfitsTab load error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [orderIds.join(','), userId, isAdmin, isDepartmentManager]);

  // ===== Derived calculations =====
  const calc = useMemo(() => {
    // Per item: revenue, cost, item-level profit (without employee cut yet)
    const enrichedItems = orderItems.map(it => {
      const cost = it.cost_price ?? variantsMap[it.variant_id] ?? it.products?.cost_price ?? 0;
      const revenue = (it.unit_price || 0) * (it.quantity || 0);
      const totalCost = cost * (it.quantity || 0);
      return {
        ...it,
        _revenue: revenue,
        _cost: totalCost,
        _ownerId: it.products?.owner_user_id || null,
      };
    });

    // Sum profits by employee
    const employeeProfitTotal = profits.reduce((s, p) => s + (Number(p.employee_profit) || 0), 0);
    const employeeProfitByEmp = {};
    profits.forEach(p => {
      employeeProfitByEmp[p.employee_id] = (employeeProfitByEmp[p.employee_id] || 0) + (Number(p.employee_profit) || 0);
    });

    // Sum revenue / cost per owner
    const byOwner = {}; // owner_user_id -> { revenue, cost, items }
    enrichedItems.forEach(i => {
      const key = i._ownerId || '__system__';
      if (!byOwner[key]) byOwner[key] = { revenue: 0, cost: 0, items: 0 };
      byOwner[key].revenue += i._revenue;
      byOwner[key].cost += i._cost;
      byOwner[key].items += i.quantity || 0;
    });

    const totalRevenue = enrichedItems.reduce((s, i) => s + i._revenue, 0);
    const totalCost = enrichedItems.reduce((s, i) => s + i._cost, 0);
    const grossProfit = totalRevenue - totalCost;
    const netForOwners = grossProfit - employeeProfitTotal;

    return {
      enrichedItems,
      employeeProfitTotal,
      employeeProfitByEmp,
      byOwner,
      totalRevenue,
      totalCost,
      grossProfit,
      netForOwners,
    };
  }, [orderItems, profits, variantsMap]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!orderIds.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        لا توجد طلبات محلية مرتبطة لحساب الأرباح
      </div>
    );
  }

  // ===== Role-specific views =====
  const fmt = (n) => `${Math.round(Number(n) || 0).toLocaleString()} د.ع`;

  // EMPLOYEE VIEW
  if (!isAdmin && !isDepartmentManager) {
    const myProfit = calc.employeeProfitByEmp[userId] || 0;
    // إجمالي مبيعات منتجاته (إن كان يملك أي): عادة الموظف لا يملك منتجات، نعرض إجمالي طلباته
    const myOrdersCount = profits.filter(p => p.employee_id === userId).length;
    return (
      <div className="space-y-4" dir="rtl">
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
          </CardContent>
        </Card>
      </div>
    );
  }

  // DEPARTMENT MANAGER VIEW
  if (isDepartmentManager && !isAdmin) {
    // أرباح المدير كصاحب منتجات
    const myOwnerStats = calc.byOwner[userId] || { revenue: 0, cost: 0, items: 0 };
    // أرباح موظفيه فقط
    const myEmployeesProfits = Object.entries(calc.employeeProfitByEmp)
      .filter(([empId]) => supervisedIds.includes(empId))
      .map(([empId, amount]) => ({
        empId,
        name: ownersMap[empId] || 'موظف',
        amount,
      }));
    const myEmployeesTotal = myEmployeesProfits.reduce((s, e) => s + e.amount, 0);
    const myNetProfit = (myOwnerStats.revenue - myOwnerStats.cost) - myEmployeesTotal;

    return (
      <div className="space-y-4" dir="rtl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatCard icon={TrendingUp} label="إيراد منتجاتك" value={fmt(myOwnerStats.revenue)} color="blue" />
          <StatCard icon={Package} label="تكلفة منتجاتك" value={fmt(myOwnerStats.cost)} color="orange" />
          <StatCard icon={Wallet} label="صافي ربحك" value={fmt(myNetProfit)} color="emerald" highlight />
        </div>

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
      </div>
    );
  }

  // ADMIN VIEW (full breakdown)
  const ownerEntries = Object.entries(calc.byOwner).map(([ownerId, stats]) => ({
    ownerId,
    name: ownerId === '__system__' ? 'النظام (المدير العام)' : (ownersMap[ownerId] || 'مالك غير معروف'),
    ...stats,
    netProfit: stats.revenue - stats.cost,
  }));

  const employeeEntries = Object.entries(calc.employeeProfitByEmp).map(([empId, amount]) => ({
    empId,
    name: ownersMap[empId] || 'موظف',
    amount,
  }));

  return (
    <div className="space-y-4" dir="rtl">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={TrendingUp} label="إجمالي الإيراد" value={fmt(calc.totalRevenue)} color="blue" />
        <StatCard icon={Package} label="إجمالي التكلفة" value={fmt(calc.totalCost)} color="orange" />
        <StatCard icon={Users} label="مستحقات الموظفين" value={fmt(calc.employeeProfitTotal)} color="purple" />
        <StatCard icon={Wallet} label="صافي للمالكين" value={fmt(calc.netForOwners)} color="emerald" highlight />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-right">
            <Crown className="w-5 h-5 text-amber-500" />
            توزيع الأرباح على المالكين
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ownerEntries.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">لا توجد بيانات</p>
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
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color = 'blue', highlight = false }) => {
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
      </CardContent>
    </Card>
  );
};

export default InvoiceProfitsTab;
