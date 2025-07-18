import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useInventory } from '@/contexts/InventoryContext';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useProfits } from '@/contexts/ProfitsContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import OrderList from '@/components/orders/OrderList';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import Loader from '@/components/ui/loader';
import { ShoppingCart, Package, RefreshCw, Loader2, Search, Printer, Trash2, Archive, ArchiveRestore, DollarSign, User, Users, TrendingDown, TrendingUp, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { format, startOfMonth, endOfMonth, parseISO, isValid } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import ProfitStats from '@/components/profits/ProfitStats';
import ProfitFilters from '@/components/profits/ProfitFilters';
import SettlementRequest from '@/components/profits/SettlementRequest';
import ProfitDetailsTable from '@/components/profits/ProfitDetailsTable';
import ProfitDetailsMobile from '@/components/profits/ProfitDetailsMobile';
import SettlementInvoiceDialog from '@/components/profits/SettlementInvoiceDialog';
import { useMediaQuery } from '@/hooks/useMediaQuery';


const MyOrdersPage = () => {
  const { user, allUsers } = useAuth();
  const { hasPermission } = usePermissions();
  const { orders, aiOrders, loading, updateOrder, deleteOrders, refetchProducts, calculateProfit, calculateManagerProfit, settlementInvoices, requestProfitSettlement, accounting } = useInventory();
  const { syncOrders: syncAlWaseetOrders } = useAlWaseet();
  const { profits, createSettlementRequest, markInvoiceReceived } = useProfits();
  
  const [filters, setFilters] = useState({
    status: 'all',
    searchTerm: '',
    dateRange: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
    archived: 'active',
    employeeId: 'all',
    profitStatus: 'all',
  });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [selectedOrdersForDeletion, setSelectedOrdersForDeletion] = useState([]);
  const [dialogs, setDialogs] = useState({ details: false, invoice: false, expenses: false, settledDues: false });
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [selectedOrdersForProfit, setSelectedOrdersForProfit] = useState([]);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const canEditStatus = hasPermission('update_order_status');
  const canViewAll = user?.role === 'admin' || user?.role === 'super_admin' || user?.roles?.includes('super_admin') || user?.roles?.includes('admin') || hasPermission('manage_profit_settlement');
  const canRequestSettlement = !canViewAll && hasPermission('request_profit_settlement') && !user?.roles?.includes('super_admin');

  const myOrders = useMemo(() => {
    if (!orders) return [];
    if (hasPermission('view_all_orders')) return orders;
    return orders.filter(order => order.created_by === user.id);
  }, [orders, user.id, hasPermission]);

  const employees = useMemo(() => {
    return allUsers?.filter(u => u.role === 'employee' || u.role === 'deputy') || [];
  }, [allUsers]);

  // حساب الأرباح الشامل مثل صفحة ملخص الأرباح
  const profitData = useMemo(() => {
    const { from, to } = filters.dateRange;
    if (!orders || !allUsers || !from || !to || !profits) return {
        managerProfitFromEmployees: 0,
        detailedProfits: [],
        totalExpenses: 0,
        totalPersonalProfit: 0,
        personalPendingProfit: 0,
        personalSettledProfit: 0,
        totalSettledDues: 0,
        netProfit: 0,
        totalRevenue: 0,
        deliveryFees: 0,
        cogs: 0,
        generalExpenses: 0,
        employeeSettledDues: 0
    };

    // فلترة الطلبات الموصلة التي تم استلام فواتيرها في النطاق الزمني المحدد
    const deliveredOrders = orders?.filter(o => {
        const orderDate = o.created_at ? parseISO(o.created_at) : null;
        return o.status === 'delivered' && o.receipt_received === true && orderDate && isValid(orderDate) && orderDate >= from && orderDate <= to;
    }) || [];

    // الطلبات الموصلة بدون فواتير مستلمة (معلقة)
    const pendingDeliveredOrders = orders?.filter(o => {
        const orderDate = o.created_at ? parseISO(o.created_at) : null;
        return o.status === 'delivered' && !o.receipt_received && orderDate && isValid(orderDate) && orderDate >= from && orderDate <= to;
    }) || [];

    // ربط الطلبات بسجلات الأرباح من قاعدة البيانات
    const detailedProfits = [];

    // معالجة الطلبات المستلمة
    deliveredOrders.forEach(order => {
        const orderCreator = allUsers.find(u => u.id === order.created_by);
        if (!orderCreator) return;

        // البحث عن سجل الأرباح في قاعدة البيانات
        const profitRecord = profits.find(p => p.order_id === order.id);
        
        let employeeProfitShare, profitStatus;
        if (profitRecord) {
            employeeProfitShare = profitRecord.employee_profit || 0;
            profitStatus = profitRecord.status;
        } else {
            employeeProfitShare = (order.items || []).reduce((sum, item) => sum + calculateProfit(item, order.created_by), 0);
            profitStatus = 'settled'; // مستلمة لأن الفاتورة مستلمة
        }
        
        const managerProfitShare = calculateManagerProfit(order);
        
        detailedProfits.push({
            ...order,
            profit: employeeProfitShare,
            managerProfitShare,
            employeeName: orderCreator.full_name,
            profitStatus,
            profitRecord,
        });
    });

    // معالجة الطلبات المعلقة (موصلة بدون فواتير)
    pendingDeliveredOrders.forEach(order => {
        const orderCreator = allUsers.find(u => u.id === order.created_by);
        if (!orderCreator) return;

        const employeeProfitShare = (order.items || []).reduce((sum, item) => sum + calculateProfit(item, order.created_by), 0);
        const managerProfitShare = calculateManagerProfit(order);
        
        detailedProfits.push({
            ...order,
            profit: employeeProfitShare,
            managerProfitShare,
            employeeName: orderCreator.full_name,
            profitStatus: 'pending',
            profitRecord: null,
        });
    });

    // حساب الأرباح من الموظفين للمدير
    const managerProfitFromEmployees = detailedProfits.filter(p => {
        const pUser = allUsers.find(u => u.id === p.created_by);
        return pUser && (pUser.role === 'employee' || pUser.role === 'deputy');
    }).reduce((sum, p) => sum + p.managerProfitShare, 0);
    
    // حساب النفقات العامة
    const expensesInPeriod = canViewAll ? (accounting.expenses || []).filter(e => {
        const expenseDate = e.transaction_date ? parseISO(e.transaction_date) : null;
        return expenseDate && isValid(expenseDate) && expenseDate >= from && expenseDate <= to;
    }) : [];

    const generalExpenses = expensesInPeriod.filter(e => 
        e.related_data?.category !== 'شراء بضاعة' && e.related_data?.category !== 'مستحقات الموظفين'
    ).reduce((sum, e) => sum + e.amount, 0);

    const employeeSettledDues = expensesInPeriod.filter(e => 
        e.related_data?.category === 'مستحقات الموظفين'
    ).reduce((sum, e) => sum + e.amount, 0);

    const totalExpenses = generalExpenses + employeeSettledDues;

    // حساب الإيرادات والتكاليف لصافي الربح (نفس حساب لوحة التحكم)
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
    const netProfit = grossProfit - totalExpenses;

    // حساب أرباح المدير الشخصية
    const personalProfits = detailedProfits.filter(p => p.created_by === user.id);
    const totalPersonalProfit = personalProfits.reduce((sum, p) => sum + p.profit, 0);
  
    const personalPendingProfit = personalProfits
        .filter(p => (p.profitStatus || 'pending') === 'pending')
        .reduce((sum, p) => sum + p.profit, 0);

    const personalSettledProfit = personalProfits
        .filter(p => p.profitStatus === 'settled')
        .reduce((sum, p) => sum + p.profit, 0);

    const totalSettledDues = settlementInvoices?.filter(inv => {
        const invDate = parseISO(inv.settlement_date);
        return isValid(invDate) && invDate >= from && invDate <= to;
    }).reduce((sum, inv) => sum + inv.total_amount, 0) || 0;
    
    return { 
        managerProfitFromEmployees, 
        detailedProfits, 
        totalExpenses,
        totalPersonalProfit,
        personalPendingProfit,
        personalSettledProfit,
        totalSettledDues,
        netProfit,
        totalRevenue,
        deliveryFees,
        salesWithoutDelivery,
        cogs,
        grossProfit,
        generalExpenses,
        employeeSettledDues
    };
  }, [orders, allUsers, calculateProfit, filters.dateRange, accounting.expenses, user.id, canViewAll, settlementInvoices, calculateManagerProfit, profits]);

  const filteredDetailedProfits = useMemo(() => {
    // Add null safety check
    if (!profitData?.detailedProfits) {
      return [];
    }
    
    let filtered = profitData.detailedProfits;
    
    // إذا لم يكن المستخدم مدير، يرى أرباحه فقط
    if (!canViewAll) {
        filtered = filtered.filter(p => p.created_by === user?.id);
    } else if (filters.employeeId !== 'all') {
      if (filters.employeeId === 'employees') {
        filtered = filtered.filter(p => {
            const pUser = allUsers?.find(u => u.id === p.created_by);
            return pUser && (pUser.role === 'employee' || pUser.role === 'deputy');
        });
      } else {
        filtered = filtered.filter(p => p.created_by === filters.employeeId);
      }
    }
    
    if (filters.profitStatus !== 'all') {
      filtered = filtered.filter(p => (p.profitStatus || 'pending') === filters.profitStatus);
    }

    return filtered;
  }, [profitData?.detailedProfits, filters, canViewAll, user?.id, allUsers]);
  
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
    const aiOrdersCount = aiOrders ? aiOrders.length : 0;
    return {
      total: myOrders.length,
      active: myOrders.filter(o => !o.isArchived).length,
      archived: myOrders.filter(o => o.isArchived).length,
      aiOrders: aiOrdersCount,
    };
  }, [myOrders, aiOrders]);
  
  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    if (key === 'profitStatus' && value !== 'pending') {
        setSelectedOrdersForProfit([]);
    }
  }, []);

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
    setDialogs(d => ({ ...d, details: true }));
  };

  const handleViewInvoice = (invoiceId) => {
    if (!invoiceId) return;

    const invoice = settlementInvoices?.find(inv => inv.id === invoiceId);
    if (invoice) {
        setSelectedInvoice(invoice);
        setDialogs(d => ({ ...d, invoice: true }));
    }
  };

  const handleRequestSettlement = async () => {
    if (selectedOrdersForProfit.length === 0) {
        toast({ title: "خطأ", description: "الرجاء تحديد طلب واحد على الأقل للمحاسبة.", variant: "destructive" });
        return;
    }
    
    const amountToSettle = filteredDetailedProfits
        .filter(p => selectedOrdersForProfit.includes(p.id))
        .reduce((sum, p) => sum + p.profit, 0);

    if (amountToSettle > 0 && !isRequesting) {
      setIsRequesting(true);
      try {
        await requestProfitSettlement(user.id, amountToSettle, selectedOrdersForProfit);
        setSelectedOrdersForProfit([]);
      } catch (error) {
        toast({ title: "خطأ", description: "فشل إرسال الطلب.", variant: "destructive" });
      } finally {
        setIsRequesting(false);
      }
    }
  };

  const handleSelectOrderForProfit = (orderId) => {
    setSelectedOrdersForProfit(prev => 
        prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const handleSelectAllForProfit = (checked) => {
    if (checked) {
        setSelectedOrdersForProfit(filteredDetailedProfits.filter(p => (p.profitStatus || 'pending') === 'pending').map(p => p.id));
    } else {
        setSelectedOrdersForProfit([]);
    }
  };

  const handleMarkReceived = async (orderId) => {
    await markInvoiceReceived(orderId);
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
                  <SelectItem value="processing">قيد المعالجة</SelectItem>
                  <SelectItem value="shipped">تم الشحن</SelectItem>
                  <SelectItem value="delivery">قيد التوصيل</SelectItem>
                  <SelectItem value="delivered">تم التسليم</SelectItem>
                  <SelectItem value="returned">راجع</SelectItem>
                  <SelectItem value="returned_in_stock">تم الإرجاع للمخزن</SelectItem>
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
                  <TabsTrigger value="all">الكل ({stats.total + stats.aiOrders})</TabsTrigger>
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

        <div className="space-y-6">
          {/* كارت ملخص الأرباح الكبير - مثل صفحة ملخص الأرباح */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <ProfitStats 
                profitData={profitData}
                canViewAll={canViewAll}
                onFilterChange={handleFilterChange}
                onExpensesClick={() => setDialogs(d => ({...d, expenses: true}))}
                onSettledDuesClick={() => setDialogs(d => ({...d, settledDues: true}))}
                user={user}
            />
          </motion.div>

          {/* تفاصيل الأرباح */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.15, ease: "easeOut", delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>تفاصيل الأرباح</CardTitle>
                <CardDescription>عرض مفصل للأرباح من كل طلب. يمكنك استخدام الفلاتر لتخصيص العرض.</CardDescription>
              </CardHeader>
              <CardContent>
                <ProfitFilters
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    canViewAll={canViewAll}
                    employees={employees}
                    user={user}
                    allUsers={allUsers}
                />
                
                <SettlementRequest
                    canRequestSettlement={canRequestSettlement && filters.profitStatus === 'pending'}
                    isRequesting={isRequesting}
                    selectedOrdersCount={selectedOrdersForProfit.length}
                    onRequest={handleRequestSettlement}
                />
                
                {selectedOrdersForProfit.length > 0 && (
                    <Card className="p-4 bg-secondary border">
                        <CardContent className="p-0 flex flex-wrap items-center justify-between gap-4">
                            <p className="font-semibold text-sm">{selectedOrdersForProfit.length} طلبات محددة</p>
                        </CardContent>
                    </Card>
                )}
                
                {isMobile ? (
                    <ProfitDetailsMobile 
                        profits={filteredDetailedProfits}
                        onViewOrder={handleViewOrder}
                        onViewInvoice={handleViewInvoice}
                        onMarkReceived={handleMarkReceived}
                        canViewAll={canViewAll}
                        canRequestSettlement={canRequestSettlement && filters.profitStatus === 'pending'}
                        selectedOrders={selectedOrdersForProfit}
                        onSelectOrder={handleSelectOrderForProfit}
                        onSelectAll={handleSelectAllForProfit}
                    />
                ) : (
                    <ProfitDetailsTable 
                        profits={filteredDetailedProfits}
                        onViewOrder={handleViewOrder}
                        onViewInvoice={handleViewInvoice}
                        onMarkReceived={handleMarkReceived}
                        canViewAll={canViewAll}
                        canRequestSettlement={canRequestSettlement && filters.profitStatus === 'pending'}
                        selectedOrders={selectedOrdersForProfit}
                        onSelectOrder={handleSelectOrderForProfit}
                        onSelectAll={handleSelectAllForProfit}
                    />
                )}
              </CardContent>
            </Card>
          </motion.div>
          
          {/* قائمة الطلبات */}
          {loading ? <Loader /> : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.15, ease: "easeOut", delay: 0.2 }}
            >
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
      </div>

      <OrderDetailsDialog
        order={selectedOrder}
        open={dialogs.details}
        onOpenChange={(open) => setDialogs(d => ({ ...d, details: open }))}
        onUpdate={handleUpdateStatus}
        canEditStatus={canEditStatus}
      />

      <SettlementInvoiceDialog 
        invoice={selectedInvoice}
        open={dialogs.invoice}
        onOpenChange={(open) => setDialogs(d => ({ ...d, invoice: open }))}
      />
      <div className="print-only">
        {/* ... Printing content ... */}
      </div>
    </>
  );
};

export default MyOrdersPage;