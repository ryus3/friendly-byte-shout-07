
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Helmet } from 'react-helmet-async';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useUnifiedProfits } from '@/hooks/useUnifiedProfits';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { ArrowRight, DollarSign, RefreshCw, Loader2, Archive, Users, ShoppingCart, Trash2, Building, Edit, CheckCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { scrollToTopInstant } from '@/utils/scrollToTop';

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


const OrdersPage = () => {
  const { orders, aiOrders, loading: inventoryLoading, calculateProfit, updateOrder, deleteOrders: deleteOrdersContext, refetchProducts } = useInventory();
  const { syncOrders: syncAlWaseetOrders } = useAlWaseet();
  const { user, allUsers } = useAuth();
  const { hasPermission } = usePermissions();
  const { profitData } = useUnifiedProfits();
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
  // رمز الموظف لاستخدامه في فلترة طلبات الذكاء الاصطناعي
  const [userEmployeeCode, setUserEmployeeCode] = useState(null);
  // فلتر اختيار موظف محدد للمدير
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all');

  // Scroll to top when page loads
  useEffect(() => {
    scrollToTopInstant();
  }, []);

  // إشعارات فقط للطلبات الجديدة - SuperProvider يتولى التحديثات الفورية
  useEffect(() => {
    const channel = supabase
      .channel('orders-notifications-only')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          const newOrder = payload.new;
          console.log('📢 إشعار طلب جديد:', newOrder.qr_id || newOrder.order_number);
          
          // إشعار فوري عند إنشاء طلب جديد فقط
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

          // إضافة إشعار في نافذة الإشعارات للمديرين فقط
          if (hasPermission('view_all_data') || hasPermission('manage_orders')) {
            const createNotification = async () => {
              try {
                await supabase.from('notifications').insert({
                  title: 'طلب جديد',
                  message: `تم إنشاء طلب جديد برقم ${newOrder.qr_id || newOrder.order_number} من العميل ${newOrder.customer_name}`,
                  type: 'order_created',
                  priority: 'high',
                  data: {
                    order_id: newOrder.id,
                    order_qr: newOrder.qr_id,
                    customer_name: newOrder.customer_name,
                    amount: newOrder.final_amount
                  },
                  user_id: null // إشعار عام للمديرين
                });
              } catch (error) {
                console.error('Error creating notification:', error);
              }
            };
            createNotification();
          }
          // لا حاجة لـ refetchProducts - SuperProvider يتولى التحديث الفوري
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hasPermission]); // إزالة refetchProducts من dependencies

  // مستمعون عامّون لأحداث النظام المحلية لضمان التحديث حتى إن لم تصل Realtime
  useEffect(() => {
    const handler = () => { try { refetchProducts?.(); } catch {} };
    window.addEventListener('orderCreated', handler);
    window.addEventListener('orderUpdated', handler);
    window.addEventListener('orderDeleted', handler);
    window.addEventListener('aiOrderDeleted', handler);
    return () => {
      window.removeEventListener('orderCreated', handler);
      window.removeEventListener('orderUpdated', handler);
      window.removeEventListener('orderDeleted', handler);
      window.removeEventListener('aiOrderDeleted', handler);
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

  // جلب أسماء المستخدمين لعرض اسم صاحب الطلب
  const usersMap = useMemo(() => {
    const map = new Map();
    (allUsers || []).forEach(u => {
      if (u && u.user_id) {
        // استخدام user_id للربط مع created_by
        map.set(u.user_id, u.full_name || u.name || 'غير معروف');
      }
    });
    return map;
  }, [allUsers]);

  // جلب رمز الموظف لفلترة طلبات الذكاء الاصطناعي للموظف
  useEffect(() => {
    const fetchEmployeeCode = async () => {
      if (!user?.user_id || hasPermission('view_all_orders')) return;
      try {
        const { data } = await supabase
          .from('employee_telegram_codes')
          .select('telegram_code')
          .eq('user_id', user.user_id)
          .single();
        if (data?.telegram_code) setUserEmployeeCode(String(data.telegram_code).toUpperCase());
      } catch (err) {
        console.error('Error fetching employee telegram_code:', err);
      }
    };
    fetchEmployeeCode();
  }, [user?.user_id, hasPermission]);

  // خيارات الموظفين للمدير
  const employeeOptions = useMemo(() => {
    if (!hasPermission('view_all_orders')) return [];
    const opts = (allUsers || []).map(u => ({ value: u.user_id, label: u.full_name || u.name || u.email || 'مستخدم' }));
    return [{ value: 'all', label: 'كل الموظفين' }, ...opts];
  }, [allUsers, hasPermission]);

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
  
  const userAiOrders = useMemo(() => {
    if (!Array.isArray(aiOrders)) return [];
    if (hasPermission('view_all_orders')) return aiOrders;
    const norm = (v) => (v ?? '').toString().trim().toLowerCase();
    const ids = [userEmployeeCode, user?.employee_code, user?.user_id, user?.id].filter(Boolean).map(norm);
    if (ids.length === 0) return [];
    return aiOrders.filter(order => {
      const by = order?.created_by ?? order?.user_id ?? order?.created_by_employee_code ?? order?.order_data?.created_by;
      return ids.includes(norm(by));
    });
  }, [aiOrders, userEmployeeCode, user?.employee_code, hasPermission, user?.user_id, user?.id]);

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
        // في الأرشيف، تطبيق فلتر فرعي للحالة داخل الطلبات المؤرشفة فقط
        if (archiveSubStatus === 'all') {
          matchesStatus = true; // إظهار جميع الطلبات المؤرشفة
        } else {
          matchesStatus = order.status === archiveSubStatus;
        }
      } else if (status === 'all') {
        // إظهار جميع الطلبات في الحالة المحددة (أرشيف أم لا)
        matchesStatus = true;
      } else {
        // فلترة حسب الحالة المحددة - فقط للطلبات غير المؤرشفة
        matchesStatus = order.status === status;
      }

      return matchesSearch && matchesStatus;
    }).map(order => ({
      ...order,
      created_by_name: usersMap.get(order.created_by) || 'غير معروف'
    }));
  }, [userOrders, filters, usersMap]);

  const myProfits = useMemo(() => {
    if (hasPermission('view_all_data')) {
      // للمديرين: إظهار صافي الربح للنظام من الطلبات المكتملة
      return profitData?.netProfit || 0;
    } else {
      // للموظفين: إظهار إجمالي الأرباح الشخصية من الطلبات المكتملة (تعديل: استخدام البيانات الصحيحة)
      return profitData?.totalPersonalProfit || profitData?.personalTotalProfit || 0;
    }
  }, [profitData, hasPermission]);

  // حساب الأرباح الحقيقية للموظف من جدول profits مباشرة
  const userActualProfits = useMemo(() => {
    if (hasPermission('view_all_data')) {
      return profitData?.netProfit || 0;
    } else {
      // للموظفين: حساب الأرباح الحقيقية من UnifiedProfitDisplay (تعديل: استخدام البيانات الصحيحة)
      return profitData?.totalPersonalProfit || profitData?.personalTotalProfit || 0;
    }
  }, [profitData, hasPermission]);
  
  const handleSync = async () => {
    setSyncing(true);
    await syncAlWaseetOrders();
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
    if(!hasPermission('delete_local_orders')) {
        return; // Simply return without showing toast
    }
    
    // إذا تم تمرير طلب واحد (object)، تحويله لـ array
    let ordersArray;
    if (Array.isArray(ordersToDelete)) {
      ordersArray = ordersToDelete;
    } else if (ordersToDelete && typeof ordersToDelete === 'object' && ordersToDelete.id) {
      // تم تمرير طلب واحد
      ordersArray = [ordersToDelete.id];
    } else {
      // تم تمرير ID مباشرة
      ordersArray = [ordersToDelete];
    }
    
    // فلترة الطلبات المحلية أو الطلبات قيد التجهيز (pending)
    const ordersToDeleteFiltered = ordersArray.filter(orderId => {
        const order = orders.find(o => o.id === orderId);
        return order && (order.delivery_partner === 'محلي' || order.status === 'pending');
    });

    if (ordersToDeleteFiltered.length < ordersArray.length) {
        toast({
            title: 'تنبيه',
            description: 'يمكن حذف الطلبات المحلية أو قيد التجهيز فقط. تم تجاهل باقي الطلبات.',
            variant: 'default'
        });
    }

    if (ordersToDeleteFiltered.length === 0) {
        toast({
            title: 'خطأ',
            description: 'لا توجد طلبات قابلة للحذف.',
            variant: 'destructive'
        });
        return;
    }

    try {
        // حذف الطلبات وتحرير المخزون المحجوز تلقائياً
        await deleteOrdersContext(ordersToDeleteFiltered);
        
        toast({
            title: 'تم الحذف بنجاح',
            description: `تم حذف ${ordersToDeleteFiltered.length} طلبات وتحرير المخزون المحجوز.`,
            variant: 'success'
        });
        
        setSelectedOrders([]);
        setDialogs(d => ({ ...d, deleteAlert: false }));
    } catch (error) {
        console.error('Error deleting orders:', error);
        toast({
            title: 'خطأ في الحذف',
            description: 'حدث خطأ أثناء حذف الطلبات.',
            variant: 'destructive'
        });
    }
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
             {hasPermission('view_all_data') && (
               <div className="col-span-1 lg:col-span-1">
                 <StatCard 
                   title="صافي ربح النظام"
                   value={userActualProfits || myProfits}
                   format="currency"
                   icon={DollarSign} 
                   colors={['green-500', 'emerald-500']}
                   onClick={() => navigate(profitsPagePath)}
                   periods={{ all: 'الطلبات المكتملة' }}
                   currentPeriod="all"
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
          employeeOptions={employeeOptions}
          selectedEmployeeId={selectedEmployeeId}
          onEmployeeChange={setSelectedEmployeeId}
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
          additionalButtons={(order) => (
            <ReceiveInvoiceButton 
              order={order} 
              onSuccess={() => refetchProducts()} 
            />
          )}
        />

        <OrderDetailsDialog
          order={selectedOrder}
          open={dialogs.details}
          onOpenChange={(open) => setDialogs(d => ({ ...d, details: open }))}
          onUpdate={updateOrder}
          onEditOrder={handleEditOrder}
          canEditStatus={hasPermission('manage_orders') || (selectedOrder?.created_by === user?.id)}
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
