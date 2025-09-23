import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useUnifiedPermissionsSystem as usePermissions } from '@/hooks/useUnifiedPermissionsSystem.jsx';
import { useSuper } from '@/contexts/SuperContext';
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
  User
} from 'lucide-react';
import { formatCurrency } from '@/lib/financial-calculations';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const SalesPage = () => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { orders, loading, users } = useSuper();
  const [selectedEmployee, setSelectedEmployee] = useState(user?.id || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [receiptFilter, setReceiptFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

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

  // Get employee options for managers
  const employeeOptions = useMemo(() => {
    if (!canViewAllEmployees) return [];
    
    const employeesWithOrders = Array.from(
      new Set(deliveredOrders.map(order => order.created_by))
    ).map(employeeId => {
      const employee = users?.find(u => u.id === employeeId);
      return {
        id: employeeId,
        name: employee?.full_name || employee?.email || 'موظف غير محدد'
      };
    }).filter(emp => emp.id);

    return employeesWithOrders;
  }, [deliveredOrders, users, canViewAllEmployees]);

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
          <h1 className="text-3xl font-bold tracking-tight">المبيعات</h1>
          <p className="text-muted-foreground">
            {canViewAllEmployees ? 'متابعة وإدارة مبيعات الموظفين' : 'مبيعاتي وأدائي'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-8 h-8 text-primary" />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الطلبات</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground">طلب مُسلم</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المبيعات</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">إيراد إجمالي</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">الفواتير المستلمة</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.receivedInvoices}</div>
            <p className="text-xs text-muted-foreground">
              من أصل {stats.totalOrders} فاتورة
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">متوسط قيمة الطلب</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.averageOrderValue)}</div>
            <p className="text-xs text-muted-foreground">متوسط المبيعات</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            فلاتر البحث
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Employee Selection (for managers only) */}
            {canViewAllEmployees && (
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الموظف" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الموظفين</SelectItem>
                  {employeeOptions.map(employee => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث برقم الطلب أو اسم العميل..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="حالة الطلب" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="delivered">مُسلم</SelectItem>
                <SelectItem value="completed">مكتمل</SelectItem>
              </SelectContent>
            </Select>

            {/* Receipt Filter */}
            <Select value={receiptFilter} onValueChange={setReceiptFilter}>
              <SelectTrigger>
                <SelectValue placeholder="حالة الفاتورة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفواتير</SelectItem>
                <SelectItem value="received">مستلمة</SelectItem>
                <SelectItem value="pending">في الانتظار</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Filter */}
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="الفترة الزمنية" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفترات</SelectItem>
                <SelectItem value="today">اليوم</SelectItem>
                <SelectItem value="week">هذا الأسبوع</SelectItem>
                <SelectItem value="month">هذا الشهر</SelectItem>
              </SelectContent>
            </Select>

            {/* Reset Filters */}
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setReceiptFilter('all');
                setDateFilter('all');
                if (canViewAllEmployees) setSelectedEmployee('all');
              }}
            >
              إعادة تعيين
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>قائمة المبيعات ({filteredOrders.length})</span>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              آخر تحديث: {format(new Date(), 'dd MMM yyyy', { locale: ar })}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">لا توجد مبيعات مطابقة للفلاتر المحددة</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <div key={order.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold">#{order.order_number}</h3>
                        {getStatusBadge(order)}
                        {getReceiptBadge(order.receipt_received)}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {order.customer_name || 'عميل غير محدد'}
                        </div>
                        {order.customer_city && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {order.customer_city}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(order.created_at), 'dd MMM yyyy', { locale: ar })}
                        </div>
                      </div>

                      {canViewAllEmployees && (
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">الموظف:</span> {
                            users?.find(u => u.id === order.created_by)?.full_name || 'غير محدد'
                          }
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col lg:items-end gap-2">
                      <div className="text-2xl font-bold text-primary">
                        {formatCurrency(order.final_amount || order.total_amount || 0)}
                      </div>
                      
                      {order.tracking_number && (
                        <div className="text-sm text-muted-foreground">
                          رقم التتبع: {order.tracking_number}
                        </div>
                      )}

                      {order.delivery_partner && (
                        <Badge variant="outline" className="text-xs">
                          {order.delivery_partner}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Order Items Preview */}
                  {order.order_items && order.order_items.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">المنتجات:</span> {
                          order.order_items.slice(0, 2).map(item => 
                            `${item.product_name || 'منتج'} (${item.quantity})`
                          ).join(' • ')
                        }
                        {order.order_items.length > 2 && ` و ${order.order_items.length - 2} منتج آخر`}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesPage;