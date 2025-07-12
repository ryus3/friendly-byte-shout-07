import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import OrderList from '@/components/orders/OrderList';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import Loader from '@/components/ui/loader';
import { ShoppingCart, Package, RefreshCw, Loader2, Search, Printer, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { format, startOfMonth, parseISO } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


const MyOrdersPage = () => {
  const { user, hasPermission } = useAuth();
  const { orders, loading, updateOrder, deleteOrders, refetchProducts } = useInventory();
  const { syncOrders: syncAlWaseetOrders } = useAlWaseet();
  
  const [filters, setFilters] = useState({
    status: 'all',
    searchTerm: '',
    dateRange: { from: startOfMonth(new Date()), to: new Date() },
    archived: 'active',
  });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [selectedOrdersForDeletion, setSelectedOrdersForDeletion] = useState([]);

  const canEditStatus = hasPermission('update_order_status');

  const myOrders = useMemo(() => {
    if (!orders) return [];
    if (hasPermission('view_all_orders')) return orders;
    return orders.filter(order => order.created_by === user.id);
  }, [orders, user.id, hasPermission]);
  
  const filteredOrders = useMemo(() => {
    return myOrders.filter(order => {
      const statusMatch = filters.status === 'all' || order.status === filters.status;
      const searchMatch = filters.searchTerm === '' ||
        order.customerinfo?.name?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        order.customerinfo?.phone?.includes(filters.searchTerm) ||
        order.trackingnumber?.toLowerCase().includes(filters.searchTerm.toLowerCase());
      const dateMatch = !filters.dateRange.from || !filters.dateRange.to || 
        (parseISO(order.created_at) >= filters.dateRange.from && parseISO(order.created_at) <= filters.dateRange.to);
      const archiveMatch = filters.archived === 'all' || (filters.archived === 'archived' ? order.isArchived === true : !order.isArchived);
      return statusMatch && searchMatch && dateMatch && archiveMatch;
    });
  }, [myOrders, filters]);

  const stats = useMemo(() => {
    return {
      total: myOrders.length,
      active: myOrders.filter(o => !o.isArchived).length,
      archived: myOrders.filter(o => o.isArchived).length,
    };
  }, [myOrders]);
  
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSelectOrderForDeletion = (orderId) => {
    setSelectedOrdersForDeletion(prev =>
        prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };
  
  const handleDeleteSelected = async () => {
    if (selectedOrdersForDeletion.length === 0) {
      toast({ title: 'خطأ', description: 'الرجاء تحديد طلبات لحذفها.', variant: 'destructive' });
      return;
    }
    await deleteOrders(selectedOrdersForDeletion);
    setSelectedOrdersForDeletion([]);
  };

  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    setIsDetailsOpen(true);
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    await updateOrder(orderId, { status: newStatus });
  };
  
  const handleBulkUpdateStatus = async (status) => {
    if (selectedOrdersForDeletion.length === 0) return;
    for (const orderId of selectedOrdersForDeletion) {
        await updateOrder(orderId, { status });
    }
    toast({title: `تم تحديث ${selectedOrdersForDeletion.length} طلبات إلى حالة "${status}"`});
    setSelectedOrdersForDeletion([]);
  };
  
  const handleBulkArchiveAction = async (archiveState) => {
    if (selectedOrdersForDeletion.length === 0) return;
     for (const orderId of selectedOrdersForDeletion) {
        await updateOrder(orderId, { isArchived: archiveState });
    }
    toast({title: `تم ${archiveState ? 'أرشفة' : 'إلغاء أرشفة'} ${selectedOrdersForDeletion.length} طلبات بنجاح`});
    setSelectedOrdersForDeletion([]);
  };

  const handleSync = async () => {
    setSyncing(true);
    toast({ title: "بدء المزامنة", description: "جاري مزامنة الطلبات من الوسيط..." });
    await syncAlWaseetOrders();
    await refetchProducts();
    toast({ title: "اكتملت المزامنة", description: "تم تحديث جميع البيانات بنجاح." });
    setSyncing(false);
  };

  const handlePrint = () => {
    setIsPrinting(true);
    toast({ title: 'جاري تجهيز الطباعة...', description: 'سيتم فتح نافذة الطباعة قريباً.' });
    setTimeout(() => {
        window.print();
        setIsPrinting(false);
    }, 1000);
  };

  return (
    <>
      <Helmet>
        <title>طلباتي - RYUS</title>
      </Helmet>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text">طلباتي</h1>
            <p className="text-muted-foreground">عرض وإدارة جميع طلباتك.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSync} disabled={syncing}>
                {syncing ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <RefreshCw className="h-4 w-4 ml-2" />}
                مزامنة
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={isPrinting}>
                <Printer className="h-4 w-4 ml-2" />
                طباعة
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث (اسم، هاتف، تتبع)"
                  value={filters.searchTerm}
                  onChange={e => handleFilterChange('searchTerm', e.target.value)}
                  className="pr-10"
                />
              </div>
              <Select value={filters.status} onValueChange={(v) => handleFilterChange('status', v)}>
                <SelectTrigger><SelectValue placeholder="فلترة حسب الحالة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="pending">قيد التجهيز</SelectItem>
                  <SelectItem value="processing">قيد التسليم</SelectItem>
                  <SelectItem value="shipped">تم الشحن</SelectItem>
                  <SelectItem value="delivered">تم التسليم</SelectItem>
                  <SelectItem value="returned">راجع</SelectItem>
                  <SelectItem value="returned_in_stock">راجع بالمخزن</SelectItem>
                  <SelectItem value="cancelled">ملغي</SelectItem>
                </SelectContent>
              </Select>
              <DateRangePicker date={filters.dateRange} onDateChange={(v) => handleFilterChange('dateRange', v)} />
              <Tabs value={filters.archived} onValueChange={(v) => handleFilterChange('archived', v)} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="active">
                    <Package className="w-4 h-4 ml-1" />
                    النشطة ({stats.active})
                  </TabsTrigger>
                  <TabsTrigger value="archived">
                    <Archive className="w-4 h-4 ml-1" />
                    المؤرشفة ({stats.archived})
                  </TabsTrigger>
                  <TabsTrigger value="all">الكل ({stats.total})</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            {hasPermission('delete_orders') && selectedOrdersForDeletion.length > 0 && (
                <div className="p-3 bg-secondary rounded-lg border flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="font-medium text-sm">{selectedOrdersForDeletion.length} طلبات محددة</p>
                    <div className="flex gap-2 flex-wrap justify-center">
                        <Button size="sm" onClick={() => handleBulkArchiveAction(true)} variant="outline"><Archive className="w-4 h-4 ml-2"/>أرشفة</Button>
                        <Button size="sm" onClick={() => handleBulkArchiveAction(false)} variant="outline"><ArchiveRestore className="w-4 h-4 ml-2"/>إلغاء الأرشفة</Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm"><Trash2 className="w-4 h-4 ml-2" />حذف المحدد</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        هل أنت متأكد من حذف الطلبات المحددة بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeleteSelected}>تأكيد الحذف</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            )}
          </CardContent>
        </Card>

        {loading ? <Loader /> : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                 <OrderList 
                    orders={filteredOrders}
                    onViewOrder={handleViewOrder}
                    onUpdateStatus={handleUpdateStatus}
                    canEditStatus={canEditStatus}
                    isReturnedList={false}
                    selectedReturnedOrders={selectedOrdersForDeletion}
                    onSelectReturnedOrder={setSelectedOrdersForDeletion}
                 />
            </motion.div>
        )}
      </div>

      <OrderDetailsDialog
        order={selectedOrder}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        onUpdate={handleUpdateStatus}
        canEditStatus={canEditStatus}
      />
      <div className="print-only">
        {/* ... Printing content ... */}
      </div>
    </>
  );
};

export default MyOrdersPage;