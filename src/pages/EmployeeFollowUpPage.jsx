import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import OrderList from '@/components/orders/OrderList';
import Loader from '@/components/ui/loader';
import { ShoppingCart, DollarSign, Users, Hourglass, CheckCircle, RefreshCw, Loader2, Archive } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import StatCard from '@/components/dashboard/StatCard.jsx';
import SettledDuesDialog from '@/components/accounting/SettledDuesDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const EmployeeFollowUpPage = () => {
  const { allUsers, hasPermission } = useAuth();
  const { orders, loading, calculateManagerProfit, updateOrder, refetchProducts, settlementInvoices, deleteOrders } = useInventory();
  const { syncOrders: syncAlWaseetOrders } = useAlWaseet();
  
  const [filters, setFilters] = useState({
    status: 'all',
    employeeId: 'all',
    archived: false,
    profitStatus: 'all',
  });
  const [syncing, setSyncing] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isDuesDialogOpen, setIsDuesDialogOpen] = useState(false);

  const employees = useMemo(() => {
    return allUsers.filter(u => u.role === 'employee' || u.role === 'deputy' || u.role === 'admin');
  }, [allUsers]);

  const usersMap = useMemo(() => {
    const map = new Map();
    allUsers.forEach(u => map.set(u.id, u.full_name));
    return map;
  }, [allUsers]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter(order => {
      const employeeMatch = filters.employeeId === 'all' || order.created_by === filters.employeeId;
      const statusMatch = filters.status === 'all' || order.status === filters.status;
      const profitStatusMatch = filters.profitStatus === 'all' || (order.profitStatus || 'pending') === filters.profitStatus;
      const archiveMatch = filters.archived ? order.isArchived === true : !order.isArchived;
      return employeeMatch && statusMatch && archiveMatch && profitStatusMatch;
    });
  }, [orders, filters]);

  const stats = useMemo(() => {
    const relevantOrders = filteredOrders.filter(o => o.status === 'delivered');
    const totalSales = relevantOrders.reduce((sum, order) => sum + order.total, 0);
    
    const profitsData = relevantOrders.map(order => ({
        ...order,
        managerProfit: calculateManagerProfit(order) || 0,
    }));

    const totalManagerProfits = profitsData.reduce((sum, order) => sum + order.managerProfit, 0);
    
    const paidDues = settlementInvoices
        .filter(inv => {
            const employee = allUsers.find(u => u.id === inv.employee_id);
            return employee && (employee.role === 'employee' || employee.role === 'deputy');
        })
        .reduce((sum, inv) => sum + inv.total_amount, 0);

    return {
      totalOrders: filteredOrders.length,
      totalSales,
      totalManagerProfits,
      pendingDues: 0, // Placeholder
      paidDues
    };
  }, [filteredOrders, calculateManagerProfit, settlementInvoices, allUsers]);

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };
  
  const handleStatCardClick = (profitStatus) => {
    setFilters(prev => ({ ...prev, profitStatus, status: 'all' }));
  };

  const handleSync = async () => {
    setSyncing(true);
    toast({ title: "بدء المزامنة", description: "جاري مزامنة الطلبات من الوسيط..." });
    await syncAlWaseetOrders();
    await refetchProducts();
    toast({ title: "اكتملت المزامنة", description: "تم تحديث جميع البيانات بنجاح." });
    setSyncing(false);
  };
  
  const handleViewOrder = (order) => {
    setSelectedOrderDetails(order);
    setIsDetailsDialogOpen(true);
  };

  const handleReceiveReturned = async () => {
    if (selectedOrders.length === 0) {
        toast({ title: "خطأ", description: "الرجاء تحديد طلبات راجعة أولاً.", variant: "destructive" });
        return;
    }
    for (const orderId of selectedOrders) {
      await updateOrder(orderId, { status: 'returned_in_stock', isArchived: true });
    }
    toast({ title: "تم الاستلام", description: `تم استلام ${selectedOrders.length} طلبات راجعة في المخزن وأرشفتها.` });
    await refetchProducts();
    setSelectedOrders([]);
  };

  if (loading) {
    return <div className="flex h-full w-full items-center justify-center"><Loader /></div>;
  }

  return (
    <>
      <Helmet>
        <title>متابعة الموظفين - RYUS</title>
        <meta name="description" content="متابعة أداء وطلبات الموظفين" />
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text">متابعة الموظفين</h1>
            <p className="text-muted-foreground">نظرة شاملة على أداء فريق العمل.</p>
          </div>
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <RefreshCw className="h-4 w-4 ml-2" />}
            مزامنة الطلبات
          </Button>
        </div>

        <Card>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-center">
            <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
              <SelectTrigger>
                <SelectValue placeholder="فلترة حسب الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="pending">قيد الانتظار</SelectItem>
                <SelectItem value="processing">قيد التجهيز</SelectItem>
                <SelectItem value="shipped">تم الشحن</SelectItem>
                <SelectItem value="delivered">تم التسليم</SelectItem>
                <SelectItem value="returned">راجع</SelectItem>
                <SelectItem value="cancelled">ملغي</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.employeeId} onValueChange={(value) => handleFilterChange('employeeId', value)}>
              <SelectTrigger>
                <SelectValue placeholder="اختر موظف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الموظفين</SelectItem>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center space-x-2">
                <Checkbox id="archived" checked={filters.archived} onCheckedChange={(checked) => handleFilterChange('archived', checked)} />
                <Label htmlFor="archived" className="cursor-pointer">عرض الأرشيف</Label>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatCard title="إجمالي الطلبات" value={stats.totalOrders} icon={ShoppingCart} colors={['blue-500', 'sky-500']} />
          <StatCard title="إجمالي المبيعات" value={stats.totalSales} icon={DollarSign} colors={['purple-500', 'violet-500']} format="currency" />
          <StatCard title="أرباحي من الموظفين" value={stats.totalManagerProfits} icon={Users} colors={['green-500', 'emerald-500']} format="currency" />
          <StatCard title="مستحقات معلقة" value={stats.pendingDues} icon={Hourglass} colors={['yellow-500', 'amber-500']} format="currency" onClick={() => handleStatCardClick('pending')} />
          <StatCard title="مستحقات مدفوعة" value={stats.paidDues} icon={CheckCircle} colors={['teal-500', 'cyan-500']} format="currency" onClick={() => setIsDuesDialogOpen(true)} />
        </div>

        <div className="bg-card p-4 rounded-xl border">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">قائمة الطلبات ({filteredOrders.length})</h2>
            </div>

            {filters.status === 'returned' && !filters.archived && (
              <Card className="mb-4 p-4 bg-secondary rounded-lg border flex items-center justify-between">
                <p className="font-medium">
                  {selectedOrders.length} طلبات راجعة محددة
                </p>
                <Button onClick={handleReceiveReturned} disabled={selectedOrders.length === 0}>
                  <Archive className="w-4 h-4 ml-2" />
                  استلام الراجع في المخزن
                </Button>
              </Card>
            )}

            <OrderList 
                orders={filteredOrders} 
                isLoading={loading} 
                onViewOrder={handleViewOrder}
                onUpdateStatus={updateOrder}
                selectedOrders={selectedOrders}
                setSelectedOrders={setSelectedOrders}
                onDeleteOrder={(orderIds) => deleteOrders(orderIds)}
            />
        </div>

        <OrderDetailsDialog
            order={selectedOrderDetails}
            open={isDetailsDialogOpen}
            onOpenChange={setIsDetailsDialogOpen}
            onUpdate={updateOrder}
            canEditStatus={hasPermission('manage_orders')}
            sellerName={selectedOrderDetails ? usersMap.get(selectedOrderDetails.created_by) : null}
        />
        
        <SettledDuesDialog
            open={isDuesDialogOpen}
            onOpenChange={setIsDuesDialogOpen}
            invoices={settlementInvoices}
            allUsers={allUsers}
        />

      </motion.div>
    </>
  );
};

export default EmployeeFollowUpPage;