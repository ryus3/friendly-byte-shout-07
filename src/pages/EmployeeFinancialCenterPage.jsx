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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Edit, BarChart, TrendingUp, TrendingDown, Wallet, Box, Users, Banknote, Hourglass, CheckCircle, PieChart, CalendarRange } from 'lucide-react';
import { format, parseISO, isValid, startOfMonth, endOfMonth, startOfWeek, startOfYear, subDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { PDFDownloadLink } from '@react-pdf/renderer';
import StatCard from '@/components/dashboard/StatCard';
import FinancialReportPDF from '@/components/pdf/FinancialReportPDF';
import { useNavigate } from 'react-router-dom';
import ExpensesDialog from '@/components/accounting/ExpensesDialog';
import UnifiedSettledDuesDialog from '@/components/shared/UnifiedSettledDuesDialog';
import PendingDuesDialog from '@/components/accounting/PendingDuesDialog';
import ProfitLossDialog from '@/components/accounting/ProfitLossDialog';
import FinancialPerformanceCard from '@/components/shared/FinancialPerformanceCard';
import ManagerProfitsCard from '@/components/shared/ManagerProfitsCard';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

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

const EditCapitalDialog = ({ open, onOpenChange, currentCapital, onSave, cashSourceId }) => {
  const [newCapital, setNewCapital] = useState(currentCapital);

  useEffect(() => {
    setNewCapital(currentCapital);
  }, [currentCapital, open]);

  const handleSave = async () => {
    const capitalValue = parseFloat(newCapital);
    if (isNaN(capitalValue)) {
      toast({ title: "خطأ", description: "الرجاء إدخال مبلغ صحيح.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase
        .from('cash_sources')
        .update({ initial_capital: capitalValue, updated_at: new Date().toISOString() })
        .eq('id', cashSourceId);
      if (error) throw error;
      onSave(capitalValue);
      toast({ title: "تم التحديث", description: "تم تحديث رأس المال بنجاح" });
    } catch (error) {
      console.error('خطأ في تحديث رأس المال:', error);
      toast({ title: "خطأ", description: "فشل في تحديث رأس المال", variant: "destructive" });
    }
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>تعديل رأس المال</AlertDialogTitle>
          <AlertDialogDescription>أدخل القيمة الجديدة لرأس المال الخاص بقاصتك.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="emp-capital-input">رأس المال (د.ع)</Label>
          <Input id="emp-capital-input" type="number" value={newCapital} onChange={(e) => setNewCapital(e.target.value)} placeholder="أدخل رأس المال" />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction onClick={handleSave}>حفظ التغييرات</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const EmployeeFinancialCenterPage = () => {
  const { orders, purchases, accounting, products, addExpense, deleteExpense, settlementInvoices, calculateProfit } = useInventory();
  const { user: currentUser, allUsers } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();

  const [selectedTimePeriod, setSelectedTimePeriod] = useLocalStorage('emp-fc-time-period', 'all');
  const [dialogs, setDialogs] = useState({ expenses: false, settledDues: false, pendingDues: false, profitLoss: false, capital: false });
  const [employeeCashSource, setEmployeeCashSource] = useState(null);
  const [cashMovements, setCashMovements] = useState([]);
  const [employeeProfits, setEmployeeProfits] = useState([]);
  const [supervisedEmployeeProfits, setSupervisedEmployeeProfits] = useState([]);
  const [supervisedEmployeeIds, setSupervisedEmployeeIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialCapital, setInitialCapital] = useState(0);

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

  // جلب جميع البيانات
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
        setInitialCapital(cashSource?.initial_capital || 0);

        // حركات النقد
        if (cashSource) {
          const { data: movements } = await supabase
            .from('cash_movements')
            .select('*')
            .eq('cash_source_id', cashSource.id)
            .order('effective_at', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(500);
          setCashMovements(movements || []);
        }

        // أرباح الموظف الشخصية
        const { data: profits } = await supabase
          .from('profits')
          .select(`*, order:orders(order_number, status, receipt_received, tracking_number, created_by), employee:profiles!employee_id(full_name)`)
          .eq('employee_id', userId);
        setEmployeeProfits(profits || []);

        // الموظفين تحت الإشراف
        const { data: supervised } = await supabase
          .from('employee_supervisors')
          .select('employee_id')
          .eq('supervisor_id', userId)
          .eq('is_active', true);
        
        const supIds = supervised?.map(s => s.employee_id) || [];
        setSupervisedEmployeeIds(supIds);

        // أرباح الموظفين تحت الإشراف
        if (supIds.length > 0) {
          const { data: supProfits } = await supabase
            .from('profits')
            .select(`*, order:orders(order_number, status, receipt_received, tracking_number, created_by), employee:profiles!employee_id(full_name)`)
            .in('employee_id', supIds);
          setSupervisedEmployeeProfits(supProfits || []);
        }

      } catch (error) {
        console.error('خطأ في جلب بيانات المركز المالي:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    const channel = supabase
      .channel('emp_fc_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_sources' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_movements' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profits' }, () => fetchData())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [userId]);

  // الإحصائيات المالية الموحدة
  const financialStats = useMemo(() => {
    const balance = employeeCashSource?.current_balance || 0;

    // إيرادات (حركات دخول من طلبات)
    const revenueMovements = cashMovements.filter(m =>
      m.movement_type === 'in' && filterByDate(m.created_at)
    );
    const totalRevenue = revenueMovements.reduce((s, m) => s + Number(m.amount), 0);

    // مصاريف (حركات خروج - مصاريف عامة)
    const expenseMovements = cashMovements.filter(m =>
      m.movement_type === 'out' && m.reference_type === 'expense' && filterByDate(m.created_at)
    );
    const totalExpenses = expenseMovements.reduce((s, m) => s + Number(m.amount), 0);

    // رسوم التوصيل
    const deliveryFeeMovements = cashMovements.filter(m =>
      m.movement_type === 'out' && m.reference_type === 'delivery_fee' && filterByDate(m.created_at)
    );
    const deliveryFees = deliveryFeeMovements.reduce((s, m) => s + Number(m.amount), 0);

    // المبيعات بدون التوصيل
    const salesWithoutDelivery = totalRevenue;

    // أرباح الموظف الشخصية (من جدول profits)
    const filteredProfits = employeeProfits.filter(p => filterByDate(p.created_at));
    const totalEmployeeProfit = filteredProfits.reduce((s, p) => s + Number(p.employee_profit || 0), 0);

    // COGS
    const cogs = filteredProfits.reduce((s, p) => s + Number(p.product_cost || 0), 0);

    // مستحقات الموظفين تحت الإشراف
    const filteredSupProfits = supervisedEmployeeProfits.filter(p => filterByDate(p.created_at));
    const employeeSettledDues = filteredSupProfits
      .filter(p => p.settled)
      .reduce((s, p) => s + Number(p.employee_profit || 0), 0);
    const employeePendingDues = filteredSupProfits
      .filter(p => !p.settled)
      .reduce((s, p) => s + Number(p.employee_profit || 0), 0);

    // مشتريات
    const purchaseMovements = cashMovements.filter(m =>
      m.movement_type === 'out' && m.reference_type === 'purchase' && filterByDate(m.created_at)
    );
    const totalPurchases = purchaseMovements.reduce((s, m) => s + Number(m.amount), 0);

    const grossProfit = salesWithoutDelivery - cogs;
    const generalExpenses = totalExpenses;
    const netProfit = grossProfit - generalExpenses - employeeSettledDues;

    return {
      balance,
      totalRevenue,
      totalExpenses,
      totalEmployeeProfit,
      employeeSettledDues,
      employeePendingDues,
      cogs,
      grossProfit,
      netProfit,
      salesWithoutDelivery,
      deliveryFees,
      generalExpenses,
      totalPurchases,
    };
  }, [employeeCashSource, cashMovements, employeeProfits, supervisedEmployeeProfits, calculatedDateRange, selectedTimePeriod]);

  // قيمة مخزون الموظف (المنتجات الخاصة)
  const inventoryValue = useMemo(() => {
    if (!products || !Array.isArray(products)) return 0;
    // المنتجات المملوكة للموظف
    return products
      .filter(p => p.created_by === userId)
      .reduce((sum, p) => {
        if (!p.variants || !Array.isArray(p.variants)) return sum;
        return sum + p.variants.reduce((variantSum, v) => {
          const quantity = v.quantity || 0;
          const price = v.price || p.base_price || 0;
          return variantSum + (quantity * price);
        }, 0);
      }, 0);
  }, [products, userId]);

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

  const totalCapital = initialCapital + inventoryValue;

  // بيانات موحدة لتقرير PDF
  const unifiedProfitData = useMemo(() => ({
    ...financialStats,
  }), [financialStats]);

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
    {
      key: 'capital',
      title: "رأس المال الكلي",
      value: totalCapital,
      icon: Banknote,
      colors: ['slate-500', 'gray-600'],
      format: "currency",
      onClick: () => setDialogs(d => ({ ...d, capital: true }))
    },
    { key: 'cash', title: "الرصيد النقدي الفعلي", value: financialStats.balance, icon: Wallet, colors: ['sky-500', 'blue-500'], format: "currency", onClick: () => navigate('/employee-cash-management') },
    { key: 'inventory', title: "قيمة المخزون", value: inventoryValue, icon: Box, colors: ['purple-500', 'violet-600'], format: "currency" },
  ];

  const profitCards = [
    {
      key: 'productProfit',
      title: "تحليل أرباح المنتجات",
      value: myOrders.filter(o => o.status === 'delivered' || o.receipt_received).length > 0
        ? `${myOrders.filter(o => o.status === 'delivered' || o.receipt_received).length} طلب مسلّم`
        : 'لا توجد مبيعات',
      icon: PieChart,
      colors: ['violet-500', 'purple-500'],
      format: 'text',
      onClick: () => navigate(`/advanced-profits-analysis?employee=${userId}`)
    },
    { key: 'generalExpenses', title: "المصاريف العامة", value: financialStats.generalExpenses, icon: TrendingDown, colors: ['red-500', 'orange-500'], format: 'currency', onClick: () => setDialogs(d => ({ ...d, expenses: true })) },
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
          <div className="flex gap-2 flex-wrap items-center">
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
            <PDFDownloadLink
              document={<FinancialReportPDF summary={unifiedProfitData} dateRange={calculatedDateRange} />}
              fileName={`financial-report-${currentUser?.full_name}-${new Date().toISOString().slice(0, 10)}.pdf`}
            >
              {({ loading: pdfLoading }) => (
                <Button variant="outline" disabled={pdfLoading}>
                  <FileText className="w-4 h-4 ml-2" />
                  {pdfLoading ? 'جاري التجهيز...' : 'تصدير تقرير'}
                </Button>
              )}
            </PDFDownloadLink>
          </div>
        </div>

        {/* تنبيه الرصيد السالب */}
        {financialStats.balance < 0 && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="py-3">
              <p className="text-destructive font-semibold text-center">
                ⚠️ رصيدك سالب: {financialStats.balance.toLocaleString()} د.ع — سيتم تعويضه من الأرباح القادمة
              </p>
            </CardContent>
          </Card>
        )}

        {/* الصف الأول: رأس المال + الرصيد + المخزون */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {topRowCards.map((card, index) => (
            <StatCard key={index} {...card} />
          ))}
        </div>

        {/* الصف الثاني: تحليل + مصاريف + أرباح من الموظفين */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {profitCards.map((card, index) => (
            <StatCard key={index} {...card} />
          ))}
          {supervisedEmployeeIds.length > 0 && (
            <ManagerProfitsCard
              orders={myOrders}
              allUsers={allUsers || []}
              calculateProfit={calculateProfit}
              profits={supervisedEmployeeProfits || []}
              timePeriod={selectedTimePeriod}
            />
          )}
        </div>

        {/* صافي الربح + مستحقات الموظفين */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatCard
            title="صافي أرباح المبيعات"
            value={financialStats.netProfit}
            icon={PieChart}
            colors={['blue-500', 'sky-500']}
            format="currency"
            onClick={() => setDialogs(d => ({ ...d, profitLoss: true }))}
            description={`الفترة: ${selectedTimePeriod === 'all' ? 'كل الفترات' : selectedTimePeriod}`}
          />
          {supervisedEmployeeIds.length > 0 ? (
            <Card className="h-full">
              <CardHeader>
                <CardTitle>مستحقات الموظفين</CardTitle>
                <CardDescription>موظفين تحت إشرافك</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col justify-center gap-4">
                <Button variant="outline" className="w-full" onClick={() => setDialogs(d => ({ ...d, settledDues: true }))}>
                  <span>المستحقات المدفوعة:</span>
                  <span className="font-bold mr-2">{(financialStats.employeeSettledDues || 0).toLocaleString()} د.ع</span>
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setDialogs(d => ({ ...d, pendingDues: true }))}>
                  <Hourglass className="w-4 h-4 ml-2 text-amber-500" />
                  <span>المستحقات المعلقة:</span>
                  <span className="font-bold mr-2">{(financialStats.employeePendingDues || 0).toLocaleString()} د.ع</span>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center py-8">
                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">لا يوجد موظفين تحت إشرافك</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* الأداء المالي + تقرير الأرباح والخسائر */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <FinancialPerformanceCard
              unifiedProfitData={unifiedProfitData}
              selectedTimePeriod={selectedTimePeriod}
              onTimePeriodChange={setSelectedTimePeriod}
            />
          </div>
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>تقرير الأرباح والخسائر</CardTitle>
                <CardDescription>ملخص مالي للفترة المحددة</CardDescription>
              </CardHeader>
              <CardContent>
                <StatRow label="إجمالي المبيعات" value={financialStats.totalRevenue} colorClass="text-green-500" />
                <StatRow label="تكلفة البضاعة المباعة" value={financialStats.cogs} colorClass="text-orange-500" isNegative />
                <StatRow label="مجمل الربح" value={financialStats.grossProfit} colorClass="text-blue-500 font-bold" />
                <StatRow label="المصاريف العامة" value={financialStats.generalExpenses} colorClass="text-red-500" isNegative />
                <StatRow label="المستحقات المدفوعة" value={financialStats.employeeSettledDues} colorClass="text-purple-500" isNegative />
                <div className="flex justify-between items-center py-3 mt-2 bg-secondary rounded-lg px-4">
                  <p className="font-bold text-lg">صافي الربح</p>
                  <p className={`font-bold text-lg ${financialStats.netProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {financialStats.netProfit.toLocaleString()} د.ع
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* آخر حركات القاصة */}
        <Card>
          <CardHeader>
            <CardTitle>آخر حركات القاصة</CardTitle>
            <CardDescription>حركات القاصة الخاصة بك</CardDescription>
          </CardHeader>
          <CardContent>
            {cashMovements.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد حركات بعد</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {cashMovements
                  .filter(m => filterByDate(m.created_at))
                  .slice(0, 50)
                  .map((m) => (
                  <div key={m.id} className="flex justify-between items-center py-2 px-3 rounded-lg bg-secondary/30 border border-border/30">
                    <div>
                      <p className="text-sm font-medium">{m.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.created_at ? format(parseISO(m.created_at), 'dd/MM/yyyy HH:mm', { locale: ar }) : ''}
                      </p>
                      {m.reference_type && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {m.reference_type === 'order' ? 'طلب' :
                           m.reference_type === 'expense' ? 'مصروف' :
                           m.reference_type === 'purchase' ? 'شراء' :
                           m.reference_type === 'capital_injection' ? 'إضافة رأس مال' :
                           m.reference_type === 'capital_withdrawal' ? 'سحب' :
                           m.reference_type}
                        </Badge>
                      )}
                    </div>
                    <div className="text-left">
                      <p className={`font-bold ${m.movement_type === 'in' ? 'text-green-500' : 'text-red-500'}`}>
                        {m.movement_type === 'in' ? '+' : '-'}{Number(m.amount).toLocaleString()} د.ع
                      </p>
                      <p className="text-xs text-muted-foreground">
                        الرصيد: {Number(m.balance_after).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
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
        invoices={settlementInvoices?.filter(inv =>
          supervisedEmployeeIds.includes(inv.employee_id)
        )}
        allUsers={allUsers}
        profits={supervisedEmployeeProfits}
        orders={myOrders}
        timePeriod={selectedTimePeriod}
      />
      <PendingDuesDialog
        open={dialogs.pendingDues}
        onOpenChange={(open) => setDialogs(d => ({ ...d, pendingDues: open }))}
        orders={myOrders}
        allUsers={allUsers}
        allProfits={supervisedEmployeeProfits}
      />
      <ProfitLossDialog
        open={dialogs.profitLoss}
        onOpenChange={(open) => setDialogs(d => ({ ...d, profitLoss: open }))}
        summary={unifiedProfitData}
        datePeriod={selectedTimePeriod}
        onDatePeriodChange={setSelectedTimePeriod}
      />
      <EditCapitalDialog
        open={dialogs.capital}
        onOpenChange={(open) => setDialogs(d => ({ ...d, capital: open }))}
        currentCapital={initialCapital}
        onSave={(v) => setInitialCapital(v)}
        cashSourceId={employeeCashSource?.id}
      />
    </>
  );
};

export default EmployeeFinancialCenterPage;
