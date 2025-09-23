import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useUnifiedPermissionsSystem as usePermissions } from '@/hooks/useUnifiedPermissionsSystem.jsx';
import { useSuper } from '@/contexts/SuperProvider';
import { useUnifiedStats } from '@/hooks/useUnifiedStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  DollarSign, 
  Package, 
  TrendingUp, 
  Calendar, 
  Search, 
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  BarChart3,
  Receipt,
  MapPin,
  User,
  Grid,
  List,
  SlidersHorizontal
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import SalesCard from '@/components/sales/SalesCard';
import OrderDetailsModal from '@/components/sales/OrderDetailsModal';

const SalesPage = () => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { orders, loading, users } = useSuper();
  const { formatCurrency } = useUnifiedStats();
  const [selectedEmployee, setSelectedEmployee] = useState(user?.id || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [receiptFilter, setReceiptFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'list'
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);

  // Permission check - managers can view all employees
  const canViewAllEmployees = hasPermission('view_all_orders') || 
    user?.roles?.includes('super_admin') || 
    user?.roles?.includes('admin');

  // Filter orders based on delivery status (delivered orders only)
  const deliveredOrders = useMemo(() => {
    return orders?.filter(order => 
      order.status === 'delivered' || 
      order.status === 'completed' ||
      (order.delivery_status === '4' && order.delivery_partner?.toLowerCase() === 'alwaseet')
    ) || [];
  }, [orders]);

  // Filter orders based on selected employee and other filters
  const filteredOrders = useMemo(() => {
    let filtered = deliveredOrders;

    // Employee filter
    if (selectedEmployee && selectedEmployee !== 'all') {
      filtered = filtered.filter(order => order.created_by === selectedEmployee);
    } else if (!canViewAllEmployees) {
      // If not manager, show only own orders
      filtered = filtered.filter(order => order.created_by === user?.id);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(order => 
        order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.tracking_number?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Receipt filter
    if (receiptFilter !== 'all') {
      const hasReceipt = receiptFilter === 'received';
      filtered = filtered.filter(order => Boolean(order.receipt_received) === hasReceipt);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      filtered = filtered.filter(order => {
        const orderDate = new Date(order.created_at);
        switch (dateFilter) {
          case 'today':
            return orderDate >= startOfToday;
          case 'week':
            return orderDate >= startOfWeek;
          case 'month':
            return orderDate >= startOfMonth;
          default:
            return true;
        }
      });
    }

    return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [deliveredOrders, selectedEmployee, searchTerm, statusFilter, receiptFilter, dateFilter, canViewAllEmployees, user?.id]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + (order.final_amount || order.total_amount || 0), 0);
    const receivedInvoices = filteredOrders.filter(order => order.receipt_received).length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalOrders,
      totalRevenue,
      receivedInvoices,
      pendingInvoices: totalOrders - receivedInvoices,
      averageOrderValue
    };
  }, [filteredOrders]);

  // Get employee options for managers with enhanced data
  const employeeOptions = useMemo(() => {
    if (!canViewAllEmployees) return [];
    
    const employeesWithOrders = Array.from(
      new Set(deliveredOrders.map(order => order.created_by))
    ).map(employeeId => {
      const employee = users?.find(u => u.id === employeeId);
      const employeeOrders = deliveredOrders.filter(order => order.created_by === employeeId);
      const totalSales = employeeOrders.reduce((sum, order) => sum + (order.final_amount || order.total_amount || 0), 0);
      
      return {
        id: employeeId,
        name: employee?.full_name || employee?.email || 'موظف غير محدد',
        ordersCount: employeeOrders.length,
        totalSales,
        user: employee
      };
    }).filter(emp => emp.id);

    return employeesWithOrders;
  }, [deliveredOrders, users, canViewAllEmployees]);

  // Handle view order details
  const handleViewOrderDetails = (order) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  const getEmployeeByOrder = (order) => {
    return users?.find(u => u.id === order.created_by);
  };

  const getStatusBadge = (order) => {
    if (order.status === 'completed') {
      return <Badge variant="success" className="gap-1"><CheckCircle className="w-3 h-3" />مكتمل</Badge>;
    }
    if (order.status === 'delivered') {
      return <Badge variant="secondary" className="gap-1"><Package className="w-3 h-3" />مُسلم</Badge>;
    }
    return <Badge variant="outline">{order.status}</Badge>;
  };

  const getReceiptBadge = (received) => {
    if (received) {
      return <Badge variant="success" className="gap-1"><Receipt className="w-3 h-3" />مستلمة</Badge>;
    }
    return <Badge variant="destructive" className="gap-1"><Clock className="w-3 h-3" />في الانتظار</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            المبيعات
          </h1>
          <p className="text-muted-foreground text-lg">
            {canViewAllEmployees ? 'متابعة وإدارة مبيعات الموظفين بشكل احترافي' : 'مبيعاتي وأدائي الشخصي'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gradient-to-r from-primary/10 to-blue-600/10 p-2 rounded-lg">
            <BarChart3 className="w-6 h-6 text-primary" />
            <span className="text-sm font-medium text-primary">لوحة المبيعات</span>
          </div>
        </div>
      </div>

      {/* Enhanced Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-bl-3xl opacity-10" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">إجمالي الطلبات</CardTitle>
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
              <Package className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">{stats.totalOrders}</div>
            <p className="text-xs text-blue-600 mt-1">طلب مُسلم ومكتمل</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-emerald-400 to-green-600 rounded-bl-3xl opacity-10" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700">إجمالي المبيعات</CardTitle>
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-emerald-600 mt-1">إجمالي الإيرادات المحققة</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-600 rounded-bl-3xl opacity-10" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700">الفواتير المستلمة</CardTitle>
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-600 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-700">{stats.receivedInvoices}</div>
            <p className="text-xs text-purple-600 mt-1">
              من أصل {stats.totalOrders} فاتورة ({Math.round((stats.receivedInvoices/stats.totalOrders)*100) || 0}%)
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-orange-50 to-red-50 border-orange-200 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-orange-400 to-red-600 rounded-bl-3xl opacity-10" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700">متوسط قيمة الطلب</CardTitle>
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-red-600 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">{formatCurrency(stats.averageOrderValue)}</div>
            <p className="text-xs text-orange-600 mt-1">متوسط قيمة الطلب الواحد</p>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Filters & Controls */}
      <Card className="bg-gradient-to-r from-slate-50 to-gray-50 border-slate-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-primary" />
              فلاتر البحث المتقدمة
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">عرض:</span>
              <div className="flex items-center gap-1 bg-white rounded-lg p-1 border">
                <Button
                  variant={viewMode === 'cards' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('cards')}
                  className="h-8 w-8 p-0"
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-8 w-8 p-0"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Employee Selection (for managers only) */}
            {canViewAllEmployees && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">الموظف</label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger className="bg-white border-slate-300">
                    <SelectValue placeholder="اختر الموظف" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        جميع الموظفين
                      </div>
                    </SelectItem>
                    {employeeOptions.map(employee => (
                      <SelectItem key={employee.id} value={employee.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{employee.name}</span>
                          <div className="text-xs text-muted-foreground ml-2">
                            {employee.ordersCount} طلب
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Enhanced Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">البحث</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="رقم التتبع، الطلب، أو اسم العميل..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white border-slate-300"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">حالة الطلب</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-white border-slate-300">
                  <SelectValue placeholder="حالة الطلب" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="delivered">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-600" />
                      مُسلم
                    </div>
                  </SelectItem>
                  <SelectItem value="completed">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      مكتمل
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Receipt Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">حالة الفاتورة</label>
              <Select value={receiptFilter} onValueChange={setReceiptFilter}>
                <SelectTrigger className="bg-white border-slate-300">
                  <SelectValue placeholder="حالة الفاتورة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفواتير</SelectItem>
                  <SelectItem value="received">
                    <div className="flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-green-600" />
                      مستلمة
                    </div>
                  </SelectItem>
                  <SelectItem value="pending">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600" />
                      في الانتظار
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">الفترة الزمنية</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="bg-white border-slate-300">
                  <SelectValue placeholder="الفترة الزمنية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفترات</SelectItem>
                  <SelectItem value="today">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      اليوم
                    </div>
                  </SelectItem>
                  <SelectItem value="week">هذا الأسبوع</SelectItem>
                  <SelectItem value="month">هذا الشهر</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reset Filters */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 invisible">إعادة</label>
              <Button 
                variant="outline" 
                className="w-full bg-white hover:bg-slate-100 border-slate-300"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setReceiptFilter('all');
                  setDateFilter('all');
                  if (canViewAllEmployees) setSelectedEmployee('all');
                }}
              >
                <Filter className="w-4 h-4 mr-2" />
                إعادة تعيين
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Display */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-blue-600/5 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-blue-600 flex items-center justify-center">
                <Package className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="text-xl">قائمة المبيعات</span>
                <Badge variant="secondary" className="mr-2">
                  {filteredOrders.length} طلب
                </Badge>
              </div>
            </CardTitle>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>آخر تحديث: {format(new Date(), 'dd MMM yyyy HH:mm', { locale: ar })}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-gray-100 to-slate-100 flex items-center justify-center mx-auto mb-6">
                <Package className="w-12 h-12 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-muted-foreground mb-2">لا توجد مبيعات</h3>
              <p className="text-muted-foreground">لا توجد مبيعات مطابقة للفلاتر المحددة حالياً</p>
            </div>
          ) : viewMode === 'cards' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredOrders.map((order) => (
                <SalesCard
                  key={order.id}
                  order={order}
                  formatCurrency={formatCurrency}
                  employee={getEmployeeByOrder(order)}
                  onViewDetails={handleViewOrderDetails}
                  showEmployee={canViewAllEmployees}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <div 
                  key={order.id} 
                  className="border rounded-lg p-4 hover:bg-gradient-to-r hover:from-primary/5 hover:to-blue-600/5 transition-all duration-200 cursor-pointer group"
                  onClick={() => handleViewOrderDetails(order)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary/10 to-blue-600/10 flex items-center justify-center">
                        <Package className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">
                            #{order.tracking_number || order.delivery_partner_order_id || order.order_number}
                          </h3>
                          {getStatusBadge(order)}
                          {getReceiptBadge(order.receipt_received)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{order.customer_name || 'عميل غير محدد'}</span>
                          {order.customer_city && <span>{order.customer_city}</span>}
                          <span>{format(new Date(order.created_at), 'dd MMM yyyy', { locale: ar })}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-xl font-bold text-primary">
                        {formatCurrency(order.final_amount || order.total_amount || 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {order.order_items?.length || 0} منتج
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Details Modal */}
      <OrderDetailsModal
        order={selectedOrder}
        isOpen={showOrderDetails}
        onClose={() => setShowOrderDetails(false)}
        formatCurrency={formatCurrency}
        employee={selectedOrder ? getEmployeeByOrder(selectedOrder) : null}
      />
    </div>
  );
};

export default SalesPage;