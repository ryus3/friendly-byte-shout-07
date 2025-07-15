
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useProfits } from '@/contexts/ProfitsContext';
import { UserPlus, TrendingUp, DollarSign, PackageCheck, ShoppingCart, Users, Package, MapPin, User as UserIcon, Bot, Briefcase, TrendingDown, Hourglass, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/dashboard/StatCard';
import PendingRegistrations from '@/components/dashboard/PendingRegistrations';
import AiOrdersManager from '@/components/dashboard/AiOrdersManager';
import TopListCard from '@/components/dashboard/TopListCard';
import Loader from '@/components/ui/loader';
import { filterOrdersByPeriod, getTopCustomers, getTopProducts, getTopProvinces } from '@/lib/dashboard-helpers';
import WelcomeHeader from '@/components/dashboard/WelcomeHeader';
import SettlementRequestCard from '@/components/dashboard/SettlementRequestCard';
import StockAlertsCard from '@/components/dashboard/StockAlertsCard';
import StockMonitoringSystem from '@/components/dashboard/StockMonitoringSystem';
import RecentOrdersCard from '@/components/dashboard/RecentOrdersCard';
import { ArrowRight } from 'lucide-react';
import OrderList from '@/components/orders/OrderList';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import { startOfMonth, endOfMonth, parseISO, isValid, startOfWeek, startOfYear, subDays, format } from 'date-fns';
import ProfitLossDialog from '@/components/accounting/ProfitLossDialog';
import PendingProfitsDialog from '@/components/dashboard/PendingProfitsDialog';
import { supabase } from '@/lib/customSupabaseClient';

const SummaryDialog = ({ open, onClose, title, orders, onDetailsClick, periodLabel }) => {
    const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

    const handleViewOrder = useCallback((order) => {
        setSelectedOrderDetails(order);
        setIsDetailsDialogOpen(true);
    }, []);

    return (
        <>
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="max-w-4xl w-[95vw] sm:w-full">
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>
                            ملخص سريع للطلبات للفترة المحددة ({periodLabel}).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="h-[60vh] flex flex-col">
                        <OrderList
                            orders={orders}
                            isLoading={false}
                            onViewOrder={handleViewOrder}
                            isCompact={true}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={onClose}>إغلاق</Button>
                        <Button onClick={onDetailsClick}>
                            <ArrowRight className="ml-2 h-4 w-4" />
                            عرض كل التفاصيل
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <OrderDetailsDialog
                order={selectedOrderDetails}
                open={isDetailsDialogOpen}
                onOpenChange={setIsDetailsDialogOpen}
            />
        </>
    );
}

const Dashboard = () => {
    const { user, pendingRegistrations, hasPermission, allUsers } = useAuth();
    const { orders, aiOrders, loading: inventoryLoading, calculateProfit, calculateManagerProfit, accounting, products, settlementInvoices } = useInventory();
    const { profits } = useProfits();
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());

    const [periods, setPeriods] = useState({
        totalOrders: 'month',
        netProfit: 'month',
        pendingProfit: 'month',
        deliveredSales: 'month',
        pendingSales: 'month',
    });

    const [dialog, setDialog] = useState({ open: false, type: '', orders: [], periodLabel: '' });
    const [isProfitLossOpen, setIsProfitLossOpen] = useState(false);
    const [isPendingProfitsOpen, setIsPendingProfitsOpen] = useState(false);
    const [profitsData, setProfitsData] = useState({ pending: [], settled: [] });

    // جلب بيانات الأرباح من قاعدة البيانات
    const fetchProfitsData = useCallback(async () => {
        try {
            const { data: profitsData, error } = await supabase
                .from('profits')
                .select(`
                    *,
                    orders!inner (
                        id,
                        order_number,
                        tracking_number,
                        customer_name,
                        status,
                        created_at,
                        total_amount,
                        delivery_fee
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching profits:', error);
                return { pending: [], settled: [] };
            }

            const pending = profitsData?.filter(p => p.status === 'pending') || [];
            const settled = profitsData?.filter(p => p.status === 'settled') || [];

            setProfitsData({ pending, settled });
            return { pending, settled };
        } catch (error) {
            console.error('Error in fetchProfitsData:', error);
            return { pending: [], settled: [] };
        }
    }, []);

    // تحديث بيانات الأرباح عند تحميل الصفحة
    useEffect(() => {
        fetchProfitsData();
    }, [fetchProfitsData]);

    const openSummaryDialog = useCallback((type, filteredOrders, periodKey) => {
        const periodLabels = {
            today: 'اليوم', week: 'آخر أسبوع', month: 'آخر شهر', year: 'آخر سنة', all: 'كل الوقت'
        };
        setDialog({
            open: true,
            type: type,
            orders: filteredOrders,
            periodLabel: periodLabels[periods[periodKey]]
        });
    }, [periods]);
    
    const handleDialogDetailsClick = useCallback((type) => {
        const dateRange = filterOrdersByPeriod([], periods.totalOrders, true);
        const query = new URLSearchParams();
        if(dateRange.from) query.set('from', dateRange.from.toISOString().split('T')[0]);
        if(dateRange.to) query.set('to', dateRange.to.toISOString().split('T')[0]);

        switch (type) {
            case 'pendingProfit':
                query.set('profitStatus', 'pending');
                navigate(`/profits-summary?${query.toString()}`);
                break;
            case 'deliveredSales':
                query.set('status', 'delivered');
                navigate(`/my-orders?${query.toString()}`);
                break;
        case 'pendingSales':
                query.set('status', 'shipped');
                navigate(`/my-orders?${query.toString()}`);
                break;
            case 'netProfit':
                navigate('/accounting');
                break;
        }
        setDialog({ open: false, type: '', orders: [] });
    }, [navigate, periods.totalOrders]);

    const [dialogs, setDialogs] = useState({
        pendingRegs: false,
        aiOrders: false,
    });

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const visibleOrders = useMemo(() => {
        if (!orders) return [];
        if (hasPermission('view_all_orders')) return orders;
        return orders.filter(o => o.created_by === user.id);
    }, [orders, user, hasPermission]);
    
    const userAiOrders = useMemo(() => (aiOrders || []).filter(o => o.created_by === user.id), [aiOrders, user.id]);
    const pendingRegistrationsCount = useMemo(() => pendingRegistrations?.length || 0, [pendingRegistrations]);

    const financialSummary = useMemo(() => {
        const periodKey = periods.netProfit;
        const now = new Date();
        let from, to;
        switch (periodKey) {
            case 'today': from = subDays(now, 1); to = now; break;
            case 'week': from = startOfWeek(now, { weekStartsOn: 1 }); to = now; break;
            case 'year': from = startOfYear(now); to = now; break;
            default: from = startOfMonth(now); to = endOfMonth(now); break;
        }

        if (!orders || !accounting || !products) return { netProfit: 0, chartData: [], deliveredOrders: [] };
        
        const filterByDate = (itemDateStr) => {
            if (!from || !to || !itemDateStr) return true;
            const itemDate = parseISO(itemDateStr);
            return isValid(itemDate) && itemDate >= from && itemDate <= to;
        };
        
        const deliveredOrders = (orders || []).filter(o => o.status === 'delivered' && filterByDate(o.updated_at || o.created_at));
        const expensesInRange = (accounting.expenses || []).filter(e => filterByDate(e.transaction_date));
        
        const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
        const cogs = deliveredOrders.reduce((sum, o) => sum + ((o.items || []).reduce((itemSum, item) => itemSum + ((item.costPrice || 0) * item.quantity), 0)), 0);
        const grossProfit = totalRevenue - cogs;
        const generalExpenses = expensesInRange.filter(e => e.related_data?.category !== 'مستحقات الموظفين').reduce((sum, e) => sum + e.amount, 0);
        const employeeSettledDues = expensesInRange.filter(e => e.related_data?.category === 'مستحقات الموظفين').reduce((sum, e) => sum + e.amount, 0);
        const totalExpenses = generalExpenses + employeeSettledDues;
        const netProfit = grossProfit - totalExpenses;
        
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

        return { totalRevenue, cogs, grossProfit, totalExpenses, employeeSettledDues, generalExpenses, netProfit, chartData, filteredExpenses: expensesInRange, deliveredOrders };
    }, [periods.netProfit, orders, accounting, products]);

    const dashboardData = useMemo(() => {
        if (!visibleOrders || !allUsers) return {};

        const filteredTotalOrders = filterOrdersByPeriod(visibleOrders, periods.totalOrders);
        const deliveredOrders = (orders || []).filter(o => o.status === 'delivered');
        
        // حساب الأرباح المعلقة من جدول profits في قاعدة البيانات
        let pendingProfits = profitsData.pending || [];
        let settledProfits = profitsData.settled || [];
        
        // إذا لم يكن لديه صلاحية رؤية كل الأرباح، فلتر حسب المستخدم
        if (!hasPermission('view_all_orders')) {
            pendingProfits = pendingProfits.filter(p => p.employee_id === user.id);
            settledProfits = settledProfits.filter(p => p.employee_id === user.id);
        }
        
        // حساب الأرباح المعلقة لفترة معينة
        const filteredPendingProfits = pendingProfits.filter(p => {
            const profitDate = parseISO(p.created_at);
            const dateRange = filterOrdersByPeriod([], periods.pendingProfit, true);
            return (!dateRange.from || profitDate >= dateRange.from) && 
                   (!dateRange.to || profitDate <= dateRange.to);
        });
        
        const pendingProfit = filteredPendingProfits.reduce((sum, p) => sum + (p.employee_profit || 0), 0);
        
        // حساب المبيعات المستلمة (بدون رسوم التوصيل)
        const deliveredSalesOrders = filterOrdersByPeriod(deliveredOrders, periods.deliveredSales);
        const deliveredSales = deliveredSalesOrders.reduce((sum, o) => sum + (o.total_amount - (o.delivery_fee || 0)), 0);

        // حساب المبيعات المعلقة (الطلبات المشحونة فقط)
        const shippedOrders = visibleOrders.filter(o => o.status === 'shipped');
        const pendingSalesOrders = filterOrdersByPeriod(shippedOrders, periods.pendingSales);
        const pendingSales = pendingSalesOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

        return {
            totalOrdersCount: filteredTotalOrders.length,
            netProfit: financialSummary.netProfit,
            pendingProfit,
            deliveredSales,
            pendingSales,
            pendingProfitOrders: filteredPendingProfits,
            deliveredSalesOrders,
            pendingSalesOrders,
            topCustomers: getTopCustomers(visibleOrders),
            topProvinces: getTopProvinces(visibleOrders),
            topProducts: getTopProducts(visibleOrders),
        };
    }, [visibleOrders, orders, allUsers, periods, user.id, hasPermission, calculateProfit, financialSummary, profitsData]);

    const handlePeriodChange = useCallback((cardKey, period) => {
        setPeriods(prev => ({ ...prev, [cardKey]: period }));
    }, []);

    const handleTotalOrdersClick = useCallback(() => {
        const dateRange = filterOrdersByPeriod([], periods.totalOrders, true);
        const query = new URLSearchParams();
        if (dateRange.from) query.set('from', dateRange.from.toISOString().split('T')[0]);
        if (dateRange.to) query.set('to', dateRange.to.toISOString().split('T')[0]);
        navigate(`/my-orders?${query.toString()}`);
    }, [navigate, periods.totalOrders]);

    if (inventoryLoading) return <div className="flex h-full w-full items-center justify-center"><Loader /></div>;

    const allStatCards = [
        hasPermission('use_ai_assistant') && { 
            key: 'aiOrders', title: 'طلبات الذكاء الاصطناعي', value: (hasPermission('view_all_orders') ? aiOrders?.length : userAiOrders?.length) || 0, icon: Bot, colors: ['blue-500', 'sky-500'], onClick: () => setDialogs(d => ({ ...d, aiOrders: true })) 
        },
        hasPermission('manage_users') && { 
            key: 'pendingRegs', title: 'طلبات التسجيل الجديدة', value: pendingRegistrationsCount, icon: UserPlus, colors: ['indigo-500', 'violet-500'], onClick: () => setDialogs(d => ({ ...d, pendingRegs: true }))
        },
        hasPermission('view_all_orders') && { 
            key: 'employeeFollowUp', title: 'متابعة الموظفين', value: 'عرض', icon: Briefcase, colors: ['teal-500', 'cyan-500'], format: 'text', onClick: () => navigate('/employee-follow-up')
        },
        hasPermission('view_orders') && { 
            key: 'totalOrders', title: 'اجمالي الطلبات', value: dashboardData.totalOrdersCount, icon: ShoppingCart, colors: ['blue-500', 'sky-500'], format: 'number', currentPeriod: periods.totalOrders, onPeriodChange: (p) => handlePeriodChange('totalOrders', p), onClick: handleTotalOrdersClick
        },
        hasPermission('view_profits') && {
            key: 'netProfit', title: 'صافي الارباح', value: dashboardData.netProfit, icon: DollarSign, colors: ['green-500', 'emerald-500'], format: 'currency', currentPeriod: periods.netProfit, onPeriodChange: (p) => handlePeriodChange('netProfit', p), onClick: () => setIsProfitLossOpen(true)
        },
        hasPermission('view_profits') && {
            key: 'pendingProfit', title: 'الارباح المعلقة', value: dashboardData.pendingProfit, icon: Hourglass, colors: ['yellow-500', 'amber-500'], format: 'currency', currentPeriod: periods.pendingProfit, onPeriodChange: (p) => handlePeriodChange('pendingProfit', p), onClick: () => setIsPendingProfitsOpen(true)
        },
        hasPermission('view_orders') && {
            key: 'deliveredSales', title: 'المبيعات المستلمة', value: dashboardData.deliveredSales, icon: CheckCircle, colors: ['purple-500', 'violet-500'], format: 'currency', currentPeriod: periods.deliveredSales, onPeriodChange: (p) => handlePeriodChange('deliveredSales', p), onClick: () => openSummaryDialog('deliveredSales', dashboardData.deliveredSalesOrders, 'deliveredSales')
        },
        hasPermission('view_orders') && {
            key: 'pendingSales', title: 'المبيعات المعلقة', value: dashboardData.pendingSales, icon: PackageCheck, colors: ['orange-500', 'red-500'], format: 'currency', currentPeriod: periods.pendingSales, onPeriodChange: (p) => handlePeriodChange('pendingSales', p), onClick: () => openSummaryDialog('pendingSales', dashboardData.pendingSalesOrders, 'pendingSales')
        },
    ].filter(Boolean);


    return (
        <>
            <Helmet><title>لوحة التحكم - RYUS</title></Helmet>
            <AnimatePresence>
                {dialogs.pendingRegs && <PendingRegistrations onClose={() => setDialogs(d => ({ ...d, pendingRegs: false }))} />}
                {dialogs.aiOrders && <AiOrdersManager onClose={() => setDialogs(d => ({ ...d, aiOrders: false }))} />}
                {dialog.open && (
                    <SummaryDialog
                        open={dialog.open}
                        onClose={() => setDialog({ open: false, type: '', orders: [] })}
                        title={{
                            pendingProfit: 'الطلبات ذات الأرباح المعلقة',
                            deliveredSales: 'الطلبات المسلمة',
                            pendingSales: 'الطلبات قيد الشحن',
                        }[dialog.type]}
                        orders={dialog.orders}
                        periodLabel={dialog.periodLabel}
                        onDetailsClick={() => handleDialogDetailsClick(dialog.type)}
                    />
                )}
                {isProfitLossOpen && (
                    <ProfitLossDialog
                        open={isProfitLossOpen}
                        onOpenChange={setIsProfitLossOpen}
                        summary={financialSummary}
                        datePeriod={periods.netProfit}
                        onDatePeriodChange={(p) => handlePeriodChange('netProfit', p)}
                    />
                )}
                {isPendingProfitsOpen && (
                    <PendingProfitsDialog
                        open={isPendingProfitsOpen}
                        onClose={() => {
                            setIsPendingProfitsOpen(false);
                            // إعادة تحميل بيانات الأرباح بعد إغلاق الحوار
                            fetchProfitsData();
                        }}
                        pendingProfits={dashboardData.pendingProfitOrders || []}
                        orders={orders || []}
                    />
                )}
            </AnimatePresence>
            <div className="space-y-8">
                {/* نظام المراقبة الخفي للمخزون والإشعارات */}
                <StockMonitoringSystem />
                
                <WelcomeHeader user={user} currentTime={currentTime} />
                {hasPermission('request_profit_settlement') && !hasPermission('manage_profit_settlement') && (
                    <SettlementRequestCard pendingProfit={dashboardData.pendingProfit} onSettle={() => navigate('/profits-summary')} />
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                    {allStatCards.slice(0, 8).map((stat, index) => (
                         <motion.div key={stat.key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                            <StatCard {...stat} />
                         </motion.div>
                    ))}
                </div>
                {hasPermission('view_dashboard_top_lists') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        <TopListCard title="الزبائن الأكثر طلباً" items={dashboardData.topCustomers} titleIcon={Users} itemIcon={UserIcon} sortByPhone={true} />
                        <TopListCard title="المحافظات الأكثر طلباً" items={dashboardData.topProvinces} titleIcon={MapPin} itemIcon={MapPin} />
                        <TopListCard title="المنتجات الأكثر طلباً" items={dashboardData.topProducts} titleIcon={Package} itemIcon={TrendingUp} />
                    </div>
                )}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
                    {hasPermission('view_dashboard_stock_alerts') && <StockAlertsCard />}
                    {hasPermission('view_dashboard_recent_orders') && <RecentOrdersCard recentOrders={visibleOrders.slice(0, 3)} />}
                </div>
            </div>
        </>
    );
};

export default Dashboard;
