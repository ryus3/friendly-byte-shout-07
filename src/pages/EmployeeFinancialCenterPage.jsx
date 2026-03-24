import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, BarChart, TrendingUp, TrendingDown, Wallet, Box, Users, Banknote, Hourglass, PieChart } from 'lucide-react';
import { format, parseISO, isValid, startOfMonth, endOfMonth, startOfWeek, startOfYear, subDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import StatCard from '@/components/dashboard/StatCard';
import ExpensesDialog from '@/components/accounting/ExpensesDialog';
import UnifiedSettledDuesDialog from '@/components/shared/UnifiedSettledDuesDialog';
import PendingDuesDialog from '@/components/accounting/PendingDuesDialog';
import ProfitLossDialog from '@/components/accounting/ProfitLossDialog';
import { useNavigate } from 'react-router-dom';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ar-IQ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0) + ' د.ع';
};

const StatRow = ({ label, value, colorClass, isNegative = false, onClick }) => {
  const safeValue = value ?? 0;
  return (
    <div className={`flex justify-between items-center py-3 border-b border-border/50 ${onClick ? 'cursor-pointer hover:bg-secondary/50 -mx-4 px-4' : ''}`} onClick={onClick}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`font-semibold text-base ${colorClass}`}>
        {isNegative ? `(${Math.abs(safeValue).toLocaleString()})` : safeValue.toLocaleString()} د.ع
      </p>
    </div>
  );
};

const EmployeeFinancialCenterPage = () => {
  const { orders, purchases, accounting, products, addExpense, deleteExpense, settlementInvoices, calculateProfit } = useInventory();
  const { user: currentUser, allUsers } = useAuth();
  const navigate = useNavigate();

  const [selectedTimePeriod, setSelectedTimePeriod] = useLocalStorage('emp-fc-time-period', 'all');
  const [dialogs, setDialogs] = useState({ expenses: false, settledDues: false, pendingDues: false, profitLoss: false });
  const [employeeCashSource, setEmployeeCashSource] = useState(null);
  const [cashMovements, setCashMovements] = useState([]);
  const [employeeProfits, setEmployeeProfits] = useState([]);
  const [loading, setLoading] = useState(true);

  const userId = currentUser?.id || currentUser?.user_id;

  const calculatedDateRange = useMemo(() => {
    const now = new Date();
    switch (selectedTimePeriod) {
      case 'today': return { from: subDays(now, 1), to: now };
      case 'week': return { from: startOfWeek(now, { weekStartsOn: 1 }), to: now };
      case 'year': return { from: startOfYear(now), to: now };
      case 'month': return { from: startOfMonth(now), to: endOfMonth(now) };
      case 'all': return { from: null, to: null };
      default: return { from: startOfMonth(now), to: endOfMonth(now) };
    }
  }, [selectedTimePeriod]);

  const filterByDate = (dateStr) => {
    if (selectedTimePeriod === 'all') return true;
    const { from, to } = calculatedDateRange;
    if (!from || !to || !dateStr) return true;
    try {
      const d = parseISO(dateStr);
      return isValid(d) && d >= from && d <= to;
    } catch { return false; }
  };

  // جلب بيانات القاصة الخاصة بالموظف
  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        // قاصة الموظف
        const { data: cashSource } = await supabase
          .from('cash_sources')
          .select('*')
          .eq('owner_user_id', userId)
          .eq('is_active', true)
          .single();
        setEmployeeCashSource(cashSource);

        // حركات النقد الخاصة بقاصة الموظف
        if (cashSource) {
          const { data: movements } = await supabase
            .from('cash_movements')
            .select('*')
            .eq('cash_source_id', cashSource.id)
            .order('created_at', { ascending: false })
            .limit(200);
          setCashMovements(movements || []);
        }

        // أرباح الموظف
        const { data: profits } = await supabase
          .from('profits')
          .select(`*, order:orders(order_number, status, receipt_received, tracking_number), employee:profiles!employee_id(full_name)`)
          .eq('employee_id', userId);
        setEmployeeProfits(profits || []);

      } catch (error) {
        console.error('خطأ في جلب بيانات المركز المالي:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    // Real-time updates
    const channel = supabase
      .channel('emp_fc_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_sources' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_movements' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profits' }, () => fetchData())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [userId]);

  // حساب الإحصائيات المالية
  const financialStats = useMemo(() => {
    const balance = employeeCashSource?.current_balance || 0;
    
    // إيرادات الفترة
    const revenueMovements = cashMovements.filter(m => 
      m.movement_type === 'in' && m.reference_type === 'order' && filterByDate(m.created_at)
    );
    const totalRevenue = revenueMovements.reduce((s, m) => s + Number(m.amount), 0);

    // مصاريف الفترة
    const expenseMovements = cashMovements.filter(m => 
      m.movement_type === 'out' && m.reference_type === 'expense' && filterByDate(m.created_at)
    );
    const totalExpenses = expenseMovements.reduce((s, m) => s + Number(m.amount), 0);

    // أرباح الموظف (من جدول profits)
    const filteredProfits = employeeProfits.filter(p => filterByDate(p.created_at));
    const totalEmployeeProfit = filteredProfits.reduce((s, p) => s + Number(p.employee_profit || 0), 0);
    const totalSystemProfit = filteredProfits.reduce((s, p) => s + Number(p.profit_amount || 0) - Number(p.employee_profit || 0), 0);

    // مستحقات مدفوعة ومعلقة
    const settledDues = filteredProfits
      .filter(p => p.settled)
      .reduce((s, p) => s + Number(p.employee_profit || 0), 0);
    const pendingDues = filteredProfits
      .filter(p => !p.settled)
      .reduce((s, p) => s + Number(p.employee_profit || 0), 0);

    // COGS (تكلفة البضاعة)
    const cogs = filteredProfits.reduce((s, p) => s + Number(p.product_cost || 0), 0);

    const grossProfit = totalRevenue - cogs;
    const netProfit = grossProfit - totalExpenses - settledDues;

    return {
      balance,
      totalRevenue,
      totalExpenses,
      totalEmployeeProfit,
      totalSystemProfit,
      settledDues,
      pendingDues,
      cogs,
      grossProfit,
      netProfit,
      salesWithoutDelivery: totalRevenue,
      deliveryFees: 0,
      generalExpenses: totalExpenses,
      employeeSettledDues: settledDues,
      employeePendingDues: pendingDues,
    };
  }, [employeeCashSource, cashMovements, employeeProfits, calculatedDateRange, selectedTimePeriod]);

  // المصاريف الخاصة بالموظف
  const myExpenses = useMemo(() => {
    if (!accounting?.expenses) return [];
    return accounting.expenses.filter(e => {
      if (e.created_by !== userId) return false;
      if (!filterByDate(e.created_at)) return false;
      if (e.expense_type === 'system') return false;
      if (e.category === 'مستحقات الموظفين') return false;
      return true;
    });
  }, [accounting?.expenses, userId, calculatedDateRange, selectedTimePeriod]);

  // طلبات الموظف
  const myOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter(o => o.created_by === userId);
  }, [orders, userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!employeeCashSource) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Wallet className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-bold text-muted-foreground">المركز المالي غير مفعّل</h2>
        <p className="text-muted-foreground">تواصل مع المدير لتفعيل المركز المالي الخاص بك</p>
      </div>
    );
  }

  const topRowCards = [
    { key: 'cash', title: "رصيد قاصتي", value: financialStats.balance, icon: Wallet, colors: ['sky-500', 'blue-500'], format: "currency" },
    { key: 'revenue', title: "إجمالي الإيرادات", value: financialStats.totalRevenue, icon: TrendingUp, colors: ['green-500', 'emerald-500'], format: "currency" },
    { key: 'expenses', title: "المصاريف العامة", value: financialStats.totalExpenses, icon: TrendingDown, colors: ['red-500', 'orange-500'], format: "currency", onClick: () => setDialogs(d => ({ ...d, expenses: true })) },
  ];

  return (
    <>
      <Helmet>
        <title>المركز المالي - {currentUser?.full_name}</title>
        <meta name="description" content="المركز المالي الخاص بالموظف" />
      </Helmet>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text">المركز المالي</h1>
            <p className="text-muted-foreground mt-1">{currentUser?.full_name}</p>
          </div>
          <select
            className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
            value={selectedTimePeriod}
            onChange={(e) => setSelectedTimePeriod(e.target.value)}
          >
            <option value="all">كل الفترات</option>
            <option value="today">اليوم</option>
            <option value="week">هذا الأسبوع</option>
            <option value="month">هذا الشهر</option>
            <option value="year">هذا العام</option>
          </select>
        </div>

        {/* رصيد سالب = تنبيه */}
        {financialStats.balance < 0 && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="py-3">
              <p className="text-destructive font-semibold text-center">
                ⚠️ رصيدك سالب: {financialStats.balance.toLocaleString()} د.ع — سيتم تعويضه من الأرباح القادمة
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {topRowCards.map((card, index) => (
            <StatCard key={index} {...card} />
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatCard
            title="صافي الربح"
            value={financialStats.netProfit}
            icon={PieChart}
            colors={['blue-500', 'sky-500']}
            format="currency"
            onClick={() => setDialogs(d => ({ ...d, profitLoss: true }))}
            description={`الفترة: ${selectedTimePeriod === 'all' ? 'كل الفترات' : selectedTimePeriod}`}
          />
          <Card className="h-full">
            <CardHeader>
              <CardTitle>مستحقات الموظفين</CardTitle>
              <CardDescription>موظفين تحت إشرافك</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col justify-center gap-4">
              <Button variant="outline" className="w-full" onClick={() => setDialogs(d => ({ ...d, settledDues: true }))}>
                <span>المستحقات المدفوعة:</span>
                <span className="font-bold mr-2">{(financialStats.settledDues || 0).toLocaleString()} د.ع</span>
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setDialogs(d => ({ ...d, pendingDues: true }))}>
                <Hourglass className="w-4 h-4 ml-2 text-amber-500" />
                <span>المستحقات المعلقة:</span>
                <span className="font-bold mr-2">{(financialStats.pendingDues || 0).toLocaleString()} د.ع</span>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* تقرير الأرباح والخسائر */}
        <Card>
          <CardHeader>
            <CardTitle>تقرير الأرباح والخسائر</CardTitle>
            <CardDescription>ملخص مالي للفترة المحددة</CardDescription>
          </CardHeader>
          <CardContent>
            <StatRow label="إجمالي المبيعات" value={financialStats.totalRevenue} colorClass="text-green-500" />
            <StatRow label="تكلفة البضاعة المباعة" value={financialStats.cogs} colorClass="text-orange-500" isNegative />
            <StatRow label="مجمل الربح" value={financialStats.grossProfit} colorClass="text-blue-500 font-bold" />
            <StatRow label="المصاريف العامة" value={financialStats.totalExpenses} colorClass="text-red-500" isNegative />
            <StatRow label="المستحقات المدفوعة" value={financialStats.settledDues} colorClass="text-purple-500" isNegative />
            <div className="flex justify-between items-center py-3 mt-2 bg-secondary rounded-lg px-4">
              <p className="font-bold text-lg">صافي الربح</p>
              <p className={`font-bold text-lg ${financialStats.netProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {financialStats.netProfit.toLocaleString()} د.ع
              </p>
            </div>
          </CardContent>
        </Card>

        {/* آخر حركات القاصة */}
        <Card>
          <CardHeader>
            <CardTitle>آخر حركات القاصة</CardTitle>
            <CardDescription>آخر 20 حركة في قاصتك</CardDescription>
          </CardHeader>
          <CardContent>
            {cashMovements.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد حركات بعد</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {cashMovements.slice(0, 20).map((m) => (
                  <div key={m.id} className="flex justify-between items-center py-2 px-3 rounded-lg bg-secondary/30 border border-border/30">
                    <div>
                      <p className="text-sm font-medium">{m.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.created_at ? format(parseISO(m.created_at), 'dd/MM/yyyy HH:mm', { locale: ar }) : ''}
                      </p>
                    </div>
                    <p className={`font-bold ${m.movement_type === 'in' ? 'text-green-500' : 'text-red-500'}`}>
                      {m.movement_type === 'in' ? '+' : '-'}{Number(m.amount).toLocaleString()} د.ع
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ExpensesDialog
        open={dialogs.expenses}
        onOpenChange={(open) => setDialogs(d => ({ ...d, expenses: open }))}
        expenses={myExpenses}
        addExpense={addExpense}
        deleteExpense={deleteExpense}
      />
      <UnifiedSettledDuesDialog
        open={dialogs.settledDues}
        onOpenChange={(open) => setDialogs(d => ({ ...d, settledDues: open }))}
        invoices={settlementInvoices}
        allUsers={allUsers}
        profits={employeeProfits}
        orders={myOrders}
        timePeriod={selectedTimePeriod}
      />
      <PendingDuesDialog
        open={dialogs.pendingDues}
        onOpenChange={(open) => setDialogs(d => ({ ...d, pendingDues: open }))}
        orders={myOrders}
        allUsers={allUsers}
        allProfits={employeeProfits}
      />
      <ProfitLossDialog
        open={dialogs.profitLoss}
        onOpenChange={(open) => setDialogs(d => ({ ...d, profitLoss: open }))}
        summary={financialStats}
        datePeriod={selectedTimePeriod}
        onDatePeriodChange={setSelectedTimePeriod}
      />
    </>
  );
};

export default EmployeeFinancialCenterPage;
