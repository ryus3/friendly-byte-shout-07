
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { ArrowRight, DollarSign, RefreshCw, Loader2, Printer, Archive, Users, ShoppingCart, Trash2, Building, Edit } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

import OrdersHeader from '@/components/orders/OrdersHeader';
import OrdersStats from '@/components/orders/OrdersStats';
import OrdersToolbar from '@/components/orders/OrdersToolbar';
import OrderList from '@/components/orders/OrderList';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import EditOrderDialog from '@/components/orders/EditOrderDialog';
import QuickOrderDialog from '@/components/quick-order/QuickOrderDialog';
import AiOrdersManager from '@/components/dashboard/AiOrdersManager';
import StatCard from '@/components/dashboard/StatCard';
import { filterOrdersByPeriod } from '@/lib/dashboard-helpers';
import { Card, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


const OrdersPage = () => {
  const { orders, aiOrders, loading: inventoryLoading, calculateProfit, updateOrder, deleteOrders: deleteOrdersContext, refetchProducts } = useInventory();
  const { syncOrders: syncAlWaseetOrders } = useAlWaseet();
  const { user, allUsers, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [filters, setFilters] = useState({ searchTerm: '', status: 'all', period: 'all' });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [dialogs, setDialogs] = useState({
    details: false,
    edit: false,
    quickOrder: false,
    aiManager: false,
    deleteAlert: false,
    archiveAlert: false,
  });
  const [syncing, setSyncing] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState([]);


  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusFilter = params.get('status');
    const trackingNumber = params.get('trackingNumber');
    if (statusFilter) {
      setFilters(prev => ({ ...prev, status: statusFilter, period: 'all' }));
    }
    if (trackingNumber) {
      setFilters(prev => ({ ...prev, searchTerm: trackingNumber, period: 'all', status: 'all' }));
    }
  }, [location.search]);

  const pageConfig = {
    title: hasPermission('view_all_orders') ? 'متابعة الطلبات' : 'طلباتي',
    description: 'إدارة ومتابعة جميع الطلبات والشحنات.',
    icon: ShoppingCart,
    permission: 'view_orders',
  };

  const usersMap = useMemo(() => {
    const map = new Map();
    allUsers.forEach(u => map.set(u.id, u.full_name));
    return map;
  }, [allUsers]);

  const userOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    if (hasPermission('view_all_orders')) {
        return orders;
    }
    return orders.filter(order => order.created_by === user.id);
  }, [orders, user.id, hasPermission]);
  
  const userAiOrders = useMemo(() => {
    if (!Array.isArray(aiOrders)) return [];
    return aiOrders.filter(order => order.created_by === user.id);
  }, [aiOrders, user.id]);

  const filteredOrders = useMemo(() => {
    let tempOrders;
    if (filters.status === 'archived') {
      tempOrders = userOrders.filter(o => o.isArchived);
    } else {
      tempOrders = userOrders.filter(o => !o.isArchived);
    }

    if (filters.period !== 'all') {
      tempOrders = filterOrdersByPeriod(tempOrders, filters.period);
    }
    
    return tempOrders.filter(order => {
      const { searchTerm, status } = filters;
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      const customerInfo = order.customerinfo || {};
      const matchesSearch = (
        (customerInfo.name || '').toLowerCase().includes(lowerCaseSearchTerm) ||
        (order.trackingnumber || '').toLowerCase().includes(lowerCaseSearchTerm) ||
        (customerInfo.phone || '').includes(searchTerm)
      );
      
      let matchesStatus = status === 'all' || order.status === status;
      if (status === 'archived') {
        matchesStatus = !!order.isArchived;
      } else if (status !== 'all') {
        matchesStatus = order.status === status && !order.isArchived;
      }


      return matchesSearch && matchesStatus;
    });
  }, [userOrders, filters]);

  const myProfits = useMemo(() => {
    if (!userOrders) return 0;
    return userOrders
      .filter(order => order.status === 'delivered' && order.profitStatus !== 'settled')
      .reduce((total, order) => {
        const orderProfit = (order.items || []).reduce((sum, item) => sum + calculateProfit(item, order.created_by), 0);
        return total + orderProfit;
      }, 0);
  }, [userOrders, calculateProfit]);
  
  const handleSync = async () => {
    setSyncing(true);
    await syncAlWaseetOrders();
    await refetchProducts();
    setSyncing(false);
  }

  const handlePrintInvoices = () => {
    toast({
      title: "🚧 هذه الميزة غير مطبقة بعد",
      description: "لكن لا تقلق! يمكنك طلبها في الرسالة التالية! 🚀"
    });
  };

  const handleViewOrder = useCallback((order) => {
    setSelectedOrder(order);
    setDialogs(d => ({ ...d, details: true }));
  }, []);

  const handleEditOrder = useCallback((order) => {
    setSelectedOrder(order);
    setDialogs(d => ({ ...d, edit: true }));
  }, []);

  const handleUpdateOrderStatus = useCallback(async (orderId, newStatus) => {
    await updateOrder(orderId, newStatus);
  }, [updateOrder]);
  
  const handleArchiveSelected = async () => {
    for (const orderId of selectedOrders) {
      await updateOrder(orderId, { isArchived: true });
    }
    toast({ title: 'تمت الأرشفة', description: `تمت أرشفة ${selectedOrders.length} طلبات.`, variant: 'success' });
    setSelectedOrders([]);
    setDialogs(d => ({ ...d, archiveAlert: false }));
  }

  const handleDeleteSelected = useCallback(async (ordersToDelete) => {
    if(!hasPermission('delete_local_orders')) {
        toast({title: 'غير مصرح', description: 'ليس لديك صلاحية لحذف الطلبات.', variant: 'destructive'})
        return;
    }
    const localOrdersToDelete = ordersToDelete.filter(orderId => {
        const order = orders.find(o => o.id === orderId);
        return order && order.shipping_company === 'محلي';
    });

    if (localOrdersToDelete.length < ordersToDelete.length) {
        toast({
            title: 'تنبيه',
            description: 'يمكن حذف الطلبات المحلية فقط. تم تجاهل الطلبات من شركات التوصيل.',
            variant: 'default'
        });
    }

    if (localOrdersToDelete.length > 0) {
        await deleteOrdersContext(localOrdersToDelete);
    }
    
    setSelectedOrders([]);
    setDialogs(d => ({ ...d, deleteAlert: false }));
  }, [hasPermission, orders, deleteOrdersContext]);

  const handleStatCardClick = useCallback((status, period) => {
    setFilters(prev => ({ ...prev, status, period: period || 'all' }));
  }, []);
  
  const handleToolbarFilterChange = useCallback((newFilters) => {
    setFilters(prev => ({...prev, ...newFilters }));
  }, []);

  const profitsPagePath = '/profits-summary';

  return (
    <>
      <Helmet>
        <title>{pageConfig.title} - نظام RYUS</title>
        <meta name="description" content={pageConfig.description} />
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                 <Button variant="outline" onClick={() => navigate('/')}>
                    <ArrowRight className="h-4 w-4 ml-2" />
                    رجوع
                </Button>
                <OrdersHeader title={pageConfig.title} description={pageConfig.description} icon={pageConfig.icon} />
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <Button variant="outline" onClick={handlePrintInvoices}>
                  <Printer className="h-4 h-4 ml-2" />
                  طباعة
              </Button>
              <Button variant="outline" onClick={handleSync} disabled={syncing}>
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <RefreshCw className="h-4 w-4 ml-2" />}
                  مزامنة
              </Button>
            </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
           <div className="col-span-1 sm:col-span-2 lg:col-span-3">
             <OrdersStats 
                orders={userOrders} 
                aiOrders={userAiOrders} 
                onAiOrdersClick={() => setDialogs(d => ({ ...d, aiManager: true }))}
                onStatCardClick={handleStatCardClick}
             />
           </div>
            {hasPermission('view_profits') && (
              <div className="col-span-1 sm:col-span-2 lg:col-span-1">
                <StatCard 
                  title="ملخص الأرباح" 
                  value={myProfits}
                  format="currency"
                  icon={DollarSign} 
                  colors={['green-500', 'emerald-500']}
                  onClick={() => navigate(profitsPagePath)}
                  periods={{ all: 'كل الأرباح' }}
                  currentPeriod="all"
                />
              </div>
            )}
        </div>

        <OrdersToolbar filters={filters} onFiltersChange={handleToolbarFilterChange} />
        
        {selectedOrders.length > 0 && hasPermission('manage_orders') && (
          <Card className="p-4 bg-card rounded-lg border">
            <CardContent className="p-0 flex items-center justify-between w-full gap-2">
              <p className="font-medium text-sm">
                {selectedOrders.length} طلبات محددة
              </p>
              <div className="flex gap-2">
                {filters.status !== 'archived' && (
                  <Button variant="outline" onClick={() => setDialogs(d => ({ ...d, archiveAlert: true }))}>
                    <Archive className="w-4 h-4 ml-2" />
                    أرشفة
                  </Button>
                )}
                {hasPermission('delete_local_orders') && (
                    <Button variant="destructive" onClick={() => setDialogs(d => ({ ...d, deleteAlert: true }))}>
                      <Trash2 className="w-4 h-4 ml-2" />
                      حذف
                    </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}


        <OrderList
          orders={filteredOrders}
          isLoading={inventoryLoading}
          onViewOrder={handleViewOrder}
          onEditOrder={handleEditOrder}
          onUpdateStatus={handleUpdateOrderStatus}
          selectedOrders={selectedOrders}
          setSelectedOrders={setSelectedOrders}
          onDeleteOrder={handleDeleteSelected}
        />

        <OrderDetailsDialog
          order={selectedOrder}
          open={dialogs.details}
          onOpenChange={(open) => setDialogs(d => ({ ...d, details: open }))}
          onUpdate={updateOrder}
          onEditOrder={handleEditOrder}
          canEditStatus={hasPermission('manage_orders')}
          sellerName={selectedOrder ? usersMap.get(selectedOrder.created_by) : null}
        />

        <EditOrderDialog
          order={selectedOrder}
          open={dialogs.edit}
          onOpenChange={(open) => setDialogs(d => ({ ...d, edit: open }))}
          onOrderUpdated={async () => {
            setDialogs(d => ({ ...d, edit: false }));
            await refetchProducts();
          }}
        />
        
        <QuickOrderDialog
          open={dialogs.quickOrder}
          onOpenChange={(open) => setDialogs(d => ({ ...d, quickOrder: open }))}
          onOrderCreated={async () => {
              setDialogs(d => ({ ...d, quickOrder: false }));
              await refetchProducts();
          }}
        />
        
        <AnimatePresence>
          {dialogs.aiManager && (
            <AiOrdersManager onClose={() => setDialogs(d => ({ ...d, aiManager: false }))} />
          )}
        </AnimatePresence>

        <AlertDialog open={dialogs.deleteAlert} onOpenChange={(open) => setDialogs(d => ({...d, deleteAlert: open}))}>
            <AlertDialogTrigger asChild><span/></AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        هذا الإجراء سيقوم بحذف الطلبات المحددة نهائياً. لا يمكن التراجع عن هذا الإجراء.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDeleteSelected(selectedOrders)}>حذف</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={dialogs.archiveAlert} onOpenChange={(open) => setDialogs(d => ({...d, archiveAlert: open}))}>
            <AlertDialogTrigger asChild><span/></AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        سيتم أرشفة الطلبات المحددة وإخفاؤها من القائمة الرئيسية. يمكنك عرضها من خلال فلتر "المؤرشفة".
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleArchiveSelected}>أرشفة</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

      </div>
    </>
  );
};

export default OrdersPage;
