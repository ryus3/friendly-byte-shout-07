import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useUnifiedPermissionsSystem as usePermissions } from '@/hooks/useUnifiedPermissionsSystem.jsx';
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
    console.log('🔥 Dashboard starting...');
    
    // Basic hooks first
    const { user, pendingRegistrations } = useAuth();
    const navigate = useNavigate();
    
    console.log('🔥 Auth hooks initialized');
    
    // Permissions hook
    const { 
        loading,
        isAdmin,
        canViewAllData,
        canManageEmployees,
        hasPermission,
        filterDataByUser
    } = usePermissions();
    
    console.log('🔥 Permissions hook initialized');
    
    // Super provider hook
    const { orders, products, loading: inventoryLoading, aiOrders, calculateProfit, calculateManagerProfit, accounting } = useSuper();
    
    console.log('🔥 Super provider hook initialized');
    
    // Simple state and storage
    const [currentTime, setCurrentTime] = useState(new Date());
    const [periods, setPeriods] = useLocalStorage('dashboard-periods', {
        totalOrders: 'month',
        netProfit: 'all',
        pendingProfit: 'month',
        deliveredSales: 'month',
        pendingSales: 'month',
    });
    
    console.log('🔥 State and localStorage initialized');
    
    // Profits hooks
    const { profits: profitsData } = useProfits();
    const { profitData: unifiedProfitData, loading: unifiedProfitLoading, error: unifiedProfitError } = useUnifiedProfits(periods.netProfit);
    const { profitData: pendingProfitData, loading: pendingProfitLoading, allProfits } = useUnifiedProfits(periods.pendingProfit);
    
    console.log('🔥 Profits hooks initialized');

    // Basic computed values that don't depend on complex dependencies
    const visibleOrders = useMemo(() => {
        console.log('🔥 Computing visibleOrders...');
        if (!orders) return [];
        
        return canViewAllData 
            ? orders 
            : orders.filter(order => order.created_by === getUserUUID(user));
    }, [orders, canViewAllData, user?.id, user?.user_id]);

    console.log('🔥 visibleOrders computed');

    // Return basic structure for now
    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-muted/50">
            <Helmet>
                <title>لوحة التحكم - إدارة النظام</title>
                <meta name="description" content="لوحة تحكم شاملة لإدارة الطلبات والمبيعات والأرباح" />
            </Helmet>
            
            <div className="container mx-auto px-4 py-6 space-y-6">
                <WelcomeHeader currentTime={currentTime} />
                
                <div className="text-center">
                    <h1>Dashboard Loading...</h1>
                    <p>Orders: {orders?.length || 0}</p>
                    <p>Visible Orders: {visibleOrders?.length || 0}</p>
                    <p>Can View All: {canViewAllData ? 'Yes' : 'No'}</p>
                    <p>User: {user?.email || 'Not loaded'}</p>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;