
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useSuper } from '@/contexts/SuperProvider';
import { useProfits } from '@/contexts/ProfitsContext';
import { useUnifiedProfits } from '@/hooks/useUnifiedProfits';

import { UserPlus, TrendingUp, DollarSign, PackageCheck, ShoppingCart, Users, Package, MapPin, User as UserIcon, Bot, Briefcase, TrendingDown, Hourglass, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/dashboard/StatCard';
import PendingRegistrations from '@/components/dashboard/PendingRegistrations';
import AiOrdersManager from '@/components/dashboard/AiOrdersManager';
import TopListCard from '@/components/dashboard/TopListCard';
import TopProvincesDialog from '@/components/dashboard/TopProvincesDialog';
import TopProductsDialog from '@/components/dashboard/TopProductsDialog';
import TopCustomersDialog from '@/components/dashboard/TopCustomersDialog';
import Loader from '@/components/ui/loader';
import { filterOrdersByPeriod, getTopCustomers, getTopProducts, getTopProvinces } from '@/lib/dashboard-helpers';
import WelcomeHeader from '@/components/dashboard/WelcomeHeader';
import UnifiedSettlementRequestCard from '@/components/dashboard/UnifiedSettlementRequestCard';
import StockAlertsCard from '@/components/dashboard/StockAlertsCard';
import StockMonitoringSystem from '@/components/dashboard/StockMonitoringSystem';
import RecentOrdersCard from '@/components/dashboard/RecentOrdersCard';
import { ArrowRight } from 'lucide-react';
import { getUserUUID } from '@/utils/userIdUtils';
import OrderList from '@/components/orders/OrderList';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import { startOfMonth, endOfMonth, parseISO, isValid, startOfWeek, startOfYear, subDays, format } from 'date-fns';
import ProfitLossDialog from '@/components/accounting/ProfitLossDialog';
import PendingProfitsDialog from '@/components/dashboard/PendingProfitsDialog';
import { supabase } from '@/integrations/supabase/client';
import ReceiptReceiptDialog from '@/components/orders/ReceiptReceiptDialog';
import { toast } from '@/components/ui/use-toast';
import EmployeeReceivedProfitsCard from '@/components/shared/EmployeeReceivedProfitsCard';

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
    // استخدام hook واحد فقط للصلاحيات لتجنب التعارض
    const { 
        loading,
        isAdmin,
        canViewAllData,
        canManageEmployees,
        hasPermission,
        filterDataByUser
    } = usePermissions();
    const { orders, products, loading: inventoryLoading, aiOrders, calculateProfit, calculateManagerProfit, accounting } = useSuper();
    
    // إضافة console.log لمراقبة البيانات الواردة من InventoryContext
    useEffect(() => {
        console.log('🔥 Dashboard - البيانات من InventoryContext:', {
            ordersCount: orders?.length || 0,
            orders: orders,
            firstOrder: orders?.[0],
            loading: inventoryLoading
        });
    }, [orders, inventoryLoading]);
    
    const { profits: profitsData } = useProfits();
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());

    // تعريف periods أولاً مع إضافة خيار "كل الفترات" كافتراضي واستخدام localStorage للحفظ
    const [periods, setPeriods] = useLocalStorage('dashboard-periods', {
        totalOrders: 'month',
        netProfit: 'all', // كل الفترات كافتراضي
        pendingProfit: 'month',
        deliveredSales: 'month',
        pendingSales: 'month',
    });

    // الآن يمكن استخدام periods بأمان
    const { profitData: unifiedProfitData, loading: unifiedProfitLoading, error: unifiedProfitError } = useUnifiedProfits(periods.netProfit);
    
    // إضافة لوج لتتبع البيانات
    useEffect(() => {
        console.log('🔍 Dashboard - Unified Profit Data:', {
            data: unifiedProfitData,
            loading: unifiedProfitLoading,
            error: unifiedProfitError,
            netProfit: unifiedProfitData?.netProfit
        });
    }, [unifiedProfitData, unifiedProfitLoading, unifiedProfitError]);

    const [dialog, setDialog] = useState({ open: false, type: '', orders: [], periodLabel: '' });
    const [isProfitLossOpen, setIsProfitLossOpen] = useState(false);
    const [isPendingProfitsOpen, setIsPendingProfitsOpen] = useState(false);
    const [isReceiptReceiptOpen, setIsReceiptReceiptOpen] = useState(false);
    const [profitsLocalData, setProfitsLocalData] = useState({ pending: [], settled: [] });
    
    const [profitsLoading, setProfitsLoading] = useState(false);

    const [dialogs, setDialogs] = useState({
        pendingRegs: false,
        aiOrders: false,
    });

    // إضافة listener للتحديثات اللحظية للطلبات الذكية
    useEffect(() => {
        const handleAiOrderCreated = (event) => {
            console.log('🔥 AI Order Created Event:', event.detail);
            // تحديث فوري للإحصائيات
        };

        const handleAiOrderUpdated = (event) => {
            console.log('🔥 AI Order Updated Event:', event.detail);
            // تحديث فوري للإحصائيات
        };

        const handleAiOrderDeleted = (event) => {
            console.log('🔥 AI Order Deleted Event:', event.detail);
            // تحديث فوري للإحصائيات
        };

        window.addEventListener('aiOrderCreated', handleAiOrderCreated);
        window.addEventListener('aiOrderUpdated', handleAiOrderUpdated);
        window.addEventListener('aiOrderDeleted', handleAiOrderDeleted);

        return () => {
            window.removeEventListener('aiOrderCreated', handleAiOrderCreated);
            window.removeEventListener('aiOrderUpdated', handleAiOrderUpdated);
            window.removeEventListener('aiOrderDeleted', handleAiOrderDeleted);
        };
    }, []);
    
    const [topProvincesOpen, setTopProvincesOpen] = useState(false);
    const [topProductsOpen, setTopProductsOpen] = useState(false);
    const [topCustomersOpen, setTopCustomersOpen] = useState(false);

    // جلب بيانات الأرباح من قاعدة البيانات
    const fetchProfitsData = useCallback(async () => {
        if (profitsLoading) return;
        
        setProfitsLoading(true);
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
                console.error('خطأ في جلب الأرباح:', error);
                return;
            }
            
            const pending = profitsData?.filter(p => p.status === 'pending') || [];
            const settled = profitsData?.filter(p => p.status === 'settled') || [];

            setProfitsLocalData({ pending, settled });
        } catch (error) {
            console.error('خطأ في fetchProfitsData:', error);
        } finally {
            setProfitsLoading(false);
        }
    }, []);

    // تحديث بيانات الأرباح عند تحميل الصفحة مرة واحدة فقط
    useEffect(() => {
        let mounted = true;
        
        if (mounted && !profitsLoading) {
            fetchProfitsData();
        }
        
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

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

    const visibleOrders = useMemo(() => {
        if (!orders) return [];
        
        return canViewAllData 
            ? orders 
            : orders.filter(order => order.created_by === getUserUUID(user));
    }, [orders, canViewAllData, user?.id, user?.user_id]);
    
    const [userEmployeeCode, setUserEmployeeCode] = useState(null);

    // جلب رمز الموظف
    useEffect(() => {
        const fetchEmployeeCode = async () => {
            if (!user?.user_id || canViewAllData) return;
            
            try {
                const { data } = await supabase
                    .from('employee_telegram_codes')
                    .select('telegram_code')
                    .eq('user_id', user.user_id)
                    .single();
                if (data?.telegram_code) setUserEmployeeCode(String(data.telegram_code).toUpperCase());
            } catch (err) {
                console.error('Error fetching employee code:', err);
            }
        };
        
        fetchEmployeeCode();
    }, [user?.user_id, canViewAllData]);

    const userAiOrders = useMemo(() => {
        if (!Array.isArray(aiOrders)) return [];
        if (canViewAllData) return aiOrders;
        const upper = (v) => (v ?? '').toString().trim().toUpperCase();
        const candidates = [userEmployeeCode, user?.employee_code, user?.user_id, user?.id].filter(Boolean).map(upper);
        if (!candidates.length) return [];
        return aiOrders.filter((order) => {
            const by = order?.created_by ?? order?.user_id ?? order?.created_by_employee_code ?? order?.order_data?.created_by;
            return by ? candidates.includes(upper(by)) : false;
        });
    }, [aiOrders, canViewAllData, userEmployeeCode, user?.employee_code, user?.user_id, user?.id]);

    const aiOrdersCount = useMemo(() => {
        const list = (canViewAllData ? (Array.isArray(aiOrders) ? aiOrders : []) : (Array.isArray(userAiOrders) ? userAiOrders : []));
        const lower = (v) => (v ?? '').toString().trim().toLowerCase();
        const normalizeSize = (s) => {
            if (!s) return '';
            let str = String(s).trim().toLowerCase();
            const digits = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
            str = str.replace(/[٠-٩]/g, (d) => digits[d]);
            str = str.replace(/اكسات/g, 'اكس');
            str = str.replace(/ثلاثة\s*اكس|ثلاث\s*اكس|3\s*اكس|٣\s*اكس/g, 'xxx');
            str = str.replace(/(2|٢)\s*اكس/g, 'xx');
            str = str.replace(/اكسين/g, 'xx');
            str = str.replace(/اكس/g, 'x');
            str = str.replace(/\s|-/g, '');
            if (/^(3xl|xxxl|xxx|3x)$/.test(str)) return 'xxxl';
            if (/^(2xl|xxl|xx|2x)$/.test(str)) return 'xxl';
            if (/^(xl|x)$/.test(str)) return 'xl';
            if (str.includes('xxx') || str.includes('3x')) return 'xxxl';
            if (str.includes('xx') || str.includes('2x')) return 'xxl';
            if (str.includes('x')) return 'xl';
            return str;
        };
        const keys = new Set();
        for (const o of list) {
            const idKey = o?.id ?? o?.order_id ?? o?.uuid;
            let key = idKey ? `id:${idKey}` : '';
            if (!key) {
                const ts = o?.created_at ? new Date(o.created_at).toISOString().slice(0,16) : '';
                const by = (o?.created_by ?? o?.user_id ?? o?.order_data?.created_by ?? '').toString().trim().toUpperCase();
                const items = Array.isArray(o?.items) ? o.items : (o?.order_data?.items || []);
                const itemSig = JSON.stringify(items.map(it => ({
                    n: lower(it.product_name || it.name || it.product),
                    c: lower(it.color),
                    s: normalizeSize(it.size),
                    q: Number(it.quantity || 1)
                })));
                key = `sig:${by}:${ts}:${itemSig}`;
            }
            keys.add(key);
        }
        return keys.size;
    }, [aiOrders, userAiOrders, canViewAllData, userEmployeeCode]);

    const pendingRegistrationsCount = useMemo(() => pendingRegistrations?.length || 0, [pendingRegistrations]);

    const financialSummary = useMemo(() => {
        const periodKey = periods.netProfit;
        const now = new Date();
        let from, to;
        switch (periodKey) {
            case 'today': from = subDays(now, 1); to = now; break;
            case 'week': from = startOfWeek(now, { weekStartsOn: 1 }); to = now; break;
            case 'year': from = startOfYear(now); to = now; break;
            case 'all': from = null; to = null; break; // كل الفترات - لا فلترة
            default: from = startOfMonth(now); to = endOfMonth(now); break;
        }

        // فلترة الطلبات حسب صلاحيات المستخدم
        const visibleOrders = orders ? (canViewAllData ? orders : orders.filter(order => 
            order.created_by === getUserUUID(user)
        )) : [];
        
        console.log('🔥 Dashboard - Orders for Analysis:', {
            totalOrders: orders?.length || 0,
            visibleOrders: visibleOrders.length,
            canViewAll: canViewAllData,
            userId: user?.id,
            userUserId: user?.user_id,
            firstOrder: visibleOrders[0]
        });

        if (!orders || !accounting || !products) return { netProfit: 0, chartData: [], deliveredOrders: [] };
        
        const filterByDate = (itemDateStr) => {
            if (!from || !to || !itemDateStr) return true;
            try {
                const itemDate = parseISO(itemDateStr);
                return isValid(itemDate) && itemDate >= from && itemDate <= to;
            } catch (error) {
                console.warn('Invalid date format:', itemDateStr);
                return false;
            }
        };
        
        const deliveredOrders = (visibleOrders || []).filter(o => 
            (o.status === 'delivered' || o.status === 'completed') && 
            o.receipt_received === true && 
            filterByDate(o.updated_at || o.created_at)
        );
        const expensesInRange = (accounting.expenses || []).filter(e => filterByDate(e.transaction_date));
        
        const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.final_amount || o.total_amount || 0), 0);
        const deliveryFees = deliveredOrders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0);
        const salesWithoutDelivery = totalRevenue - deliveryFees;
        
        const cogs = deliveredOrders.reduce((sum, o) => {
          const orderCogs = (o.items || []).reduce((itemSum, item) => {
            const costPrice = item.costPrice || item.cost_price || 0;
            return itemSum + (costPrice * item.quantity);
          }, 0);
          return sum + orderCogs;
        }, 0);
        const grossProfit = salesWithoutDelivery - cogs;
        
        const generalExpenses = expensesInRange.filter(e => {
          // استبعاد جميع المصاريف النظامية
          if (e.expense_type === 'system') return false;
          // استبعاد مستحقات الموظفين من أي حقل
          if (
            e.category === 'مستحقات الموظفين' ||
            e.related_data?.category === 'مستحقات الموظفين' ||
            e.metadata?.category === 'مستحقات الموظفين'
          ) return false;
          // استبعاد مصاريف الشراء من أي حقل
          if (
            e.related_data?.category === 'شراء بضاعة' ||
            e.metadata?.category === 'شراء بضاعة'
          ) return false;
          return true;
        }).reduce((sum, e) => sum + e.amount, 0);
        
        const employeeSettledDues = expensesInRange.filter(e => (e.category === 'مستحقات الموظفين' || e.related_data?.category === 'مستحقات الموظفين' || e.metadata?.category === 'مستحقات الموظفين')).reduce((sum, e) => sum + e.amount, 0);
        
        // صافي الربح = مجمل الربح - المصاريف العامة (لا يشمل المستحقات المدفوعة)
        const netProfit = grossProfit - generalExpenses;
        
        const salesByDay = {};
        deliveredOrders.forEach(o => {
          const dateStr = o.updated_at || o.created_at;
          if (!dateStr) return;
          try {
            const day = format(parseISO(dateStr), 'dd');
            if (!salesByDay[day]) salesByDay[day] = 0;
            salesByDay[day] += o.final_amount || o.total_amount || 0;
          } catch (error) {
            console.warn('Invalid date format in order:', dateStr);
          }
        });
        
        const expensesByDay = {};
        expensesInRange.forEach(e => {
            if (!e.transaction_date) return;
            try {
                const day = format(parseISO(e.transaction_date), 'dd');
                if (!expensesByDay[day]) expensesByDay[day] = 0;
                expensesByDay[day] += e.amount;
            } catch (error) {
                console.warn('Invalid date format in expense:', e.transaction_date);
            }
        });
    
        const allDays = [...new Set([...Object.keys(salesByDay), ...Object.keys(expensesByDay)])].sort();
        
        const chartData = allDays.map(day => ({
            name: day,
            sales: salesByDay[day] || 0,
            expenses: expensesByDay[day] || 0,
            net: (salesByDay[day] || 0) - (expensesByDay[day] || 0)
        }));

        return { totalRevenue, deliveryFees, salesWithoutDelivery, cogs, grossProfit, employeeSettledDues, generalExpenses, netProfit, chartData, filteredExpenses: expensesInRange, deliveredOrders };
    }, [periods.netProfit, visibleOrders, accounting, products]);

    const dashboardData = useMemo(() => {
        if (!visibleOrders || !user) return {
            totalOrdersCount: 0,
            netProfit: 0,
            pendingProfit: 0,
            deliveredSales: 0,
            pendingSales: 0,
            pendingProfitOrders: [],
            deliveredSalesOrders: [],
            pendingSalesOrders: [],
            topCustomers: [],
            topProvinces: [],
            topProducts: []
        };

        const filteredTotalOrders = filterOrdersByPeriod(visibleOrders, periods.totalOrders);
        const deliveredOrders = visibleOrders.filter(o => o.status === 'delivered' || o.status === 'completed');
        const deliveredOrdersWithoutReceipt = deliveredOrders.filter(o => !o.receipt_received);
        const filteredDeliveredOrders = filterOrdersByPeriod(deliveredOrdersWithoutReceipt, periods.pendingProfit);
        
        const pendingProfit = filteredDeliveredOrders.reduce((sum, o) => {
          if (!o.items || !Array.isArray(o.items)) return sum;
          
          const employeeProfit = o.items.reduce((itemSum, item) => {
            const unitPrice = item.unit_price || item.price || 0;
            const costPrice = item.cost_price || item.costPrice || 0;
            const quantity = item.quantity || 0;
            const profit = (unitPrice - costPrice) * quantity;
            return itemSum + profit;
          }, 0);
          
          const managerProfit = canViewAllData && o.created_by !== user?.id && o.created_by !== user?.user_id && calculateManagerProfit
            ? calculateManagerProfit(o) : 0;
          
          return sum + employeeProfit + managerProfit;
        }, 0);
        
        const deliveredSalesOrders = filterOrdersByPeriod(deliveredOrders, periods.deliveredSales);
        const deliveredSales = deliveredSalesOrders.reduce((sum, o) => {
          // المبلغ الفعلي المستلم = إجمالي المبلغ - رسوم التوصيل
          const actualReceivedAmount = (o.total_amount || 0) - (o.delivery_fee || 0);
          return sum + actualReceivedAmount;
        }, 0);

        const shippedOrders = visibleOrders.filter(o => o.status === 'shipped');
        const pendingSalesOrders = filterOrdersByPeriod(shippedOrders, periods.pendingSales);
        const pendingSales = pendingSalesOrders.reduce((sum, o) => {
          const productsSalesOnly = (o.total_amount || 0);
          return sum + productsSalesOnly;
        }, 0);

        return {
            totalOrdersCount: filteredTotalOrders.length,
            netProfit: unifiedProfitData?.netProfit || 0,
            pendingProfit,
            deliveredSales,
            pendingSales,
            pendingProfitOrders: filteredDeliveredOrders,
            deliveredSalesOrders,
            pendingSalesOrders,
            // إذا لم يكن بإمكان المستخدم رؤية جميع البيانات، فلترة البيانات للموظف فقط
            topCustomers: (() => {
                const customers = canViewAllData ? getTopCustomers(visibleOrders) : getTopCustomers(visibleOrders.filter(o => o.created_by === user?.id || o.created_by === user?.user_id));
                console.log('🔥 Dashboard - Top Customers Result:', customers);
                return customers;
            })(),
            topProvinces: (() => {
                const provinces = canViewAllData ? getTopProvinces(visibleOrders) : getTopProvinces(visibleOrders.filter(o => o.created_by === user?.id || o.created_by === user?.user_id));
                console.log('🔥 Dashboard - Top Provinces Result:', provinces);
                return provinces;
            })(),
            topProducts: (() => {
                const products = canViewAllData ? getTopProducts(visibleOrders) : getTopProducts(visibleOrders.filter(o => o.created_by === user?.id || o.created_by === user?.user_id));
                console.log('🔥 Dashboard - Top Products Result:', products);
                return products;
            })(),
        };
    }, [
        visibleOrders, 
        periods.totalOrders, 
        periods.pendingProfit, 
        periods.deliveredSales, 
        periods.pendingSales, 
        user?.id, 
        user?.user_id, 
        canViewAllData
    ]);

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

    // استخدام البيانات من Context مباشرة لتحسين الأداء
    const employeeProfitsData = useMemo(() => {
        if (!profitsData) {
            return {
                personalPendingProfit: 0,
                personalSettledProfit: 0,
                totalPersonalProfit: 0
            };
        }
        
        const allProfits = [...(profitsData.pending || []), ...(profitsData.settled || [])];
        
        const userProfits = canViewAllData 
            ? allProfits 
            : allProfits.filter(profit => {
                const employeeId = profit.employee_id;
                return employeeId === user?.id || employeeId === user?.user_id;
            });
            
        const personalPending = userProfits.filter(p => p.status === 'pending');
        const personalSettled = userProfits.filter(p => p.status === 'settled');
        
        return {
            personalPendingProfit: personalPending.reduce((sum, p) => sum + (p.employee_profit || 0), 0),
            personalSettledProfit: personalSettled.reduce((sum, p) => sum + (p.employee_profit || 0), 0),
            totalPersonalProfit: userProfits.reduce((sum, p) => sum + (p.employee_profit || 0), 0)
        };
    }, [profitsData, canViewAllData, user?.id, user?.user_id]);

    
    // إظهار loader فقط عند تحميل البيانات الأساسية
    if (inventoryLoading || loading || !user || isAdmin === undefined) {
        return <div className="flex h-full w-full items-center justify-center"><Loader /></div>;
    }

    const allStatCards = [
        // إزالة شروط الصلاحيات مؤقتاً لإصلاح المشكلة
        { 
            key: 'aiOrders', title: 'طلبات الذكاء الاصطناعي', value: aiOrdersCount, icon: Bot, colors: ['blue-500', 'sky-500'], onClick: () => setDialogs(d => ({ ...d, aiOrders: true })) 
        },
        canViewAllData && { 
            key: 'pendingRegs', title: 'طلبات التسجيل الجديدة', value: pendingRegistrationsCount, icon: UserPlus, colors: ['indigo-500', 'violet-500'], onClick: () => setDialogs(d => ({ ...d, pendingRegs: true }))
        },
        canViewAllData && { 
            key: 'employeeFollowUp', title: 'متابعة الموظفين', value: 'عرض', icon: Briefcase, colors: ['teal-500', 'cyan-500'], format: 'text', onClick: () => navigate('/employee-follow-up')
        },
        { 
            key: 'totalOrders', title: 'اجمالي الطلبات', value: dashboardData.totalOrdersCount, icon: ShoppingCart, colors: ['blue-500', 'sky-500'], format: 'number', currentPeriod: periods.totalOrders, onPeriodChange: (p) => handlePeriodChange('totalOrders', p), onClick: handleTotalOrdersClick
        },
        canViewAllData && {
            key: 'netProfit', title: 'صافي أرباح المبيعات', value: unifiedProfitData?.netProfit ?? financialSummary?.netProfit ?? 0, icon: DollarSign, colors: ['green-500', 'emerald-500'], format: 'currency', currentPeriod: periods.netProfit, onPeriodChange: (p) => handlePeriodChange('netProfit', p), onClick: () => setIsProfitLossOpen(true)
        },
        {
            key: 'pendingProfit', 
            title: canViewAllData ? 'الأرباح المعلقة' : 'أرباحي المعلقة', 
            value: canViewAllData ? dashboardData.pendingProfit : dashboardData.pendingProfit, 
            icon: Hourglass, 
            colors: ['yellow-500', 'amber-500'], 
            format: 'currency', 
            currentPeriod: periods.pendingProfit, 
            onPeriodChange: (p) => handlePeriodChange('pendingProfit', p), 
            onClick: () => setIsPendingProfitsOpen(true)
        },
        canViewAllData && {
            key: 'deliveredSales', 
            title: 'المبيعات المستلمة', 
            value: dashboardData.deliveredSales, 
            icon: CheckCircle, 
            colors: ['purple-500', 'violet-500'], 
            format: 'currency', 
            currentPeriod: periods.deliveredSales, 
            onPeriodChange: (p) => handlePeriodChange('deliveredSales', p), 
            onClick: () => openSummaryDialog('deliveredSales', dashboardData.deliveredSalesOrders, 'deliveredSales')
        },
        {
            key: 'pendingSales', 
            title: canViewAllData ? 'المبيعات المعلقة' : 'طلباتي المشحونة', 
            value: canViewAllData ? dashboardData.pendingSales : dashboardData.pendingSales, 
            icon: PackageCheck, 
            colors: ['orange-500', 'red-500'], 
            format: 'currency', 
            currentPeriod: periods.pendingSales, 
            onPeriodChange: (p) => handlePeriodChange('pendingSales', p), 
            onClick: canViewAllData ? () => openSummaryDialog('pendingSales', dashboardData.pendingSalesOrders, 'pendingSales') : () => navigate('/my-orders?status=shipped')
        },
    ].filter(Boolean);

    return (
        <>
            <Helmet><title>لوحة التحكم - RYUS</title></Helmet>
            <AnimatePresence>
                {dialogs.pendingRegs && <PendingRegistrations onClose={() => setDialogs(d => ({ ...d, pendingRegs: false }))} />}
                {dialogs.aiOrders && <AiOrdersManager open={dialogs.aiOrders} onClose={() => setDialogs(d => ({ ...d, aiOrders: false }))} />}
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
                        summary={unifiedProfitData}
                        datePeriod={periods.netProfit}
                        onDatePeriodChange={(p) => handlePeriodChange('netProfit', p)}
                    />
                )}
                {isPendingProfitsOpen && (
                    <PendingProfitsDialog
                        open={isPendingProfitsOpen}
                        onClose={() => {
                            setIsPendingProfitsOpen(false);
                            fetchProfitsData();
                        }}
                        pendingProfitOrders={dashboardData.pendingProfitOrders || []}
                        user={user}
                        onReceiveInvoices={() => {
                            console.log('تم استلام الفواتير بنجاح');
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
                <StockMonitoringSystem />
                
                <WelcomeHeader user={user} currentTime={currentTime} />
                {/* عرض كارت طلب المحاسبة للموظفين فقط، ليس للمديرين */}
                {!canViewAllData && (
                    <UnifiedSettlementRequestCard 
                        pendingProfit={employeeProfitsData.personalPendingProfit} 
                        onSettle={() => navigate('/profits-summary')} 
                    />
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                    {canViewAllData ? (
                      allStatCards.slice(0, 8).map((stat, index) => (
                        <motion.div key={stat.key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                          <StatCard {...stat} />
                        </motion.div>
                      ))
                    ) : (
                      <>
                        {allStatCards.slice(0, 2).map((stat, index) => (
                          <motion.div key={stat.key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                            <StatCard {...stat} />
                          </motion.div>
                        ))}
                        <motion.div key="my-received-profits" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                          <EmployeeReceivedProfitsCard />
                        </motion.div>
                        {allStatCards.slice(2, 8).map((stat, index) => (
                          <motion.div key={stat.key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (index + 2) * 0.05 }}>
                            <StatCard {...stat} />
                          </motion.div>
                        ))}
                      </>
                    )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    <TopListCard 
                      title="الزبائن الأكثر طلباً" 
                      items={dashboardData.topCustomers} 
                      titleIcon={Users} 
                      itemIcon={UserIcon} 
                      sortByPhone={true}
                      onViewAll={() => setTopCustomersOpen(true)}
                    />
                    <TopListCard 
                      title="المحافظات الأكثر طلباً" 
                      items={dashboardData.topProvinces} 
                      titleIcon={MapPin} 
                      itemIcon={MapPin}
                      onViewAll={() => setTopProvincesOpen(true)}
                    />
                    <TopListCard 
                      title="المنتجات الأكثر طلباً" 
                      items={dashboardData.topProducts} 
                      titleIcon={Package} 
                      itemIcon={TrendingUp}
                      onViewAll={() => setTopProductsOpen(true)}
                    />
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
                    <StockAlertsCard />
                    <RecentOrdersCard recentOrders={visibleOrders.slice(0, 3)} />
                </div>
            </div>
            
            <TopCustomersDialog 
              open={topCustomersOpen} 
              onOpenChange={setTopCustomersOpen} 
              employeeId={canViewAllData ? null : (user?.id || user?.user_id)}
              customersData={dashboardData.topCustomers}
            />
            
            <TopProvincesDialog 
              open={topProvincesOpen} 
              onOpenChange={setTopProvincesOpen} 
              employeeId={canViewAllData ? null : (user?.id || user?.user_id)}
              provincesData={dashboardData.topProvinces}
            />
            
            <TopProductsDialog 
              open={topProductsOpen} 
              onOpenChange={setTopProductsOpen} 
              employeeId={canViewAllData ? null : (user?.id || user?.user_id)}
              productsData={dashboardData.topProducts}
            />
        </>
    );
};

export default Dashboard;
