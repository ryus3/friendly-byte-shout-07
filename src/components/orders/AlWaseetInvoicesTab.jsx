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
  const { isLoggedIn, activePartner } = useAlWaseet();
  const { 
    invoices, 
    loading, 
    fetchInvoices, 
    receiveInvoice,
    getInvoiceStats,
    applyCustomDateRangeFilter
  } = useAlWaseetInvoices();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  
  // Time filter state with localStorage
  const [timeFilter, setTimeFilter] = useLocalStorage('alwaseet-invoices-time-filter', 'week');
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

  const stats = getInvoiceStats();

  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setDetailsDialogOpen(true);
  };

  const handleReceiveInvoice = async (invoiceId) => {
    return await receiveInvoice(invoiceId);
  };

  const handleRefresh = async () => {
    await fetchInvoices(timeFilter);
  };
  
  const handleTimeFilterChange = async (newFilter) => {
    setTimeFilter(newFilter);
    if (newFilter !== 'custom') {
      setCustomDateRange(null);
      await fetchInvoices(newFilter);
    }
  };
  
  const handleCustomDateRangeChange = (dateRange) => {
    setCustomDateRange(dateRange);
  };

  // Show message if not logged in to Al-Waseet
  if (!isLoggedIn || activePartner !== 'alwaseet') {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">غير متصل بشركة التوصيل</h3>
          <p className="text-muted-foreground mb-4">
            يجب تسجيل الدخول إلى شركة التوصيل أولاً لعرض الفواتير
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Revolutionary Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {/* Total Invoices Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          whileHover={{ y: -8, transition: { duration: 0.2 } }}
          className="group"
        >
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 dark:from-blue-950/50 dark:via-blue-900/30 dark:to-blue-800/20 shadow-xl hover:shadow-2xl transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-500" />
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">إجمالي الفواتير</p>
                  <motion.p 
                    className="text-3xl font-bold text-blue-900 dark:text-blue-100"
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
                  className="p-3 bg-blue-500/20 rounded-full"
                >
                  <Receipt className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pending Invoices Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          whileHover={{ y: -8, transition: { duration: 0.2 } }}
          className="group"
        >
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200 dark:from-amber-950/50 dark:via-amber-900/30 dark:to-amber-800/20 shadow-xl hover:shadow-2xl transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-amber-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-500" />
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300">فواتير معلقة</p>
                  <motion.p 
                    className="text-3xl font-bold text-amber-900 dark:text-amber-100"
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
                  className="p-3 bg-amber-500/20 rounded-full"
                >
                  <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Total Amount Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          whileHover={{ y: -8, transition: { duration: 0.2 } }}
          className="group"
        >
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-50 via-emerald-100 to-emerald-200 dark:from-emerald-950/50 dark:via-emerald-900/30 dark:to-emerald-800/20 shadow-xl hover:shadow-2xl transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-500" />
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">إجمالي المبالغ</p>
                  <motion.p 
                    className="text-3xl font-bold text-emerald-900 dark:text-emerald-100"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.5 }}
                  >
                    {stats.totalAmount.toLocaleString()}
                  </motion.p>
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">د.ع</p>
                </div>
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                  className="p-3 bg-emerald-500/20 rounded-full"
                >
                  <Banknote className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Total Orders Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          whileHover={{ y: -8, transition: { duration: 0.2 } }}
          className="group"
        >
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-50 via-purple-100 to-purple-200 dark:from-purple-950/50 dark:via-purple-900/30 dark:to-purple-800/20 shadow-xl hover:shadow-2xl transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-500" />
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300">إجمالي الطلبات</p>
                  <motion.p 
                    className="text-3xl font-bold text-purple-900 dark:text-purple-100"
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
                  className="p-3 bg-purple-500/20 rounded-full"
                >
                  <Package className="h-8 w-8 text-purple-600 dark:text-purple-400" />
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
            <Button 
              onClick={handleRefresh} 
              disabled={loading}
              size="sm"
            >
              تحديث
              <RefreshCw className={`h-4 w-4 ml-2 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <span className="text-right">فواتير شركة التوصيل</span>
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
            onReceiveInvoice={handleReceiveInvoice}
            loading={loading}
          />
        </CardContent>
      </Card>

      {/* Invoice Details Dialog */}
      <AlWaseetInvoiceDetailsDialog
        isOpen={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        invoice={selectedInvoice}
        onReceiveInvoice={handleReceiveInvoice}
      />
    </div>
  );
};

export default AlWaseetInvoicesTab;