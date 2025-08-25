import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { 
  RefreshCw, 
  Search, 
  Package, 
  DollarSign, 
  FileText, 
  Clock,
  AlertTriangle,
  Calendar
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

  // Auto invoice processing info
  const lastProcessedInvoiceId = typeof window !== 'undefined' ? localStorage.getItem('waseet:lastProcessedInvoiceId') : null;
  const lastProcessedAt = typeof window !== 'undefined' ? localStorage.getItem('waseet:lastProcessedAt') : null;

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
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الفواتير</p>
                <p className="text-2xl font-bold">{stats.totalInvoices}</p>
              </div>
              <FileText className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">فواتير معلقة</p>
                <p className="text-2xl font-bold">{stats.pendingInvoices}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المبالغ</p>
                <p className="text-2xl font-bold">{stats.totalAmount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">د.ع</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الطلبات</p>
                <p className="text-2xl font-bold">{stats.totalOrders}</p>
              </div>
              <Package className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            فواتير شركة التوصيل
            <div className="flex items-center gap-3">
              {lastProcessedInvoiceId && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  آخر معالجة: #{lastProcessedInvoiceId} • {lastProcessedAt ? new Date(lastProcessedAt).toLocaleString('ar-EG') : ''}
                </span>
              )}
              <Button 
                onClick={handleRefresh} 
                disabled={loading}
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                تحديث
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-6">
            {/* Time Filter and Status Filter - Always Side by Side */}
            <div className="flex flex-row gap-2 flex-wrap">
              <Select value={timeFilter} onValueChange={handleTimeFilterChange}>
                <SelectTrigger className="w-36 sm:w-40">
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
                <SelectTrigger className="w-36 sm:w-40">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع</SelectItem>
                  <SelectItem value="pending">معلقة</SelectItem>
                  <SelectItem value="received">مُستلمة</SelectItem>
                </SelectContent>
              </Select>
              
              {timeFilter === 'custom' && (
                <DateRangePicker
                  date={customDateRange}
                  onDateChange={handleCustomDateRangeChange}
                  className="w-40 sm:w-auto"
                />
              )}
            </div>
            
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