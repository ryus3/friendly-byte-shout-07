import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Helmet } from 'react-helmet-async';
import { useSuper } from '@/contexts/SuperProvider';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useUnifiedProfits } from '@/hooks/useUnifiedProfits';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { ArrowRight, DollarSign, RefreshCw, Loader2, Archive, Users, ShoppingCart, Trash2, Building, Edit, CheckCircle, FileText } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { scrollToTopInstant } from '@/utils/scrollToTop';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
import ReceiveInvoiceButton from '@/components/orders/ReceiveInvoiceButton';
import AlWaseetInvoicesTab from '@/components/orders/AlWaseetInvoicesTab';

const OrdersPage = () => {
  // All existing state and effects code would go here
  const { orders, aiOrders, loading: inventoryLoading, calculateProfit, updateOrder, deleteOrders: deleteOrdersContext, refetchProducts } = useSuper();
  const { syncAndApplyOrders, syncOrderByTracking, fastSyncPendingOrders } = useAlWaseet();
  const { user, allUsers } = useAuth();
  const { hasPermission } = usePermissions();
  const { profitData } = useUnifiedProfits();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [filters, setFilters] = useLocalStorage('ordersFilters', { searchTerm: '', status: 'all', period: 'all', archiveSubStatus: 'all' });
  const [viewMode, setViewMode] = useLocalStorage('ordersViewMode', 'grid');
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
  const [userEmployeeCode, setUserEmployeeCode] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all');
  const [activeTab, setActiveTab] = useLocalStorage('ordersActiveTab', 'orders');

  // Scroll to top when page loads
  useEffect(() => {
    scrollToTopInstant();
  }, []);

  const pageConfig = {
    title: 'متابعة الطلبات',
    description: 'إدارة ومتابعة جميع الطلبات والشحنات.',
    icon: ShoppingCart,
    permission: 'view_orders',
  };

  // Users map for display names
  const usersMap = useMemo(() => {
    const map = new Map();
    (allUsers || []).forEach(u => {
      if (u && u.user_id) {
        map.set(u.user_id, u.full_name || u.name || 'غير معروف');
      }
    });
    return map;
  }, [allUsers]);

  // Filter orders by user permissions
  const userOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    if (hasPermission('view_all_orders')) {
      if (selectedEmployeeId && selectedEmployeeId !== 'all') {
        return orders.filter(order => order.created_by === selectedEmployeeId);
      }
      return orders;
    }
    return orders.filter(order => order.created_by === user?.user_id);
  }, [orders, user?.user_id, hasPermission, selectedEmployeeId]);

  // Filter AI orders
  const userAiOrders = useMemo(() => {
    if (!Array.isArray(aiOrders)) return [];
    if (hasPermission('view_all_orders')) return aiOrders;
    return aiOrders.filter(order => {
      const norm = (v) => (v ?? '').toString().trim().toLowerCase();
      const ids = [userEmployeeCode, user?.employee_code, user?.user_id, user?.id].filter(Boolean).map(norm);
      if (ids.length === 0) return [];
      const by = order?.created_by ?? order?.user_id ?? order?.created_by_employee_code ?? order?.order_data?.created_by;
      return ids.includes(norm(by));
    });
  }, [aiOrders, userEmployeeCode, user?.employee_code, hasPermission, user?.user_id, user?.id]);

  // Apply filters to orders
  const filteredOrders = useMemo(() => {
    let tempOrders;
    if (filters.status === 'archived') {
      tempOrders = userOrders.filter(o => o.isArchived || o.status === 'completed' || o.status === 'returned_in_stock');
    } else {
      tempOrders = userOrders.filter(o => !o.isArchived && o.status !== 'completed' && o.status !== 'returned_in_stock');
    }

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
        if (archiveSubStatus === 'all') {
          matchesStatus = true;
        } else {
          matchesStatus = order.status === archiveSubStatus;
        }
      } else if (status === 'all') {
        matchesStatus = true;
      } else {
        matchesStatus = order.status === status;
      }

      return matchesSearch && matchesStatus;
    }).map(order => ({
      ...order,
      created_by_name: usersMap.get(order.created_by) || 'غير معروف'
    }));
  }, [userOrders, filters, usersMap]);

  // Employee options for managers
  const employeeOptions = useMemo(() => {
    if (!hasPermission('view_all_orders')) return [];
    const opts = (allUsers || []).map(u => ({ value: u.user_id, label: u.full_name || u.name || u.email || 'مستخدم' }));
    return [{ value: 'all', label: 'كل الموظفين' }, ...opts];
  }, [allUsers, hasPermission]);

  // Calculate profits
  const myProfits = useMemo(() => {
    if (hasPermission('view_all_data')) {
      return profitData?.netProfit || 0;
    } else {
      return profitData?.totalPersonalProfit || profitData?.personalTotalProfit || 0;
    }
  }, [profitData, hasPermission]);

  const userActualProfits = useMemo(() => {
    if (hasPermission('view_all_data')) {
      return profitData?.netProfit || 0;
    } else {
      return profitData?.totalPersonalProfit || profitData?.personalTotalProfit || 0;
    }
  }, [profitData, hasPermission]);

  // Event handlers
  const handleSync = async () => {
    setSyncing(true);
    await syncAndApplyOrders();
    await refetchProducts();
    setSyncing(false);
  }

  const handleFastSync = async () => {
    setSyncing(true);
    await fastSyncPendingOrders();
    await refetchProducts();
    setSyncing(false);
  }

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
    if (!hasPermission('delete_local_orders')) {
      return;
    }
    
    let ordersArray;
    if (Array.isArray(ordersToDelete)) {
      ordersArray = ordersToDelete;
    } else {
      ordersArray = [ordersToDelete];
    }

    const ordersToDeleteFiltered = ordersArray.filter(o => {
      const orderId = typeof o === 'string' ? o : o?.id;
      return orderId && !deletedOrdersSet.current.has(orderId);
    });

    if (ordersToDeleteFiltered.length === 0) {
      return;
    }

    setSelectedOrders([]);
    setDialogs(d => ({ ...d, deleteAlert: false }));
    
    toast({
      title: 'جاري الحذف...',
      description: `حذف ${ordersToDeleteFiltered.length} طلب فورياً`,
      variant: 'success'
    });
    
    try {
      const result = await deleteOrdersContext(ordersToDeleteFiltered);
      
      if (result && result.success) {
        toast({
          title: 'تم الحذف بنجاح',
          description: `تم حذف ${ordersToDeleteFiltered.length} طلب نهائياً وتحرير المخزون.`,
          variant: 'success'
        });
      } else {
        throw new Error(result?.error || 'فشل الحذف');
      }
    } catch (error) {
      toast({
        title: 'خطأ في الحذف',
        description: 'حدث خطأ أثناء حذف الطلبات.',
        variant: 'destructive'
      });
    }
  }, [hasPermission, deleteOrdersContext]);

  const deletedOrdersSet = useRef(new Set());

  return (
    <>
      <Helmet>
        <title>{pageConfig.title} - {pageConfig.description}</title>
        <meta name="description" content={pageConfig.description} />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        {/* Header */}
        <OrdersHeader 
          totalOrders={filteredOrders.length} 
          totalProfit={myProfits}
          totalRevenue={userOrders.reduce((sum, order) => sum + (order.final_amount || 0), 0)}
          selectedCount={selectedOrders.length}
          onArchiveSelected={() => setDialogs(d => ({ ...d, archiveAlert: true }))}
          onDeleteSelected={() => setDialogs(d => ({ ...d, deleteAlert: true }))}
          onCreateOrder={() => setDialogs(d => ({ ...d, quickOrder: true }))}
          onSyncOrders={handleSync}
          onFastSync={handleFastSync}
          onOpenAiManager={() => setDialogs(d => ({ ...d, aiManager: true }))}
          syncing={syncing}
          icon={pageConfig.icon}
          title={pageConfig.title}
        />

        {/* Orders Stats */}
        <OrdersStats 
          orders={filteredOrders}
          aiOrders={userAiOrders}
          onAiOrdersClick={() => setDialogs(d => ({ ...d, aiManager: true }))}
          onStatCardClick={(status, period) => {
            setFilters(prev => ({ ...prev, status, period }));
          }}
          globalPeriod={filters.period}
        />

        {/* Main Content with Tabs */}
        <div className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="orders" className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                الطلبات
              </TabsTrigger>
              <TabsTrigger value="invoices" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                فواتير الوسيط
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="space-y-6">
              {/* Search and Filter Toolbar */}
              <OrdersToolbar 
                filters={filters}
                onFiltersChange={setFilters}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                totalCount={filteredOrders.length}
                selectedCount={selectedOrders.length}
                onArchiveSelected={() => setDialogs(d => ({ ...d, archiveAlert: true }))}
                onDeleteSelected={() => setDialogs(d => ({ ...d, deleteAlert: true }))}
              />

              {/* Orders List */}
              <OrderList
                orders={filteredOrders}
                aiOrders={userAiOrders}
                loading={inventoryLoading}
                viewMode={viewMode}
                selectedOrders={selectedOrders}
                onSelectionChange={setSelectedOrders}
                onViewOrder={handleViewOrder}
                onEditOrder={handleEditOrder}
                onUpdateOrderStatus={handleUpdateOrderStatus}
                onDeleteOrder={handleDeleteSelected}
                calculateProfit={calculateProfit}
              />
            </TabsContent>

            <TabsContent value="invoices">
              <AlWaseetInvoicesTab />
            </TabsContent>
          </Tabs>
        </div>

        {/* Dialogs */}
        <AnimatePresence>
          {dialogs.details && selectedOrder && (
            <OrderDetailsDialog 
              isOpen={dialogs.details}
              onClose={() => setDialogs(d => ({ ...d, details: false }))}
              order={selectedOrder}
              onEdit={handleEditOrder}
              calculateProfit={calculateProfit}
            />
          )}

          {dialogs.edit && selectedOrder && (
            <EditOrderDialog 
              isOpen={dialogs.edit}
              onClose={() => setDialogs(d => ({ ...d, edit: false }))}
              order={selectedOrder}
              onUpdate={updateOrder}
            />
          )}

          {dialogs.quickOrder && (
            <QuickOrderDialog 
              isOpen={dialogs.quickOrder}
              onClose={() => setDialogs(d => ({ ...d, quickOrder: false }))}
            />
          )}

          {dialogs.aiManager && (
            <AiOrdersManager 
              isOpen={dialogs.aiManager}
              onClose={() => setDialogs(d => ({ ...d, aiManager: false }))}
            />
          )}

          {dialogs.returnReceipt && selectedOrder && (
            <ReturnReceiptDialog 
              isOpen={dialogs.returnReceipt}
              onClose={() => setDialogs(d => ({ ...d, returnReceipt: false }))}
              order={selectedOrder}
            />
          )}
        </AnimatePresence>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={dialogs.deleteAlert} onOpenChange={(open) => setDialogs(d => ({ ...d, deleteAlert: open }))}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-destructive" />
                تأكيد حذف الطلبات
              </AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف {selectedOrders.length} طلب؟ لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  handleDeleteSelected(selectedOrders);
                  setDialogs(d => ({ ...d, deleteAlert: false }));
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                حذف الطلبات
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Archive Confirmation Dialog */}
        <AlertDialog open={dialogs.archiveAlert} onOpenChange={(open) => setDialogs(d => ({ ...d, archiveAlert: open }))}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-primary" />
                تأكيد أرشفة الطلبات
              </AlertDialogTitle>
              <AlertDialogDescription>
                هل تريد أرشفة {selectedOrders.length} طلب؟ يمكن الوصول للطلبات المؤرشفة من فلتر الأرشيف.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={handleArchiveSelected}>
                أرشفة الطلبات
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};

export default OrdersPage;