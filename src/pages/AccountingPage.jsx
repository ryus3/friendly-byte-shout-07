import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Edit, BarChart, TrendingUp, TrendingDown, Wallet, Box, User, Users, Banknote, Coins as HandCoins, Hourglass, CheckCircle, PieChart } from 'lucide-react';
import { format, parseISO, isValid, startOfMonth, endOfMonth, startOfWeek, startOfYear, subDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from '@/components/ui/use-toast';
import { PDFDownloadLink } from '@react-pdf/renderer';
import StatCard from '@/components/dashboard/StatCard';
import MiniChart from '@/components/dashboard/MiniChart';
import FinancialReportPDF from '@/components/pdf/FinancialReportPDF';
import { useNavigate } from 'react-router-dom';
import ExpensesDialog from '@/components/accounting/ExpensesDialog';
import SettledDuesDialog from '@/components/accounting/SettledDuesDialog';
import PendingDuesDialog from '@/components/accounting/PendingDuesDialog';
import ProfitLossDialog from '@/components/accounting/ProfitLossDialog';

// حساب صافي الأرباح الموحد
const useNetProfitCalculator = (orders, accounting, products, period = 'month') => {
  return useMemo(() => {
    const now = new Date();
    let from, to;
    
    switch (period) {
      case 'today': 
        from = subDays(now, 1); 
        to = now; 
        break;
      case 'week': 
        from = startOfWeek(now, { weekStartsOn: 1 }); 
        to = now; 
        break;
      case 'year': 
        from = startOfYear(now); 
        to = now; 
        break;
      default: 
        from = startOfMonth(now); 
        to = endOfMonth(now); 
        break;
    }

    if (!orders || !accounting || !products) {
      return { 
        netProfit: 0, 
        totalRevenue: 0, 
        totalExpenses: 0, 
        grossProfit: 0, 
        deliveredOrders: [],
        salesWithoutDelivery: 0,
        cogs: 0,
        generalExpenses: 0,
        employeeSettledDues: 0,
        deliveryFees: 0
      };
    }
    
    const filterByDate = (itemDateStr) => {
      if (!from || !to || !itemDateStr) return true;
      const itemDate = parseISO(itemDateStr);
      return isValid(itemDate) && itemDate >= from && itemDate <= to;
    };
    
    // الطلبات المُوصلة والمُستلمة الفواتير فقط (الحساب الدقيق)
    const deliveredOrders = (orders || []).filter(o => 
      o.status === 'delivered' && 
      o.receipt_received === true && 
      filterByDate(o.updated_at || o.created_at)
    );
    
    const expensesInRange = (accounting.expenses || []).filter(e => filterByDate(e.transaction_date));
    
    // حساب الإيرادات
    const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.final_amount || o.total_amount || 0), 0);
    const deliveryFees = deliveredOrders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0);
    const salesWithoutDelivery = totalRevenue - deliveryFees;
    
    // حساب تكلفة البضاعة المُباعة
    const cogs = deliveredOrders.reduce((sum, o) => {
      const orderCogs = (o.items || []).reduce((itemSum, item) => {
        const costPrice = item.costPrice || item.cost_price || 0;
        return itemSum + (costPrice * item.quantity);
      }, 0);
      return sum + orderCogs;
    }, 0);
    
    const grossProfit = salesWithoutDelivery - cogs;
    
    // حساب المصاريف
    const generalExpenses = expensesInRange
      .filter(e => e.related_data?.category !== 'مستحقات الموظفين')
      .reduce((sum, e) => sum + e.amount, 0);
    const employeeSettledDues = expensesInRange
      .filter(e => e.related_data?.category === 'مستحقات الموظفين')
      .reduce((sum, e) => sum + e.amount, 0);
    const totalExpenses = generalExpenses + employeeSettledDues;
    
    // صافي الأرباح
    const netProfit = grossProfit - totalExpenses;
    
    return { 
      netProfit, 
      totalRevenue, 
      totalExpenses, 
      grossProfit, 
      deliveredOrders,
      salesWithoutDelivery,
      cogs,
      generalExpenses,
      employeeSettledDues,
      deliveryFees
    };
  }, [orders, accounting, products, period]);
};

// مكونات فرعية
const StatRow = ({ label, value, colorClass = "text-green-600", isNegative = false, onClick }) => (
    <div className="flex justify-between items-center p-3 hover:bg-accent/50 rounded-lg transition-colors cursor-pointer" onClick={onClick}>
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className={`text-sm font-semibold ${isNegative ? 'text-red-600' : colorClass}`}>
            {isNegative && value > 0 ? '-' : ''}{Math.abs(value).toLocaleString()} د.ع
        </span>
    </div>
);

const EditCapitalDialog = ({ open, onOpenChange, currentCapital, onSave }) => {
    const [capital, setCapital] = useState(currentCapital);

    const handleSave = () => {
        onSave(Number(capital));
        onOpenChange(false);
    };

    return (
        <div className={`fixed inset-0 z-50 ${open ? 'block' : 'hidden'}`}>
            <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
            <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-96">
                <h3 className="text-lg font-semibold mb-4">تعديل رأس المال</h3>
                <input
                    type="number"
                    value={capital}
                    onChange={(e) => setCapital(e.target.value)}
                    className="w-full p-2 border rounded-lg mb-4"
                    placeholder="أدخل رأس المال الجديد"
                />
                <div className="flex gap-2">
                    <Button onClick={handleSave}>حفظ</Button>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
                </div>
            </div>
        </div>
    );
};

const AccountingPage = () => {
    const { orders, purchases, accounting, products, addExpense, deleteExpense, updateCapital, settlementInvoices, calculateManagerProfit, calculateProfit } = useInventory();
    const { user: currentUser, allUsers } = useAuth();
    const { hasPermission } = usePermissions();
    const navigate = useNavigate();
    
    const [datePeriod, setDatePeriod] = useState('month');
    const [dialogs, setDialogs] = useState({ expenses: false, capital: false, settledDues: false, pendingDues: false, profitLoss: false });

    const dateRange = useMemo(() => {
        const now = new Date();
        switch (datePeriod) {
            case 'today': return { from: subDays(now, 1), to: now };
            case 'week': return { from: startOfWeek(now, { weekStartsOn: 1 }), to: now };
            case 'year': return { from: startOfYear(now), to: now };
            case 'month':
            default:
                return { from: startOfMonth(now), to: endOfMonth(now) };
        }
    }, [datePeriod]);

    // استخدام حاسبة الأرباح الموحدة  
    const netProfitData = useNetProfitCalculator(orders, accounting, products, datePeriod);

    const financialSummary = useMemo(() => {
        const { from, to } = dateRange;
        
        // تحقق من وجود البيانات الأساسية
        if (!orders || !Array.isArray(orders)) {
            console.warn('⚠️ لا توجد بيانات طلبات، orders:', orders);
            return {
                ...netProfitData,
                inventoryValue: 0, myProfit: 0, managerProfitFromEmployees: 0, 
                employeePendingDues: 0, employeeSettledDues: 0, chartData: [], 
                filteredExpenses: [], employeePendingDuesDetails: [], cashOnHand: 0
            };
        }
        
        const safeOrders = Array.isArray(orders) ? orders : [];
        const safeExpenses = Array.isArray(accounting?.expenses) ? accounting.expenses : [];
        
        console.log('🔥 === تشخيص البيانات المالية ===');
        console.log('📊 إجمالي الطلبات:', safeOrders.length);
        console.log('📊 صافي الربح الموحد:', netProfitData.netProfit);
        
        const filterByDate = (itemDateStr) => {
            if (!from || !to || !itemDateStr) return true;
            try {
                const itemDate = parseISO(itemDateStr);
                return isValid(itemDate) && itemDate >= from && itemDate <= to;
            } catch (e) {
                return false;
            }
        };
        
        const expensesInRange = safeExpenses.filter(e => filterByDate(e.transaction_date));
        
        // حساب قيمة المخزون
        const inventoryValue = (products || []).reduce((sum, product) => {
            if (!product?.variants) return sum;
            return sum + product.variants.reduce((variantSum, variant) => {
                const quantity = variant.inventory?.quantity || 0;
                const costPrice = variant.cost_price || product.cost_price || 0;
                return variantSum + (quantity * costPrice);
            }, 0);
        }, 0);
        
        console.log('🏪 قيمة المخزون:', inventoryValue);
        
        // حساب مبيعات وأرباح المدير (المُستلمة الفواتير فقط)
        const managerOrders = netProfitData.deliveredOrders.filter(o => o.created_by === currentUser?.id);
        console.log('👨‍💼 طلبات المدير المُستلمة:', managerOrders.length);
        
        const managerSales = managerOrders.reduce((sum, o) => {
            const orderTotal = o.final_amount || o.total_amount || 0;
            const deliveryFee = o.delivery_fee || 0;
            const salesAmount = orderTotal - deliveryFee;
            return sum + salesAmount;
        }, 0);
        
        // حساب أرباح المدير بشكل مبسط (سعر البيع - التكلفة)
        const myProfit = managerOrders.reduce((sum, o) => {
            if (!o.order_items || !Array.isArray(o.order_items)) return sum;
            
            const orderProfit = o.order_items.reduce((itemSum, item) => {
                const sellPrice = item.unit_price || 0;
                const costPrice = item.product_variants?.cost_price || item.products?.cost_price || 0;
                const quantity = item.quantity || 0;
                const itemProfit = (sellPrice - costPrice) * quantity;
                return itemSum + Math.max(itemProfit, 0);
            }, 0);
            return sum + orderProfit;
        }, 0);

        // حساب مبيعات وأرباح الموظفين (المُستلمة الفواتير فقط)
        const employeeOrders = netProfitData.deliveredOrders.filter(o => {
            const orderUser = allUsers?.find(u => u.id === o.created_by);
            return orderUser && (orderUser.role === 'employee' || orderUser.role === 'deputy') && o.created_by !== currentUser?.id;
        });
        
        const employeeSales = employeeOrders.reduce((sum, o) => {
            const orderTotal = o.final_amount || o.total_amount || 0;
            const deliveryFee = o.delivery_fee || 0;
            return sum + (orderTotal - deliveryFee);
        }, 0);
        
        // حساب أرباح المدير من الموظفين (نسبة من أرباحهم)
        const managerProfitFromEmployees = employeeOrders.reduce((sum, o) => {
            if (!o.order_items || !Array.isArray(o.order_items)) return sum;
            
            const orderTotalProfit = o.order_items.reduce((itemSum, item) => {
                const sellPrice = item.unit_price || 0;
                const costPrice = item.product_variants?.cost_price || item.products?.cost_price || 0;
                const quantity = item.quantity || 0;
                return itemSum + Math.max((sellPrice - costPrice) * quantity, 0);
            }, 0);
            
            // افتراض أن المدير يحصل على 30% من أرباح الموظفين
            return sum + (orderTotalProfit * 0.3);
        }, 0);
        
        const totalProfit = myProfit + managerProfitFromEmployees;
    
        const employeePendingDuesDetails = safeOrders
          .filter(o => o.status === 'delivered' && (o.profitStatus || 'pending') === 'pending' && o.created_by !== currentUser?.id);
        
        const employeePendingDues = employeePendingDuesDetails.reduce((sum, o) => sum + ((o.items || []).reduce((itemSum, item) => itemSum + calculateProfit(item, o.created_by), 0) || 0), 0);
    
        // حساب القاصة الحقيقية: رأس المال + صافي الأرباح المُحققة
        const cashOnHand = (accounting?.capital || 0) + netProfitData.netProfit;
    
        const salesByDay = {};
        netProfitData.deliveredOrders.forEach(o => {
            const day = format(parseISO(o.updated_at || o.created_at), 'dd');
            if (!salesByDay[day]) salesByDay[day] = 0;
            // استخدام final_amount للمبيعات اليومية
            salesByDay[day] += o.final_amount || o.total_amount || 0;
        });
        
        const expensesByDay = {};
        expensesInRange.forEach(e => {
            const day = format(parseISO(e.transaction_date), 'dd');
            if (!expensesByDay[day]) expensesByDay[day] = 0;
            expensesByDay[day] += e.amount;
        });
    
        const allDays = [...new Set([...Object.keys(salesByDay), ...Object.keys(expensesByDay)])].sort();
        
        const chartData = allDays.map(day => ({
            name: day,
            sales: salesByDay[day] || 0,
            expenses: expensesByDay[day] || 0,
            net: (salesByDay[day] || 0) - (expensesByDay[day] || 0)
        }));
    
        return { 
            ...netProfitData,
            totalProfit, 
            inventoryValue, 
            myProfit, 
            managerProfitFromEmployees, 
            managerSales, 
            employeeSales, 
            employeePendingDues, 
            employeeSettledDues: netProfitData.employeeSettledDues, 
            cashOnHand, 
            chartData, 
            filteredExpenses: expensesInRange, 
            employeePendingDuesDetails 
        };
    }, [dateRange, orders, purchases, accounting, products, currentUser?.id, allUsers, calculateManagerProfit, calculateProfit, netProfitData]);

    const topRowCards = [
        { key: 'capital', title: "رأس المال", value: accounting?.capital || 0, icon: Banknote, colors: ['slate-500', 'gray-600'], format: "currency", onEdit: () => setDialogs(d => ({ ...d, capital: true })) },
        { key: 'cash', title: "الرصيد الحقيقي", value: financialSummary.cashOnHand, icon: Wallet, colors: ['sky-500', 'blue-500'], format: "currency", onClick: () => navigate('/cash-management') },
        { key: 'inventory', title: "قيمة المخزون", value: financialSummary.inventoryValue, icon: Box, colors: ['emerald-500', 'green-500'], format: "currency", onClick: () => navigate('/inventory') },
    ];

    const profitCards = [
        { key: 'myProfit', title: "أرباحي", value: financialSummary.myProfit, icon: User, colors: ['rose-500', 'red-500'], format: 'currency', onClick: () => navigate('/profits-summary') },
        { key: 'employeeProfit', title: "أرباح من الموظفين", value: financialSummary.managerProfitFromEmployees, icon: Users, colors: ['fuchsia-500', 'purple-500'], format: 'currency', onClick: () => navigate('/employee-follow-up') },
        { key: 'generalExpenses', title: "المصاريف العامة", value: financialSummary.generalExpenses, icon: TrendingDown, colors:['red-500', 'orange-500'], format:'currency', onClick: () => setDialogs(d => ({...d, expenses: true}))},
        { key: 'netProfit', title: "صافي الأرباح", value: financialSummary.netProfit, icon: PieChart, colors: financialSummary.netProfit >= 0 ? ['green-500', 'emerald-500'] : ['red-500', 'orange-500'], format: 'currency', onClick: () => setDialogs(d => ({ ...d, profitLoss: true })) },
    ];

    return (
        <>
            <Helmet><title>المركز المالي - RYUS</title></Helmet>
            <div className="container mx-auto px-4 py-6 space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">المركز المالي</h1>
                    <div className="flex items-center gap-4">
                        <PDFDownloadLink
                            document={<FinancialReportPDF summary={financialSummary} dateRange={dateRange} />}
                            fileName={`financial-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`}
                        >
                            <Button size="sm" className="gap-2">
                                <FileText className="w-4 h-4" />
                                تحميل التقرير
                            </Button>
                        </PDFDownloadLink>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                    {topRowCards.map((card, index) => (
                        <StatCard key={index} {...card} />
                    ))}
                </div>

                 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {profitCards.map((card, index) => (
                        <StatCard key={index} {...card} />
                    ))}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <HandCoins className="w-5 h-5 text-blue-500" />
                                مستحقات الموظفين
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3">
                                <StatRow
                                    label="المستحقات المدفوعة"
                                    value={financialSummary.employeeSettledDues || 0}
                                    colorClass="text-green-600"
                                    onClick={() => setDialogs(d => ({ ...d, settledDues: true }))}
                                />
                                <StatRow
                                    label="المستحقات المعلقة"
                                    value={financialSummary.employeePendingDues || 0}
                                    colorClass="text-orange-600"
                                    onClick={() => setDialogs(d => ({ ...d, pendingDues: true }))}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart className="w-5 h-5 text-blue-500" />
                                الأداء المالي
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-64">
                                <MiniChart data={financialSummary.chartData} type="bar" colors={['#3b82f6', '#ef4444']} />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Dialogs */}
                <ExpensesDialog open={dialogs.expenses} onOpenChange={(open) => setDialogs(d => ({...d, expenses: open}))} />
                <EditCapitalDialog open={dialogs.capital} onOpenChange={(open) => setDialogs(d => ({...d, capital: open}))} currentCapital={accounting?.capital || 0} onSave={updateCapital} />
                <SettledDuesDialog open={dialogs.settledDues} onOpenChange={(open) => setDialogs(d => ({...d, settledDues: open}))} />
                <PendingDuesDialog open={dialogs.pendingDues} onOpenChange={(open) => setDialogs(d => ({...d, pendingDues: open}))} orders={financialSummary.employeePendingDuesDetails} />
                <ProfitLossDialog open={dialogs.profitLoss} onOpenChange={(open) => setDialogs(d => ({...d, profitLoss: open}))} summary={financialSummary} />
            </div>
        </>
    );
};

export default AccountingPage;