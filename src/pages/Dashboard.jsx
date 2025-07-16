
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useProfits } from '@/contexts/ProfitsContext';
import usePermissionBasedData from '@/hooks/usePermissionBasedData';
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
import ReceiptReceiptDialog from '@/components/orders/ReceiptReceiptDialog';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

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
                <DialogContent className="max-w-lg mx-4 max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader className="flex-shrink-0">
                        <DialogTitle className="text-lg">{title}</DialogTitle>
                        <DialogDescription className="text-sm">
                            ملخص سريع للطلبات للفترة المحددة ({periodLabel}).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto min-h-0 py-2">
                        <OrderList
                            orders={orders}
                            isLoading={false}
                            onViewOrder={handleViewOrder}
                            isCompact={true}
                        />
                    </div>
                    <DialogFooter className="flex-shrink-0 mt-4 flex-col sm:flex-row gap-2">
                        <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">إغلاق</Button>
                        <Button onClick={onDetailsClick} className="w-full sm:w-auto">
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
    const { user, pendingRegistrations } = useAuth();
    const { orders, aiOrders, loading: inventoryLoading, calculateProfit, calculateManagerProfit, accounting, products, settlementInvoices } = useInventory();
    const { profits } = useProfits();
    const { filterDataByUser, filterProfitsByUser, canViewAllData, hasPermission } = usePermissionBasedData();
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
    const [isReceiptReceiptOpen, setIsReceiptReceiptOpen] = useState(false);
    const [profitsData, setProfitsData] = useState({ pending: [], settled: [] });

    // جلب بيانات الأرباح من قاعدة البيانات
    const fetchProfitsData = useCallback(async () => {
        try {
            console.log('جاري جلب بيانات الأرباح...');
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
                console.error('خطأ في جلب الأرباح:', error);
                return { pending: [], settled: [] };
            }

            console.log('بيانات الأرباح المجلبة:', profitsData);
            
            const pending = profitsData?.filter(p => p.status === 'pending') || [];
            const settled = profitsData?.filter(p => p.status === 'settled') || [];

            console.log('الأرباح المعلقة:', pending);
            console.log('الأرباح المستلمة:', settled);

            setProfitsData({ pending, settled });
            return { pending, settled };
        } catch (error) {
            console.error('خطأ في fetchProfitsData:', error);
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
        return filterDataByUser(orders || [], 'created_by');
    }, [orders, filterDataByUser]);
    
    const userAiOrders = useMemo(() => filterDataByUser(aiOrders || [], 'created_by'), [aiOrders, filterDataByUser]);
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
        
        // الطلبات المُوصلة التي تم استلام فواتيرها فقط لحساب صافي الأرباح الفعلية
        const deliveredOrders = (orders || []).filter(o => 
            o.status === 'delivered' && 
            o.receipt_received === true && 
            filterByDate(o.updated_at || o.created_at)
        );
        const expensesInRange = (accounting.expenses || []).filter(e => filterByDate(e.transaction_date));
        
        // حساب إجمالي الإيرادات والرسوم
        const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.final_amount || o.total_amount || 0), 0);
        const deliveryFees = deliveredOrders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0);
        const salesWithoutDelivery = totalRevenue - deliveryFees;
        
        // حساب تكلفة البضاعة المباعة من العناصر الفعلية
        const cogs = deliveredOrders.reduce((sum, o) => {
          const orderCogs = (o.items || []).reduce((itemSum, item) => {
            const costPrice = item.costPrice || item.cost_price || 0;
            return itemSum + (costPrice * item.quantity);
          }, 0);
          return sum + orderCogs;
        }, 0);
        const grossProfit = salesWithoutDelivery - cogs;
        const generalExpenses = expensesInRange.filter(e => e.related_data?.category !== 'مستحقات الموظفين').reduce((sum, e) => sum + e.amount, 0);
        const employeeSettledDues = expensesInRange.filter(e => e.related_data?.category === 'مستحقات الموظفين').reduce((sum, e) => sum + e.amount, 0);
        const totalExpenses = generalExpenses + employeeSettledDues;
        const netProfit = grossProfit - totalExpenses;
        
        const salesByDay = {};
        deliveredOrders.forEach(o => {
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

        return { totalRevenue, deliveryFees, salesWithoutDelivery, cogs, grossProfit, totalExpenses, employeeSettledDues, generalExpenses, netProfit, chartData, filteredExpenses: expensesInRange, deliveredOrders };
    }, [periods.netProfit, orders, accounting, products]);

    const dashboardData = useMemo(() => {
        if (!visibleOrders) return {};

        console.log('حساب بيانات الدالشبورد - profitsData:', profitsData);

        const filteredTotalOrders = filterOrdersByPeriod(visibleOrders, periods.totalOrders);
        const deliveredOrders = (orders || []).filter(o => o.status === 'delivered');
        
        // الطلبات المُوصلة التي لم يتم استلام فواتيرها بعد = أرباح معلقة
        const deliveredOrdersWithoutReceipt = deliveredOrders.filter(o => !o.receipt_received);
        
        // حساب الأرباح المعلقة من جميع الطلبات المُوصلة (بدون فواتير مستلمة)
        // يشمل أرباح المدير + أرباح الموظفين
        const filteredDeliveredOrders = filterOrdersByPeriod(deliveredOrdersWithoutReceipt, periods.pendingProfit);
        const pendingProfit = filteredDeliveredOrders.reduce((sum, o) => {
          // ربح الموظف من الطلب
          const employeeProfit = (o.items || []).reduce((itemSum, item) => {
            const profit = (item.unit_price - (item.cost_price || item.costPrice || 0)) * item.quantity;
            return itemSum + profit;
          }, 0);
          
          // ربح المدير من الطلب (فقط إذا كان المستخدم الحالي مدير ويعرض طلبات الموظفين)
          const managerProfit = canViewAllData && o.created_by !== user?.id && o.created_by !== user?.user_id
            ? calculateManagerProfit(o) : 0;
          
          return sum + employeeProfit + managerProfit;
        }, 0);
        
        console.log('الطلبات المُوصلة بدون فواتير:', filteredDeliveredOrders.length);
        console.log('مجموع الأرباح المعلقة:', pendingProfit);
        
        // حساب المبيعات المستلمة (من إجمالي سعر المنتجات فقط بدون التوصيل)
        const deliveredSalesOrders = filterOrdersByPeriod(deliveredOrders, periods.deliveredSales);
        const deliveredSales = deliveredSalesOrders.reduce((sum, o) => {
          // المبيعات = إجمالي الطلب - رسوم التوصيل (فقط أسعار المنتجات)
          const productsSalesOnly = (o.total_amount || 0);
          return sum + productsSalesOnly;
        }, 0);

        // حساب المبيعات المعلقة (من إجمالي سعر المنتجات فقط بدون التوصيل)
        const shippedOrders = visibleOrders.filter(o => o.status === 'shipped');
        const pendingSalesOrders = filterOrdersByPeriod(shippedOrders, periods.pendingSales);
        const pendingSales = pendingSalesOrders.reduce((sum, o) => {
          // المبيعات = إجمالي الطلب - رسوم التوصيل (فقط أسعار المنتجات)
          const productsSalesOnly = (o.total_amount || 0);
          return sum + productsSalesOnly;
        }, 0);

        const result = {
            totalOrdersCount: filteredTotalOrders.length,
            netProfit: financialSummary.netProfit,
            pendingProfit,
            deliveredSales,
            pendingSales,
            pendingProfitOrders: filteredDeliveredOrders,
            deliveredSalesOrders,
            pendingSalesOrders,
            topCustomers: getTopCustomers(visibleOrders),
            topProvinces: getTopProvinces(visibleOrders),
            topProducts: getTopProducts(visibleOrders),
        };
        
        console.log('النتيجة النهائية للدالشبورد:', result);
        
        return result;
    }, [visibleOrders, orders, periods, user?.id, user?.user_id, canViewAllData, calculateProfit, financialSummary, profitsData]);

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

    // حساب بيانات الأرباح الشخصية للموظف
    const employeeProfitsData = useMemo(() => {
        const userProfits = filterProfitsByUser(profitsData.pending.concat(profitsData.settled));
        const personalPending = userProfits.filter(p => p.status === 'pending');
        const personalSettled = userProfits.filter(p => p.status === 'settled');
        
        return {
            personalPendingProfit: personalPending.reduce((sum, p) => sum + (p.employee_profit || 0), 0),
            personalSettledProfit: personalSettled.reduce((sum, p) => sum + (p.employee_profit || 0), 0),
            totalPersonalProfit: userProfits.reduce((sum, p) => sum + (p.employee_profit || 0), 0)
        };
    }, [profitsData, filterProfitsByUser]);

    const allStatCards = [
        hasPermission('use_ai_assistant') && { 
            key: 'aiOrders', title: 'طلبات الذكاء الاصطناعي', value: (canViewAllData ? aiOrders?.length : userAiOrders?.length) || 0, icon: Bot, colors: ['blue-500', 'sky-500'], onClick: () => setDialogs(d => ({ ...d, aiOrders: true })) 
        },
        hasPermission('manage_users') && canViewAllData && { 
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
            key: 'pendingProfit', 
            title: 'الأرباح المعلقة', 
            value: canViewAllData ? dashboardData.pendingProfit : employeeProfitsData.personalPendingProfit, 
            icon: Hourglass, 
            colors: ['yellow-500', 'amber-500'], 
            format: 'currency', 
            currentPeriod: periods.pendingProfit, 
            onPeriodChange: (p) => handlePeriodChange('pendingProfit', p), 
            onClick: canViewAllData ? () => setIsPendingProfitsOpen(true) : () => navigate('/my-profits?status=pending')
        },
        hasPermission('view_orders') && {
            key: 'deliveredSales', 
            title: canViewAllData ? 'المبيعات المستلمة' : 'أرباحي المستلمة', 
            value: canViewAllData ? dashboardData.deliveredSales : employeeProfitsData.personalSettledProfit, 
            icon: CheckCircle, 
            colors: ['purple-500', 'violet-500'], 
            format: 'currency', 
            currentPeriod: periods.deliveredSales, 
            onPeriodChange: (p) => handlePeriodChange('deliveredSales', p), 
            onClick: canViewAllData ? () => openSummaryDialog('deliveredSales', dashboardData.deliveredSalesOrders, 'deliveredSales') : () => navigate('/my-profits?status=settled')
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
                        pendingProfitOrders={dashboardData.pendingProfitOrders || []}
                        user={user}
                        onReceiveInvoices={() => {
                            console.log('تم استلام الفواتير بنجاح');
                            // تحديث البيانات بعد استلام الفواتير
                            fetchProfitsData();
                        }}
                    />
                )}
                {isReceiptReceiptOpen && (
                    <ReceiptReceiptDialog
                        open={isReceiptReceiptOpen}
                        onClose={() => setIsReceiptReceiptOpen(false)}
                        orders={dashboardData.pendingProfitOrders || []}
                        user={user}
                        onSuccess={fetchProfitsData}
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
