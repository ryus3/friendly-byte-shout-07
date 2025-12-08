import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useUnifiedPermissionsSystem as usePermissions } from '@/hooks/useUnifiedPermissionsSystem.jsx';
import { useSuper } from '@/contexts/SuperProvider';
import { useUnifiedStats } from '@/hooks/useUnifiedStats';
import { useSupervisedEmployees } from '@/hooks/useSupervisedEmployees';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  DollarSign, 
  ShoppingCart, 
  Receipt,
  Search, 
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { scrollToTopInstant } from '@/utils/scrollToTop';
import SalesCard from '@/components/sales/SalesCard';
import OrderDetailsModal from '@/components/sales/OrderDetailsModal';
import FloatingScrollButton from '@/components/ui/FloatingScrollButton';
import SmartPagination from '@/components/ui/SmartPagination';

const SalesPage = () => {
  const { user } = useAuth();
  const { hasPermission, isAdmin, isDepartmentManager } = usePermissions();
  const { orders, loading, users } = useSuper();
  const { formatCurrency } = useUnifiedStats();
  const { supervisedEmployeeIds, filterByCreator } = useSupervisedEmployees();
  const [selectedEmployee, setSelectedEmployee] = useState(user?.id || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [receiptFilter, setReceiptFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Scroll to top عند تغيير الصفحة - فوري وموثوق
  useEffect(() => {
    scrollToTopInstant();
  }, [currentPage]);

  // إعادة تعيين currentPage إلى 1 عند تغيير أي فلتر
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, receiptFilter, dateFilter, selectedEmployee]);

  // Permission check - only admins can view ALL employees
  // مدير القسم يرى موظفيه فقط، ليس الكل
  const canViewAllEmployees = isAdmin;

  // Filter orders based on delivery status (delivered orders only)
  const deliveredOrders = useMemo(() => {
    return orders?.filter(order => {
      // ✅ التسليم الجزئي: يظهر إذا كان final_amount > 0 حتى لو status='returned'
      const isPartialSale = 
        order.order_type === 'partial_delivery' && 
        ['returned', 'partial_delivery', 'completed'].includes(order.status) &&
        (order.final_amount || 0) > 0;
      
      return (
        order.status === 'delivered' || 
        order.status === 'completed' ||
        isPartialSale ||
        (order.delivery_status === '4' && order.delivery_partner?.toLowerCase() === 'alwaseet')
      );
    }) || [];
  }, [orders]);

  // دالة تحديد نطاق التاريخ المحسنة
  const getDateRange = useCallback((filter) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filter) {
      case 'today':
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'week':
        const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { start: weekStart, end: now };
      case 'month':
        const monthStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { start: monthStart, end: now };
      case '3months':
        const threeMonthsStart = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
        return { start: threeMonthsStart, end: now };
      case '6months':
        const sixMonthsStart = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);
        return { start: sixMonthsStart, end: now };
      case 'year':
        const yearStart = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
        return { start: yearStart, end: now };
      default:
        return null;
    }
  }, []);

  // Filter orders based on selected employee and other filters
  // إعادة تعيين الصفحة عند تغيير الفلاتر
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, receiptFilter, dateFilter, selectedEmployee]);

  const filteredOrders = useMemo(() => {
    // ✅ فلترة المبيعات حسب الصلاحيات أولاً
    let filtered = deliveredOrders;
    
    // 1. تطبيق فلترة الصلاحيات الأساسية
    if (isAdmin) {
      // المدير العام يرى الكل
      filtered = deliveredOrders;
    } else if (isDepartmentManager) {
      // مدير القسم يرى مبيعاته + مبيعات موظفيه فقط
      filtered = deliveredOrders.filter(order => 
        order.created_by === user?.id || supervisedEmployeeIds.includes(order.created_by)
      );
    } else {
      // الموظف العادي يرى مبيعاته فقط
      filtered = deliveredOrders.filter(order => order.created_by === user?.id);
    }

    // 2. فلتر الموظف المحدد (إذا اختار موظف معين)
    if (selectedEmployee && selectedEmployee !== 'all') {
      filtered = filtered.filter(order => order.created_by === selectedEmployee);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(order => 
        order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.tracking_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_phone?.includes(searchTerm)
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

    // فلترة حسب التاريخ المحسنة
    if (dateFilter !== 'all') {
      const dateRange = getDateRange(dateFilter);
      
      if (dateRange) {
        filtered = filtered.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate >= dateRange.start && orderDate <= dateRange.end;
        });
      }
    }

    return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [deliveredOrders, selectedEmployee, searchTerm, statusFilter, receiptFilter, dateFilter, isAdmin, isDepartmentManager, supervisedEmployeeIds, user?.id, getDateRange]);

  // Pagination
  const ITEMS_PER_PAGE = 20; // ثابت واضح
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  // Calculate statistics - using final_amount (after discount) as requested
  const stats = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((sum, order) => {
      // Use final_amount to show price after discount
      const salesAmount = (order.final_amount || 0) - (order.delivery_fee || 0);
      return sum + salesAmount;
    }, 0);
    const receivedInvoices = filteredOrders.filter(order => order.receipt_received).length;

    return {
      totalOrders,
      totalRevenue,
      receivedInvoices,
      pendingInvoices: totalOrders - receivedInvoices
    };
  }, [filteredOrders]);

  // Get employee options from profiles table
  // مدير القسم يرى فقط موظفيه في القائمة المنسدلة
  const employeeOptions = useMemo(() => {
    // تحديد الطلبات المسموحة حسب الصلاحية
    let allowedOrders = deliveredOrders;
    if (!isAdmin && isDepartmentManager) {
      allowedOrders = deliveredOrders.filter(order => 
        order.created_by === user?.id || supervisedEmployeeIds.includes(order.created_by)
      );
    } else if (!isAdmin) {
      return []; // الموظف العادي لا يرى قائمة الموظفين
    }
    
    const employeesWithOrders = Array.from(
      new Set(allowedOrders.map(order => order.created_by))
    ).map(employeeId => {
      // Look for employee in profiles table
      const employee = users?.find(u => u.user_id === employeeId || u.id === employeeId);
      const employeeOrders = allowedOrders.filter(order => order.created_by === employeeId);
      // Use final_amount minus delivery fees to show actual sales amount after discount
      const totalSales = employeeOrders.reduce((sum, order) => {
        const salesAmount = (order.final_amount || 0) - (order.delivery_fee || 0);
        return sum + salesAmount;
      }, 0);
      
      return {
        id: employeeId,
        name: employee?.full_name || employee?.username || employee?.email || 'موظف غير محدد',
        orderCount: employeeOrders.length,
        totalSales,
        user: employee
      };
    }).filter(emp => emp.id);

    return employeesWithOrders;
  }, [deliveredOrders, users, isAdmin, isDepartmentManager, supervisedEmployeeIds, user?.id]);


  // Handle view order details
  const handleViewOrderDetails = (order) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  const getEmployeeByOrder = (order) => {
    return users?.find(u => u.user_id === order.created_by || u.id === order.created_by);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>

        {/* Pagination Controls */}
        {filteredOrders.length > itemsPerPage && (
          <div className="flex items-center justify-between mt-6 px-4 py-4 bg-card border border-border rounded-lg">
            <div className="text-sm text-muted-foreground">
              عرض {startIndex + 1}-{Math.min(endIndex, filteredOrders.length)} من {filteredOrders.length} طلب
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              
              <span className="text-sm font-medium px-4">
                صفحة {currentPage} من {totalPages}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-2">المبيعات</h1>
        <p className="text-muted-foreground">
          {canViewAllEmployees 
            ? "مراجعة شاملة لجميع المبيعات والطلبات في النظام" 
            : "عرض المبيعات والطلبات الخاصة بك"}
        </p>
      </div>

      {/* كروت الإحصائيات والفلاتر - 2x2 على الهاتف، 4x1 على الكمبيوتر */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* كرت إجمالي الطلبات */}
        <Card 
          className="cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden"
          onClick={() => {
            setStatusFilter('all');
            setCurrentPage(1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <CardContent className="p-4">
            <div className="text-center space-y-2 bg-gradient-to-br from-blue-500 to-cyan-400 text-white rounded-lg p-4 relative overflow-hidden h-[140px] flex flex-col justify-center">
              {/* دوائر شفافة في الخلفية */}
              <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/10 rounded-full"></div>
              <div className="absolute -top-2 -left-2 w-12 h-12 bg-white/5 rounded-full"></div>
              
              <div className="flex flex-col items-center gap-2">
                <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xl font-bold" dir="ltr">{stats.totalOrders.toLocaleString('en-US')}</p>
                  <h4 className="font-semibold text-sm">إجمالي الطلبات</h4>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* كرت إجمالي المبيعات */}
        <Card className="cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden">
          <CardContent className="p-4">
            <div className="text-center space-y-2 bg-gradient-to-br from-green-500 to-emerald-400 text-white rounded-lg p-4 relative overflow-hidden h-[140px] flex flex-col justify-center">
              {/* دوائر شفافة في الخلفية */}
              <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/10 rounded-full"></div>
              <div className="absolute -top-2 -left-2 w-12 h-12 bg-white/5 rounded-full"></div>
              
              <div className="flex flex-col items-center gap-2">
                <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xl font-bold" dir="ltr">{formatCurrency(stats.totalRevenue).replace(/[٠-٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])}</p>
                  <h4 className="font-semibold text-sm">إجمالي المبيعات</h4>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* كرت الفواتير المستلمة */}
        <Card className="cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden">
          <CardContent className="p-4">
            <div className="text-center space-y-2 bg-gradient-to-br from-purple-500 to-violet-400 text-white rounded-lg p-4 relative overflow-hidden h-[140px] flex flex-col justify-center">
              {/* دوائر شفافة في الخلفية */}
              <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/10 rounded-full"></div>
              <div className="absolute -top-2 -left-2 w-12 h-12 bg-white/5 rounded-full"></div>
              
              <div className="flex flex-col items-center gap-2">
                <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xl font-bold" dir="ltr">{stats.receivedInvoices.toLocaleString('en-US')}</p>
                  <h4 className="font-semibold text-sm">الفواتير المستلمة</h4>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* كرت الفلاتر */}
        <Card className="cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden">
          <CardContent className="p-4">
            <div className="text-center bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-lg p-4 relative overflow-hidden h-[140px] flex flex-col justify-between">
              {/* دوائر شفافة في الخلفية */}
              <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/10 rounded-full"></div>
              <div className="absolute -top-2 -left-2 w-12 h-12 bg-white/5 rounded-full"></div>
              
              {/* القسم العلوي - الأيقونة والعنوان */}
              <div className="flex flex-col items-center gap-2 flex-1 justify-center">
                <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
                  <Filter className="w-5 h-5" />
                </div>
                <div className="font-bold text-sm text-white">فلاتر البحث</div>
              </div>
              
              {/* القسم السفلي - المنسدلات */}
              <div className="space-y-1 w-full">
                {/* منسدلة اختيار الموظف - فقط للمديرين */}
                {canViewAllEmployees && (
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger className="bg-white/20 border-white/30 text-white text-xs h-6">
                      <SelectValue placeholder="جميع الموظفين" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border z-50">
                      <SelectItem value="all">جميع الموظفين</SelectItem>
                      {employeeOptions.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} ({emp.orderCount.toLocaleString('en-US')})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                {/* منسدلة فلتر الفترة */}
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="bg-white/20 border-white/30 text-white text-xs h-6">
                    <SelectValue placeholder="جميع الفترات" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-border z-50">
                    <SelectItem value="all">جميع الفترات</SelectItem>
                    <SelectItem value="today">اليوم</SelectItem>
                    <SelectItem value="week">أسبوع</SelectItem>
                    <SelectItem value="month">شهر</SelectItem>
                    <SelectItem value="3months">3 أشهر</SelectItem>
                    <SelectItem value="6months">6 أشهر</SelectItem>
                    <SelectItem value="year">سنة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* البحث السريع */}
      <Card className="p-4 bg-card/60 backdrop-blur border-border/40">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">البحث السريع</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="رقم الطلب، اسم العميل، أو رقم الهاتف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background border-border text-foreground"
            />
          </div>
        </div>
      </Card>

      {/* عرض الطلبات */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">
            الطلبات ({filteredOrders.length})
          </h2>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2 text-foreground">لا توجد طلبات</h3>
            <p className="text-muted-foreground">
              لا توجد طلبات تطابق المعايير المحددة
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedOrders.map((order) => (
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
        )}


        {/* Pagination Controls - نظام احترافي responsive */}
        {totalPages > 1 && (
          <SmartPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => {
              setCurrentPage(page);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            totalItems={filteredOrders.length}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          isOpen={showOrderDetails}
          onClose={() => setShowOrderDetails(false)}
          formatCurrency={formatCurrency}
          employee={getEmployeeByOrder(selectedOrder)}
        />
      )}
      
      {/* Floating Scroll Button */}
      <FloatingScrollButton />
    </div>
  );
};

export default SalesPage;