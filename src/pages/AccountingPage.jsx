import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ProfitLossDialog from '@/components/accounting/ProfitLossDialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const StatRow = ({ label, value, colorClass, isNegative = false, onClick }) => (
    <div className={`flex justify-between items-center py-3 border-b border-border/50 ${onClick ? 'cursor-pointer hover:bg-secondary/50 -mx-4 px-4' : ''}`} onClick={onClick}>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`font-semibold text-base ${colorClass}`}>
            {isNegative ? `(${value.toLocaleString()})` : value.toLocaleString()} د.ع
        </p>
    </div>
);

const EditCapitalDialog = ({ open, onOpenChange, currentCapital, onSave }) => {
    const [newCapital, setNewCapital] = useState(currentCapital);

    useEffect(() => {
        setNewCapital(currentCapital);
    }, [currentCapital, open]);

    const handleSave = () => {
        const capitalValue = parseFloat(newCapital);
        if (isNaN(capitalValue)) {
            toast({ title: "خطأ", description: "الرجاء إدخال مبلغ صحيح.", variant: "destructive" });
            return;
        }
        onSave(capitalValue);
        onOpenChange(false);
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>تعديل رأس المال</AlertDialogTitle>
                    <AlertDialogDescription>
                        أدخل القيمة الجديدة لرأس المال. سيؤثر هذا على حسابات "المبلغ في القاصة".
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                    <Label htmlFor="capital-input">رأس المال (د.ع)</Label>
                    <Input
                        id="capital-input"
                        type="number"
                        value={newCapital}
                        onChange={(e) => setNewCapital(e.target.value)}
                        placeholder="أدخل رأس المال"
                    />
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSave}>حفظ التغييرات</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

const AccountingPage = () => {
    const { orders, purchases, accounting, products, addExpense, deleteExpense, updateCapital, settlementInvoices, calculateManagerProfit, calculateProfit } = useInventory();
    const { user: currentUser, allUsers } = useAuth();
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

    const financialSummary = useMemo(() => {
        const { from, to } = dateRange;
        if (!orders || !purchases || !accounting || !products || !Array.isArray(orders) || !Array.isArray(products)) return {
            totalRevenue: 0, cogs: 0, grossProfit: 0, totalExpenses: 0, netProfit: 0,
            inventoryValue: 0, myProfit: 0, managerProfitFromEmployees: 0, employeePendingDues: 0, employeeSettledDues: 0,
            chartData: [], filteredExpenses: [], deliveredOrders: [], employeePendingDuesDetails: []
        };
        
        const safeOrders = Array.isArray(orders) ? orders : [];
        const safeExpenses = Array.isArray(accounting?.expenses) ? accounting.expenses : [];
        
        const filterByDate = (itemDateStr) => {
            if (!from || !to || !itemDateStr) return true;
            try {
                const itemDate = parseISO(itemDateStr);
                return isValid(itemDate) && itemDate >= from && itemDate <= to;
            } catch (e) {
                return false;
            }
        };
        
        const deliveredOrders = safeOrders.filter(o => o.status === 'delivered' && filterByDate(o.updated_at || o.created_at));
        const expensesInRange = safeExpenses.filter(e => filterByDate(e.transaction_date));
        
        const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
        const cogs = deliveredOrders.reduce((sum, o) => {
            return sum + (o.items || []).reduce((itemSum, item) => itemSum + ((item.costPrice || 0) * item.quantity), 0);
        }, 0);
        const grossProfit = totalRevenue - cogs;
        
        const generalExpenses = expensesInRange.filter(e => e.related_data?.category !== 'مستحقات الموظفين').reduce((sum, e) => sum + (e.amount || 0), 0);
        const employeeSettledDues = expensesInRange.filter(e => e.related_data?.category === 'مستحقات الموظفين').reduce((sum, e) => sum + (e.amount || 0), 0);
        
        const totalExpenses = generalExpenses + employeeSettledDues;
        const netProfit = grossProfit - totalExpenses;
    
        // حساب قيمة المخزون على أساس سعر البيع (وليس التكلفة)
        const inventoryValue = Array.isArray(products) ? products.reduce((sum, p) => {
            return sum + (Array.isArray(p.variants) ? p.variants.reduce((variantSum, v) => variantSum + (v.quantity * (v.price || v.base_price || 0)), 0) : 0);
        }, 0) : 0;
        
        const myProfit = deliveredOrders.filter(o => o.created_by === currentUser?.id).reduce((sum, o) => {
            const orderProfit = (o.items || []).reduce((itemSum, item) => itemSum + calculateProfit(item, o.created_by), 0);
            return sum + orderProfit;
        }, 0);

        const managerProfitFromEmployees = deliveredOrders.filter(o => {
            const orderUser = allUsers?.find(u => u.id === o.created_by);
            return orderUser && (orderUser.role === 'employee' || orderUser.role === 'deputy');
        }).reduce((sum, o) => sum + (calculateManagerProfit(o) || 0), 0);
        
        const totalProfit = myProfit + managerProfitFromEmployees;
    
        const employeePendingDuesDetails = safeOrders
          .filter(o => o.status === 'delivered' && (o.profitStatus || 'pending') === 'pending' && o.created_by !== currentUser?.id);
        
        const employeePendingDues = employeePendingDuesDetails.reduce((sum, o) => sum + ((o.items || []).reduce((itemSum, item) => itemSum + calculateProfit(item, o.created_by), 0) || 0), 0);
    
        const cashOnHand = (accounting?.capital || 0) + netProfit;
    
        const salesByDay = {};
        deliveredOrders.forEach(o => {
          const day = format(parseISO(o.updated_at || o.created_at), 'dd');
          if (!salesByDay[day]) salesByDay[day] = 0;
          salesByDay[day] += o.total;
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
    
        return { totalRevenue, cogs, grossProfit, totalExpenses, netProfit, totalProfit, inventoryValue, myProfit, managerProfitFromEmployees, employeePendingDues, employeeSettledDues, cashOnHand, chartData, filteredExpenses: expensesInRange, generalExpenses, deliveredOrders, employeePendingDuesDetails };
    }, [dateRange, orders, purchases, accounting, products, currentUser?.id, allUsers, calculateManagerProfit, calculateProfit]);

    const topRowCards = [
        { key: 'capital', title: "رأس المال", value: accounting?.capital || 0, icon: Banknote, colors: ['slate-500', 'gray-600'], format: "currency", onEdit: () => setDialogs(d => ({ ...d, capital: true })) },
        { key: 'cash', title: "المبلغ في القاصة", value: financialSummary.cashOnHand, icon: Wallet, colors: ['sky-500', 'blue-500'], format: "currency" },
        { key: 'inventory', title: "قيمة المخزون", value: financialSummary.inventoryValue, icon: Box, colors: ['emerald-500', 'green-500'], format: "currency", onClick: () => navigate('/inventory') },
    ];
    
    const profitCards = [
        { key: 'myProfit', title: "أرباحي", value: financialSummary.myProfit, icon: User, colors: ['rose-500', 'red-500'], format: 'currency', onClick: () => navigate('/profits-summary') },
        { key: 'employeeProfit', title: "أرباح من الموظفين", value: financialSummary.managerProfitFromEmployees, icon: Users, colors: ['fuchsia-500', 'purple-500'], format: 'currency', onClick: () => navigate('/employee-follow-up') },
        { key: 'generalExpenses', title: "المصاريف العامة", value: financialSummary.generalExpenses, icon: TrendingDown, colors:['red-500', 'orange-500'], format:'currency', onClick: () => setDialogs(d => ({...d, expenses: true}))},
    ];

    return (
        <>
            <Helmet>
                <title>المركز المالي - نظام RYUS</title>
                <meta name="description" content="نظرة شاملة على الوضع المالي للمتجر." />
            </Helmet>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <h1 className="text-3xl font-bold gradient-text">المركز المالي</h1>
                    <div className="flex gap-2 flex-wrap">
                        <PDFDownloadLink
                            document={<FinancialReportPDF summary={financialSummary} dateRange={dateRange} />}
                            fileName={`financial-report-${new Date().toISOString().slice(0, 10)}.pdf`}
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {topRowCards.map((card, index) => (
                        <StatCard key={index} {...card} />
                    ))}
                </div>
                
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {profitCards.map((card, index) => (
                        <StatCard key={index} {...card} />
                    ))}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <StatCard 
                        title="صافي الربح" 
                        value={financialSummary.netProfit} 
                        icon={PieChart} 
                        colors={['blue-500', 'sky-500']} 
                        format="currency" 
                        onClick={() => setDialogs(d => ({...d, profitLoss: true}))}
                    />
                     <Card className="h-full">
                        <CardHeader>
                            <CardTitle>مستحقات الموظفين</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col justify-center gap-4">
                            <Button variant="outline" className="w-full" onClick={() => setDialogs(d => ({...d, settledDues: true}))}>
                                <CheckCircle className="w-4 h-4 ml-2 text-green-500"/>
                                <span>المستحقات المدفوعة:</span>
                                <span className="font-bold mr-2">{financialSummary.employeeSettledDues.toLocaleString()} د.ع</span>
                            </Button>
                            <Button variant="outline" className="w-full" onClick={() => setDialogs(d => ({...d, pendingDues: true}))}>
                                <Hourglass className="w-4 h-4 ml-2 text-amber-500"/>
                                <span>المستحقات المعلقة:</span>
                                <span className="font-bold mr-2">{financialSummary.employeePendingDues.toLocaleString()} د.ع</span>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><BarChart/> ملخص الأداء المالي</CardTitle>
                                <CardDescription>نظرة بيانية على الإيرادات، المصاريف، والأرباح الصافية</CardDescription>
                            </CardHeader>
                            <CardContent className="h-72">
                                <MiniChart data={financialSummary.chartData} type="bar" colors={['#3b82f6', '#ef4444']} />
                            </CardContent>
                        </Card>
                    </div>
                    <div className="lg:col-span-1">
                        <Card>
                            <CardHeader>
                                <CardTitle>تقرير الأرباح والخسائر</CardTitle>
                                <CardDescription>ملخص مالي للفترة المحددة</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <StatRow label="إجمالي المبيعات" value={financialSummary.totalRevenue} colorClass="text-green-500" />
                                <StatRow label="تكلفة البضاعة المباعة" value={financialSummary.cogs} colorClass="text-orange-500" isNegative/>
                                <StatRow label="مجمل الربح" value={financialSummary.grossProfit} colorClass="text-blue-500 font-bold" />
                                <StatRow label="إجمالي المصاريف" value={financialSummary.totalExpenses} colorClass="text-red-500" isNegative/>
                                <div className="flex justify-between items-center py-3 mt-2 bg-secondary rounded-lg px-4">
                                    <p className="font-bold text-lg">صافي الربح</p>
                                    <p className="font-bold text-lg text-primary">{financialSummary.netProfit.toLocaleString()} د.ع</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
            <ExpensesDialog
                open={dialogs.expenses}
                onOpenChange={(open) => setDialogs(d => ({ ...d, expenses: open }))}
                expenses={accounting?.expenses || []}
                addExpense={addExpense}
                deleteExpense={deleteExpense}
            />
            <EditCapitalDialog
                open={dialogs.capital}
                onOpenChange={(open) => setDialogs(d => ({ ...d, capital: open }))}
                currentCapital={accounting?.capital || 0}
                onSave={updateCapital}
            />
            <SettledDuesDialog
                open={dialogs.settledDues}
                onOpenChange={(open) => setDialogs(d => ({...d, settledDues: open}))}
                invoices={settlementInvoices}
                allUsers={allUsers}
            />
            <PendingDuesDialog
                open={dialogs.pendingDues}
                onOpenChange={(open) => setDialogs(d => ({...d, pendingDues: open}))}
                orders={financialSummary.employeePendingDuesDetails}
                allUsers={allUsers}
            />
            <ProfitLossDialog
                open={dialogs.profitLoss}
                onOpenChange={(open) => setDialogs(d => ({ ...d, profitLoss: open }))}
                summary={financialSummary}
                datePeriod={datePeriod}
                onDatePeriodChange={setDatePeriod}
            />
        </>
    );
};

export default AccountingPage;