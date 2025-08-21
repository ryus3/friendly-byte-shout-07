import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  RefreshCw, 
  Search, 
  Package, 
  DollarSign, 
  FileText, 
  Clock,
  AlertTriangle,
  Calendar,
  TrendingUp
} from 'lucide-react';
import { useAlWaseetInvoices } from '@/hooks/useAlWaseetInvoices';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import AlWaseetInvoicesList from './AlWaseetInvoicesList';
import AlWaseetInvoiceDetailsDialog from './AlWaseetInvoiceDetailsDialog';

const AlWaseetInvoicesTab = () => {
  const { isLoggedIn, activePartner } = useAlWaseet();
  const { 
    invoices, 
    allInvoices,
    loading, 
    dateFilter,
    setDateFilter,
    fetchInvoices, 
    receiveInvoice,
    getInvoiceStats 
  } = useAlWaseetInvoices();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Filter invoices based on search and status
  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.id.toString().includes(searchTerm) ||
      invoice.merchant_price.toString().includes(searchTerm);
    
    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'received' && invoice.status === 'تم الاستلام من قبل التاجر') ||
      (statusFilter === 'pending' && invoice.status !== 'تم الاستلام من قبل التاجر');
    
    return matchesSearch && matchesStatus;
  });

  const stats = getInvoiceStats();

  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setDetailsDialogOpen(true);
  };

  const handleReceiveInvoice = async (invoiceId) => {
    return await receiveInvoice(invoiceId);
  };

  const handleRefresh = async () => {
    await fetchInvoices();
  };

  // Show message if not logged in to Al-Waseet
  if (!isLoggedIn || activePartner !== 'alwaseet') {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">غير متصل بالوسيط</h3>
          <p className="text-muted-foreground mb-4">
            يجب تسجيل الدخول إلى الوسيط أولاً لعرض الفواتير
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
            فواتير الوسيط
            <Button 
              onClick={handleRefresh} 
              disabled={loading}
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 mb-6">
            {/* Date and Status Filters Row */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-full sm:w-56">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="فترة زمنية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_week">آخر أسبوع</SelectItem>
                  <SelectItem value="last_month">آخر شهر</SelectItem>
                  <SelectItem value="last_3_months">آخر 3 أشهر</SelectItem>
                  <SelectItem value="all">جميع الفترات</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="حالة الفاتورة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفواتير</SelectItem>
                  <SelectItem value="pending">معلقة</SelectItem>
                  <SelectItem value="received">مُستلمة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Search Row */}
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
                عرض {filteredInvoices.length} من {allInvoices.length} فاتورة
              </span>
              {dateFilter !== 'all' && (
                <Badge variant="outline">
                  <Calendar className="h-3 w-3 mr-1" />
                  {dateFilter === 'last_week' ? 'آخر أسبوع' : 
                   dateFilter === 'last_month' ? 'آخر شهر' : 'آخر 3 أشهر'}
                </Badge>
              )}
              {statusFilter !== 'all' && (
                <Badge variant="outline">
                  {statusFilter === 'pending' ? 'معلقة' : 'مُستلمة'}
                </Badge>
              )}
            </div>
            
            {stats.pendingInvoices > 0 && (
              <div className="flex items-center gap-1 text-amber-600">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {stats.pendingInvoices} فاتورة معلقة
                </span>
              </div>
            )}
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