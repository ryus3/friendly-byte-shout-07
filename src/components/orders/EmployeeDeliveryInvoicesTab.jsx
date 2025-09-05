import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { motion } from 'framer-motion';
import { 
  RefreshCw, 
  Search, 
  Package, 
  DollarSign, 
  FileText, 
  Clock,
  AlertTriangle,
  Calendar,
  TrendingUp,
  Banknote,
  Receipt,
  User
} from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import AlWaseetInvoicesList from './AlWaseetInvoicesList';
import AlWaseetInvoiceDetailsDialog from './AlWaseetInvoiceDetailsDialog';

const EmployeeDeliveryInvoicesTab = ({ employeeId }) => {
  const { refreshOrders } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState([]);
  
  // Time filter state with localStorage - نفس الفلاتر الزمنية للتوحيد
  const [timeFilter, setTimeFilter] = useLocalStorage('employee-invoices-time-filter', 'month');
  const [customDateRange, setCustomDateRange] = useState(null);

  // جلب فواتير شركة التوصيل للموظف المحدد تلقائياً
  React.useEffect(() => {
    const fetchEmployeeInvoices = async () => {
      if (!employeeId || employeeId === 'all') {
        setInvoices([]);
        return;
      }

      setLoading(true);
      try {
        console.log('🔍 جلب فواتير الموظف:', employeeId);
        
        // استعلام محسن للفواتير الحقيقية
        let query = supabase
          .from('delivery_invoices')
          .select(`
            *,
            delivery_invoice_orders!inner(
              id,
              order_id,
              external_order_id
            )
          `)
          .eq('partner', 'alwaseet');

        // فلترة دقيقة للموظف
        if (employeeId === '91484496-b887-44f7-9e5d-be9db5567604') {
          query = query.or(`owner_user_id.eq.${employeeId},owner_user_id.is.null`);
        } else {
          query = query.eq('owner_user_id', employeeId);
        }

        // تطبيق فلترة زمنية
        if (timeFilter !== 'all' && timeFilter !== 'custom') {
          const now = new Date();
          let filterDate = new Date();
          
          switch (timeFilter) {
            case 'week':
              filterDate.setDate(now.getDate() - 7);
              break;
            case 'month':
              filterDate.setMonth(now.getMonth() - 1);
              break;
            case '3months':
              filterDate.setMonth(now.getMonth() - 3);
              break;
            case '6months':
              filterDate.setMonth(now.getMonth() - 6);
              break;
            case 'year':
              filterDate.setFullYear(now.getFullYear() - 1);
              break;
          }
          
          query = query.gte('issued_at', filterDate.toISOString());
        }

        const { data: employeeInvoices, error } = await query
          .order('issued_at', { ascending: false });

        if (error) {
          console.error('خطأ في جلب فواتير الموظف:', error);
          setInvoices([]);
        } else {
          console.log('✅ تم جلب الفواتير:', employeeInvoices?.length || 0);
          setInvoices(employeeInvoices || []);
        }
      } catch (err) {
        console.error('خطأ غير متوقع في جلب الفواتير:', err);
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    };

    // تحميل تلقائي فوري
    fetchEmployeeInvoices();
  }, [employeeId, timeFilter]);

  // فلترة الفواتير مع دعم الفترة المخصصة
  const filteredInvoices = useMemo(() => {
    let filtered = invoices;
    
    // تطبيق فلترة التاريخ المخصص
    if (timeFilter === 'custom' && customDateRange) {
      filtered = filtered.filter(invoice => {
        const invoiceDate = new Date(invoice.issued_at || invoice.created_at);
        const fromDate = new Date(customDateRange.from);
        const toDate = customDateRange.to ? new Date(customDateRange.to) : new Date();
        
        return invoiceDate >= fromDate && invoiceDate <= toDate;
      });
    }
    
    // فلترة البحث والحالة
    return filtered.filter(invoice => {
      const matchesSearch = 
        invoice.external_id?.toString().includes(searchTerm) ||
        invoice.amount?.toString().includes(searchTerm);
      
      const matchesStatus = 
        statusFilter === 'all' || 
        (statusFilter === 'received' && invoice.received === true) ||
        (statusFilter === 'pending' && invoice.received !== true);
      
      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchTerm, statusFilter, timeFilter, customDateRange]);

  // إحصائيات الفواتير
  const getInvoiceStats = () => {
    const totalInvoices = invoices.length;
    const pendingInvoices = invoices.filter(inv => !inv.received).length;
    const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalOrders = invoices.reduce((sum, inv) => sum + (inv.orders_count || 0), 0);
    
    return { totalInvoices, pendingInvoices, totalAmount, totalOrders };
  };

  const stats = getInvoiceStats();

  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setDetailsDialogOpen(true);
  };

  const handleRefresh = async () => {
    if (refreshOrders) {
      await refreshOrders();
    }
    // إعادة تحديث الفواتير مباشرة
    window.location.reload();
  };
  
  const handleTimeFilterChange = async (newFilter) => {
    setTimeFilter(newFilter);
    if (newFilter !== 'custom') {
      setCustomDateRange(null);
    }
  };
  
  const handleCustomDateRangeChange = (dateRange) => {
    setCustomDateRange(dateRange);
  };

  // إذا لم يتم تحديد موظف
  if (!employeeId || employeeId === 'all') {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <User className="h-12 w-12 mx-auto text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">اختر موظفاً لعرض فواتيره</h3>
          <p className="text-muted-foreground">
            يرجى اختيار موظف محدد من الفلاتر أعلاه لعرض فواتير شركة التوصيل الخاصة به
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* إحصائيات فواتير الموظف */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* إجمالي الفواتير */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          whileHover={{ y: -8, transition: { duration: 0.2 } }}
          className="group"
        >
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 shadow-2xl hover:shadow-blue-500/25 hover:shadow-2xl transition-all duration-500 min-h-[100px] h-full">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-125 transition-transform duration-700" />
            <CardContent className="p-4 relative z-10 h-full flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium text-blue-100 leading-tight">إجمالي الفواتير</p>
                  <motion.p 
                    className="text-2xl font-bold text-white drop-shadow-lg leading-none"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                  >
                    {stats.totalInvoices}
                  </motion.p>
                </div>
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                  className="p-2.5 bg-white/20 backdrop-blur-sm rounded-lg shadow-lg flex-shrink-0"
                >
                  <Receipt className="h-6 w-6 text-white drop-shadow-sm" />
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pending Invoices Card - Vibrant Orange */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          whileHover={{ y: -8, transition: { duration: 0.2 } }}
          className="group"
        >
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 dark:from-orange-600 dark:via-red-600 dark:to-red-700 shadow-2xl hover:shadow-orange-500/25 hover:shadow-2xl transition-all duration-500 min-h-[100px] h-full">
            {/* Multiple decorative circles */}
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-125 transition-transform duration-700" />
            <div className="absolute -top-10 -right-10 w-16 h-16 bg-orange-300/20 rounded-full group-hover:scale-150 transition-transform duration-500" />
            <div className="absolute top-2 right-2 w-8 h-8 bg-white/15 rounded-full blur-sm group-hover:animate-pulse" />
            <div className="absolute bottom-4 left-4 w-12 h-12 bg-orange-400/10 rounded-full blur-lg group-hover:scale-110 transition-transform duration-600" />
            <div className="absolute bottom-8 left-8 w-6 h-6 bg-white/10 rounded-full" />
            
            {/* Glow effect overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <CardContent className="p-4 relative z-10 h-full flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium text-orange-100 leading-tight">فواتير معلقة</p>
                  <motion.p 
                    className="text-2xl font-bold text-white drop-shadow-lg leading-none"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.4 }}
                  >
                    {stats.pendingInvoices}
                  </motion.p>
                </div>
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                  className="p-2.5 bg-white/20 backdrop-blur-sm rounded-lg shadow-lg flex-shrink-0"
                >
                  <Clock className="h-6 w-6 text-white drop-shadow-sm" />
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Total Amount Card - Vibrant Emerald */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          whileHover={{ y: -8, transition: { duration: 0.2 } }}
          className="group"
        >
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 dark:from-emerald-600 dark:via-teal-600 dark:to-teal-700 shadow-2xl hover:shadow-emerald-500/25 hover:shadow-2xl transition-all duration-500 min-h-[100px] h-full">
            {/* Multiple decorative circles */}
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-125 transition-transform duration-700" />
            <div className="absolute -top-10 -right-10 w-16 h-16 bg-emerald-300/20 rounded-full group-hover:scale-150 transition-transform duration-500" />
            <div className="absolute top-2 right-2 w-8 h-8 bg-white/15 rounded-full blur-sm group-hover:animate-pulse" />
            <div className="absolute bottom-4 left-4 w-12 h-12 bg-emerald-400/10 rounded-full blur-lg group-hover:scale-110 transition-transform duration-600" />
            <div className="absolute bottom-8 left-8 w-6 h-6 bg-white/10 rounded-full" />
            
            {/* Glow effect overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <CardContent className="p-4 relative z-10 h-full flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium text-emerald-100 leading-tight">إجمالي المبالغ</p>
                  <motion.p 
                    className="text-2xl font-bold text-white drop-shadow-lg leading-none"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.5 }}
                  >
                    {stats.totalAmount.toLocaleString()}
                  </motion.p>
                  <p className="text-sm font-medium text-emerald-200">د.ع</p>
                </div>
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                  className="p-2.5 bg-white/20 backdrop-blur-sm rounded-lg shadow-lg flex-shrink-0"
                >
                  <Banknote className="h-6 w-6 text-white drop-shadow-sm" />
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Total Orders Card - Vibrant Purple */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          whileHover={{ y: -8, transition: { duration: 0.2 } }}
          className="group"
        >
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600 dark:from-purple-600 dark:via-indigo-600 dark:to-indigo-700 shadow-2xl hover:shadow-purple-500/25 hover:shadow-2xl transition-all duration-500 min-h-[100px] h-full">
            {/* Multiple decorative circles */}
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-125 transition-transform duration-700" />
            <div className="absolute -top-10 -right-10 w-16 h-16 bg-purple-300/20 rounded-full group-hover:scale-150 transition-transform duration-500" />
            <div className="absolute top-2 right-2 w-8 h-8 bg-white/15 rounded-full blur-sm group-hover:animate-pulse" />
            <div className="absolute bottom-4 left-4 w-12 h-12 bg-purple-400/10 rounded-full blur-lg group-hover:scale-110 transition-transform duration-600" />
            <div className="absolute bottom-8 left-8 w-6 h-6 bg-white/10 rounded-full" />
            
            {/* Glow effect overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <CardContent className="p-4 relative z-10 h-full flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium text-purple-100 leading-tight">إجمالي الطلبات</p>
                  <motion.p 
                    className="text-2xl font-bold text-white drop-shadow-lg leading-none"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.6 }}
                  >
                    {stats.totalOrders}
                  </motion.p>
                </div>
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                  className="p-2.5 bg-white/20 backdrop-blur-sm rounded-lg shadow-lg flex-shrink-0"
                >
                  <Package className="h-6 w-6 text-white drop-shadow-sm" />
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* فلاتر البحث - نفس تصميم AlWaseetInvoicesTab */}
      <Card dir="rtl">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button 
                onClick={handleRefresh} 
                disabled={loading}
                size="sm"
                variant="outline"
                className="px-3 py-2 h-9"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 ml-2" />
                    تحديث
                  </>
                )}
              </Button>
            </div>
            <span className="text-right">فواتير شركة التوصيل للموظف</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-6">
            {/* Time Filter and Status Filter - Equal Width Side by Side */}
            <div className="flex gap-2">
              <Select value={timeFilter} onValueChange={handleTimeFilterChange}>
                <SelectTrigger className="flex-1" dir="rtl">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="الفترة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">أسبوع</SelectItem>
                  <SelectItem value="month">شهر</SelectItem>
                  <SelectItem value="3months">3 أشهر</SelectItem>
                  <SelectItem value="6months">6 أشهر</SelectItem>
                  <SelectItem value="year">سنة</SelectItem>
                  <SelectItem value="all">كل الوقت</SelectItem>
                  <SelectItem value="custom">مخصص</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="flex-1" dir="rtl">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع</SelectItem>
                  <SelectItem value="pending">معلقة</SelectItem>
                  <SelectItem value="received">مُستلمة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Custom Date Range Picker */}
            {timeFilter === 'custom' && (
              <DateRangePicker
                date={customDateRange}
                onDateChange={handleCustomDateRangeChange}
                className="w-full"
              />
            )}
            
            {/* Search Filter */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="البحث برقم الفاتورة أو المبلغ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Results Summary */}
          <div className="flex items-center justify-between mb-4">
            <Badge variant="outline" className="text-sm">
              {filteredInvoices.length} فاتورة
            </Badge>
            {searchTerm && (
              <div className="text-sm text-muted-foreground">
                البحث عن: "{searchTerm}"
              </div>
            )}
          </div>

          {/* قائمة الفواتير مع رسالة عند عدم وجود بيانات */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <span className="mr-3 text-muted-foreground">جاري تحميل الفواتير...</span>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">لا توجد فواتير</h3>
                <p className="text-muted-foreground">
                  لم يتم العثور على فواتير لهذا الموظف في الفترة المحددة
                </p>
              </CardContent>
            </Card>
          ) : (
            <AlWaseetInvoicesList
              invoices={filteredInvoices}
              loading={false}
              onViewInvoice={handleViewInvoice}
            />
          )}
        </CardContent>
      </Card>

      {/* حوار تفاصيل الفاتورة */}
      <AlWaseetInvoiceDetailsDialog
        invoice={selectedInvoice}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
      />
    </div>
  );
};

export default EmployeeDeliveryInvoicesTab;