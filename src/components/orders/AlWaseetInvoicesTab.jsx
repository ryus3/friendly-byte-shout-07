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
  Receipt
} from 'lucide-react';
import { useAlWaseetInvoices } from '@/hooks/useAlWaseetInvoices';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import AlWaseetInvoicesList from './AlWaseetInvoicesList';
import AlWaseetInvoiceDetailsDialog from './AlWaseetInvoiceDetailsDialog';

const AlWaseetInvoicesTab = () => {
  const { isLoggedIn, activePartner, syncAllAvailableTokens } = useAlWaseet();
  const { 
    invoices, 
    loading, 
    fetchInvoices, 
    getInvoiceStats,
    applyCustomDateRangeFilter,
    syncLastTwoInvoices
  } = useAlWaseetInvoices();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  
  // Time filter state with localStorage - default to 'week' for better UX
  const [timeFilter, setTimeFilter] = useLocalStorage('alwaseet-invoices-time-filter', 'week');

  // Remove the useEffect - let the hook handle all loading automatically
  const [customDateRange, setCustomDateRange] = useState(null);

  // Filter invoices based on search, status, and time
  const filteredInvoices = useMemo(() => {
    let filtered = invoices;
    
    // Apply custom date range if selected
    if (timeFilter === 'custom' && customDateRange) {
      filtered = applyCustomDateRangeFilter(filtered, customDateRange);
    }
    
    // Apply search and status filters
    return filtered.filter(invoice => {
      const matchesSearch = 
        invoice.id.toString().includes(searchTerm) ||
        invoice.merchant_price.toString().includes(searchTerm);
      
      const matchesStatus = 
        statusFilter === 'all' || 
        (statusFilter === 'received' && invoice.status === 'تم الاستلام من قبل التاجر') ||
        (statusFilter === 'pending' && invoice.status !== 'تم الاستلام من قبل التاجر');
      
      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchTerm, statusFilter, timeFilter, customDateRange, applyCustomDateRangeFilter]);

  // ✅ المرحلة 4: تفعيل syncAllAvailableTokens تلقائياً عند فتح تبويب الفواتير
  useEffect(() => {
    if (isLoggedIn && (activePartner === 'alwaseet' || activePartner === 'modon')) {
      console.log('🔄 تبويب الفواتير نشط - جلب الفواتير تلقائياً');
      fetchInvoices(timeFilter, false); // جلب الفواتير بدون loading indicator
      
      // استدعاء syncAllAvailableTokens في الخلفية
      if (syncAllAvailableTokens) {
        console.log('🔄 تفعيل مزامنة كل الحسابات تلقائياً');
        syncAllAvailableTokens().then(result => {
          if (result.success) {
            console.log(`✅ مزامنة ${result.tokensSynced} حساب، تحديث ${result.totalOrdersUpdated} طلب`);
          }
        }).catch(err => {
          console.warn('⚠️ فشل في مزامنة كل الحسابات:', err);
        });
      }
    }
  }, [isLoggedIn, activePartner, timeFilter, fetchInvoices, syncAllAvailableTokens]);

  const stats = getInvoiceStats();

  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setDetailsDialogOpen(true);
  };


  const handleRefresh = async () => {
    await fetchInvoices(timeFilter, true); // force refresh with loading indicator
    await syncLastTwoInvoices();
  };
  
  const handleTimeFilterChange = async (newFilter) => {
    setTimeFilter(newFilter);
    if (newFilter !== 'custom') {
      setCustomDateRange(null);
      await fetchInvoices(newFilter, true); // force refresh with new filter and loading
    }
  };
  
  const handleCustomDateRangeChange = (dateRange) => {
    setCustomDateRange(dateRange);
  };


  // Show message if not logged in to delivery partner (support both AlWaseet and MODON)
  if (!isLoggedIn || (activePartner !== 'alwaseet' && activePartner !== 'modon')) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">غير متصل بشركة التوصيل</h3>
          <p className="text-muted-foreground mb-4">
            يجب تسجيل الدخول إلى شركة التوصيل (الوسيط أو مدن) أولاً لعرض الفواتير
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Revolutionary Statistics Cards - Equal Dimensions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Invoices Card - Vibrant Blue */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          whileHover={{ y: -8, transition: { duration: 0.2 } }}
          className="group"
        >
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 dark:from-blue-600 dark:via-blue-700 dark:to-blue-800 shadow-2xl hover:shadow-blue-500/25 hover:shadow-2xl transition-all duration-500 min-h-[100px] h-full">
            {/* Multiple decorative circles */}
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-125 transition-transform duration-700" />
            <div className="absolute -top-10 -right-10 w-16 h-16 bg-blue-300/20 rounded-full group-hover:scale-150 transition-transform duration-500" />
            <div className="absolute top-2 right-2 w-8 h-8 bg-white/15 rounded-full blur-sm group-hover:animate-pulse" />
            <div className="absolute bottom-4 left-4 w-12 h-12 bg-blue-400/10 rounded-full blur-lg group-hover:scale-110 transition-transform duration-600" />
            <div className="absolute bottom-8 left-8 w-6 h-6 bg-white/10 rounded-full" />
            
            {/* Glow effect overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
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

      {/* Filters and Actions */}
      <Card dir="rtl">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button 
                onClick={handleRefresh} 
                disabled={loading}
                size="sm"
              >
                تحديث
                <RefreshCw className={`h-4 w-4 ml-2 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <span className="text-right">
              فواتير {activePartner === 'modon' ? 'مدن' : activePartner === 'alwaseet' ? 'الوسيط' : 'شركة التوصيل'}
            </span>
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
                  <SelectItem value="week">أسبوع (افتراضي)</SelectItem>
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
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                عرض {filteredInvoices.length} من {invoices.length} فاتورة
              </span>
              {statusFilter !== 'all' && (
                <Badge variant="outline">
                  {statusFilter === 'pending' ? 'معلقة' : 'مُستلمة'}
                </Badge>
              )}
            </div>
          </div>

          {/* Invoices List */}
          <AlWaseetInvoicesList
            invoices={filteredInvoices}
            onViewInvoice={handleViewInvoice}
            loading={loading}
          />
        </CardContent>
      </Card>

      {/* Invoice Details Dialog */}
      <AlWaseetInvoiceDetailsDialog
        isOpen={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        invoice={selectedInvoice}
      />
    </div>
  );
};

export default AlWaseetInvoicesTab;