
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Helmet } from 'react-helmet-async';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { ArrowRight, DollarSign, RefreshCw, Loader2, Printer, Archive, Users, ShoppingCart, Trash2, Building, Edit, CheckCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import UnifiedProfitDisplay from '@/components/shared/UnifiedProfitDisplay';

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
import ReturnReceiptDialog from '@/components/orders/ReturnReceiptDialog';


const OrdersPage = () => {
  const { orders, aiOrders, loading: inventoryLoading, calculateProfit, updateOrder, deleteOrders: deleteOrdersContext, refetchProducts } = useInventory();
  const { syncOrders: syncAlWaseetOrders } = useAlWaseet();
  const { user, allUsers } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [filters, setFilters] = useLocalStorage('ordersFilters', { searchTerm: '', status: 'all', period: 'all', archiveSubStatus: 'all' });
  const [viewMode, setViewMode] = useLocalStorage('ordersViewMode', 'grid'); // حفظ وضع العرض
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [dialogs, setDialogs] = useState({
    details: false,
    edit: false,
    quickOrder: false,
    aiManager: false,
    deleteAlert: false,
    archiveAlert: false,
    returnReceipt: false,
  });
  const [syncing, setSyncing] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState([]);

  // Realtime updates للطلبات
  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          const newOrder = payload.new;
          console.log('New order created:', newOrder);
          
          // إشعار فوري عند إنشاء طلب جديد
          toast({
            title: (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                تم إنشاء طلب جديد بنجاح
              </div>
            ),
            description: (
              <div className="space-y-1">
                <p><strong>رقم الطلب:</strong> {newOrder.qr_id || newOrder.order_number}</p>
                <p><strong>العميل:</strong> {newOrder.customer_name}</p>
                <p><strong>المبلغ:</strong> {newOrder.final_amount?.toLocaleString()} د.ع</p>
              </div>
            ),
            variant: "success",
            duration: 5000
          });
          
          // تحديث البيانات
          refetchProducts();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Order updated:', payload.new);
          // تحديث البيانات عند تحديث طلب
          refetchProducts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchProducts]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusFilter = params.get('status');
    const trackingNumber = params.get('trackingNumber');
    const highlightOrder = params.get('highlight');
    
    if (statusFilter) {
      setFilters(prev => ({ ...prev, status: statusFilter, period: 'all', archiveSubStatus: 'all' }));
    }
    if (trackingNumber) {
      setFilters(prev => ({ ...prev, searchTerm: trackingNumber, period: 'all', status: 'all', archiveSubStatus: 'all' }));
    }
    
    if (highlightOrder && orders) {
      // البحث عن الطلب المحدد وتعيينه كمحدد
      const order = orders.find(o => o.id === highlightOrder);
      if (order) {
        setSelectedOrder(order);
        setDialogs(prev => ({ ...prev, details: true }));
        // إزالة parameter من URL
        const newParams = new URLSearchParams(location.search);
        newParams.delete('highlight');
        navigate(`${location.pathname}?${newParams.toString()}`, { replace: true });
      }
    }
  }, [location.search, orders, navigate, location.pathname]);

  const pageConfig = {
    title: 'متابعة الطلبات',
    description: 'إدارة ومتابعة جميع الطلبات والشحنات.',
    icon: ShoppingCart,
    permission: 'view_orders',
  };

  const usersMap = useMemo(() => {
    const map = new Map();
    (allUsers || []).forEach(u => {
      if (u && u.id) {
        map.set(u.id, u.full_name || u.name || 'مستخدم غير معروف');
      }
    });
    return map;
  }, [allUsers]);

  const userOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    if (hasPermission('view_all_orders')) {
        return orders;
    }
    return orders.filter(order => order.created_by === (user?.id || user?.user_id));
  }, [orders, user, hasPermission]);
  
  const userAiOrders = useMemo(() => {
    if (!Array.isArray(aiOrders)) return [];
    return aiOrders.filter(order => order.created_by === (user?.id || user?.user_id));
  }, [aiOrders, user]);

  const filteredOrders = useMemo(() => {
    let tempOrders;
    if (filters.status === 'archived') {
      // في الأرشيف، إظهار جميع الطلبات المؤرشفة والمكتملة والراجعة للمخزن
      tempOrders = userOrders.filter(o => o.isArchived || o.status === 'completed' || o.status === 'returned_in_stock');
    } else {
      // إخفاء الطلبات المؤرشفة والمكتملة والراجعة للمخزن من القائمة العادية
      tempOrders = userOrders.filter(o => !o.isArchived && o.status !== 'completed' && o.status !== 'returned_in_stock');
    }

    // تطبيق فلتر الوقت أولاً
    if (filters.period !== 'all') {
      tempOrders = filterOrdersByPeriod(tempOrders, filters.period);
    }
    
    return tempOrders.filter(order => {
      const { searchTerm, status, archiveSubStatus } = filters;
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      const customerInfo = order.customerinfo || {
        name: order.customer_name,
        phone: order.customer_phone
      };
      const matchesSearch = (
        (customerInfo.name || order.customer_name || '').toLowerCase().includes(lowerCaseSearchTerm) ||
        (order.trackingnumber || order.tracking_number || '').toLowerCase().includes(lowerCaseSearchTerm) ||
        (order.qr_id || '').toLowerCase().includes(lowerCaseSearchTerm) ||
        (order.order_number || '').toLowerCase().includes(lowerCaseSearchTerm) ||
        (customerInfo.phone || order.customer_phone || '').includes(searchTerm)
      );
      
      let matchesStatus = true;
      
      if (status === 'archived') {
        // في الأرشيف، تطبيق فلتر فرعي للحالة داخل الأرشيف فقط
        if (archiveSubStatus !== 'all') {
          matchesStatus = order.status === archiveSubStatus;
        }
      } else if (status !== 'all') {
        // فلترة حسب الحالة المحددة فقط خارج الأرشيف
        matchesStatus = order.status === status;
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
    await updateOrder(orderId, { status: newStatus });
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
        return; // Simply return without showing toast
    }
    const localOrdersToDelete = ordersToDelete.filter(orderId => {
        const order = orders.find(o => o.id === orderId);
        return order && order.delivery_partner === 'محلي';
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
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const handleViewModeChange = useCallback((newViewMode) => {
    setViewMode(newViewMode);
  }, []);

  const handleReceiveReturn = useCallback((order) => {
    setSelectedOrder(order);
    setDialogs(d => ({ ...d, returnReceipt: true }));
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
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
           <div className="col-span-1 lg:col-span-3">
             <OrdersStats 
                orders={userOrders} 
                aiOrders={userAiOrders} 
                onAiOrdersClick={() => setDialogs(d => ({ ...d, aiManager: true }))}
                onStatCardClick={handleStatCardClick}
                globalPeriod={filters.period}
             />
           </div>
            {hasPermission('view_profits') && (
              <div className="col-span-1 lg:col-span-1">
                <UnifiedProfitDisplay
                  displayMode="order-tracking"
                  canViewAll={hasPermission('view_all_profits')}
                  useRealTimeData={true}
                  className="col-span-1"
                />
              </div>
            )}
        </div>

        <OrdersToolbar 
          filters={filters} 
          onFiltersChange={handleToolbarFilterChange}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          onOrderFound={(foundOrder) => {
            setSelectedOrder(foundOrder);
            setDialogs(prev => ({ ...prev, details: true }));
          }}
          onUpdateOrderStatus={handleUpdateOrderStatus}
        />
        
        {selectedOrders.length > 0 && hasPermission('manage_orders') && (
          <Card className="p-3 sm:p-4 bg-card rounded-lg border">
            <CardContent className="p-0 flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-2">
              <p className="font-medium text-sm">
                {selectedOrders.length} طلبات محددة
              </p>
              <div className="flex gap-2 w-full sm:w-auto">
                {filters.status !== 'archived' && (
                  <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => setDialogs(d => ({ ...d, archiveAlert: true }))}>
                    <Archive className="w-4 h-4 ml-2" />
                    أرشفة
                  </Button>
                )}
                {hasPermission('delete_local_orders') && (
                    <Button variant="destructive" size="sm" className="flex-1 sm:flex-none" onClick={() => setDialogs(d => ({ ...d, deleteAlert: true }))}>
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
          onReceiveReturn={handleReceiveReturn}
          selectedOrders={selectedOrders}
          setSelectedOrders={setSelectedOrders}
          onDeleteOrder={handleDeleteSelected}
          viewMode={viewMode}
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

        <ReturnReceiptDialog
          open={dialogs.returnReceipt}
          onClose={() => setDialogs(d => ({ ...d, returnReceipt: false }))}
          order={selectedOrder}
          onSuccess={async () => {
            await refetchProducts();
            toast({
              title: "تم استلام الراجع",
              description: "تم إرجاع المنتجات إلى المخزون بنجاح",
              variant: "success"
            });
          }}
        />

      </div>
    </>
  );
};

export default OrdersPage;
