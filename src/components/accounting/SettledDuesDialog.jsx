import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { CheckCircle, FileText, Calendar, User, DollarSign, Receipt, Eye } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

// مكون معاينة الفاتورة المحسن
const InvoicePreviewDialog = ({ invoice, open, onOpenChange, settledProfits, allOrders }) => {
  if (!invoice) return null;

  // البحث عن الأرباح المرتبطة بهذا الموظف
  const relatedProfits = settledProfits?.filter(profit => 
    profit.employee_id === invoice.employee_id
  ) || [];

  // البحث عن الطلبات المسواة
  let settledOrders = [];
  
  if (invoice.order_ids && Array.isArray(invoice.order_ids) && invoice.order_ids.length > 0) {
    settledOrders = allOrders?.filter(order => 
      invoice.order_ids.includes(order.id)
    ) || [];
  } else if (invoice.settled_orders && Array.isArray(invoice.settled_orders) && invoice.settled_orders.length > 0) {
    settledOrders = invoice.settled_orders.map(savedOrder => ({
      id: savedOrder.order_id,
      order_number: savedOrder.order_number,
      customer_name: savedOrder.customer_name,
      total_amount: savedOrder.order_total,
      employee_profit: savedOrder.employee_profit,
      created_at: savedOrder.order_date || new Date().toISOString()
    }));
  } else if (relatedProfits.length > 0) {
    settledOrders = allOrders?.filter(order => 
      relatedProfits.some(profit => profit.order_id === order.id)
    ) || [];
  }

  // حساب الإحصائيات
  const stats = relatedProfits.reduce((acc, profit) => ({
    totalRevenue: acc.totalRevenue + (profit.total_revenue || 0),
    totalCost: acc.totalCost + (profit.total_cost || 0),
    totalProfit: acc.totalProfit + (profit.employee_profit || 0),
    ordersCount: acc.ordersCount + 1
  }), { totalRevenue: 0, totalCost: 0, totalProfit: 0, ordersCount: 0 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] bg-background">
        <DialogHeader className="text-center border-b pb-4">
          <DialogTitle className="text-2xl font-bold flex items-center justify-center gap-3">
            <Receipt className="h-6 w-6 text-primary" />
            فاتورة تسوية - {invoice.employee_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 p-6 overflow-y-auto max-h-[65vh]">
          {/* معلومات الفاتورة */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground">معلومات الفاتورة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">رقم الفاتورة:</span>
                  <span className="text-sm text-muted-foreground">{invoice.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">تاريخ التسوية:</span>
                  <span className="text-sm text-muted-foreground">
                    {invoice.settlement_date ? 
                      format(parseISO(invoice.settlement_date), 'dd/MM/yyyy - HH:mm', { locale: ar }) :
                      format(new Date(), 'dd/MM/yyyy - HH:mm', { locale: ar })
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">طريقة الدفع:</span>
                  <span className="text-sm text-muted-foreground">
                    {invoice.payment_method === 'cash' ? 'نقدي' : invoice.payment_method}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground">المبلغ المدفوع</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">
                    {(invoice.total_amount || 7000).toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">دينار عراقي</div>
                  <Badge variant="success" className="mt-2">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    تم الدفع
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* إحصائيات الطلبات */}
          {stats.ordersCount > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.ordersCount}</div>
                  <div className="text-sm text-muted-foreground">عدد الطلبات</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.totalRevenue.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">الإيرادات</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-2xl font-bold text-orange-600">{stats.totalCost.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">التكاليف</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-2xl font-bold text-purple-600">{stats.totalProfit.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">الربح</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* جدول الطلبات */}
          {settledOrders.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">الطلبات المسواة</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الطلب</TableHead>
                      <TableHead>العميل</TableHead>
                      <TableHead>المبلغ</TableHead>
                      <TableHead>الربح</TableHead>
                      <TableHead>التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settledOrders.map((order, index) => {
                      const orderProfit = relatedProfits.find(p => p.order_id === order.id);
                      return (
                        <TableRow key={order.id || index}>
                          <TableCell className="font-medium">{order.order_number}</TableCell>
                          <TableCell>{order.customer_name || 'غير محدد'}</TableCell>
                          <TableCell>{(order.total_amount || 0).toLocaleString()}</TableCell>
                          <TableCell>{(orderProfit?.employee_profit || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            {order.created_at ? 
                              format(parseISO(order.created_at), 'dd/MM/yyyy', { locale: ar }) :
                              'غير محدد'
                            }
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end gap-2 p-6 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const SettledDuesDialog = ({ 
  isOpen, 
  onClose, 
  settledProfits = [], 
  allOrders = [], 
  employees = [], 
  dateRange = null 
}) => {
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isInvoicePreviewOpen, setIsInvoicePreviewOpen] = useState(false);
  const [settlementInvoices, setSettlementInvoices] = useState([]);
  const [loading, setLoading] = useState(false);

  // جلب فواتير التسوية من قاعدة البيانات
  const fetchSettlementInvoices = async () => {
    console.log('🔄 جاري جلب فواتير التسوية...');
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('settlement_invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('خطأ في جلب فواتير التسوية:', error);
        return;
      }

      console.log('✅ تم جلب فواتير التسوية:', data?.length || 0);
      setSettlementInvoices(data || []);
    } catch (error) {
      console.error('خطأ في جلب فواتير التسوية:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('🔍 SettledDuesDialog useEffect:', { isOpen, isOpenType: typeof isOpen });
    if (isOpen) {
      console.log('✅ النافذة مفتوحة، بدء جلب البيانات...');
      fetchSettlementInvoices();
    }
  }, [isOpen]);

  // فلترة الفواتير حسب الموظف والفترة الزمنية
  const filteredInvoices = useMemo(() => {
    let filtered = settlementInvoices;

    // فلترة حسب الموظف
    if (selectedEmployee !== 'all') {
      filtered = filtered.filter(invoice => invoice.employee_id === selectedEmployee);
    }

    // فلترة حسب الفترة الزمنية
    if (dateRange?.from && dateRange?.to) {
      filtered = filtered.filter(invoice => {
        const invoiceDate = new Date(invoice.created_at);
        return invoiceDate >= new Date(dateRange.from) && invoiceDate <= new Date(dateRange.to);
      });
    }

    return filtered;
  }, [settlementInvoices, selectedEmployee, dateRange]);

  // خريطة الموظفين للحصول على الأسماء
  const employeesMap = useMemo(() => {
    const map = new Map();
    employees.forEach(emp => {
      if (emp && emp.user_id) {
        map.set(emp.user_id, emp.full_name || emp.name || 'غير معروف');
      }
    });
    return map;
  }, [employees]);

  // معاينة الفاتورة
  const handlePreviewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setIsInvoicePreviewOpen(true);
  };

  // حساب الإحصائيات
  const stats = useMemo(() => {
    return filteredInvoices.reduce((acc, invoice) => ({
      totalAmount: acc.totalAmount + (invoice.total_amount || 0),
      totalInvoices: acc.totalInvoices + 1
    }), { totalAmount: 0, totalInvoices: 0 });
  }, [filteredInvoices]);

  console.log('🔍 SettledDuesDialog Props:', {
    isOpen,
    settledProfitsCount: settledProfits?.length || 0,
    allOrdersCount: allOrders?.length || 0,
    employeesCount: employees?.length || 0,
    settlementInvoicesCount: settlementInvoices?.length || 0,
    loading
  });

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[85vh] bg-background">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <DollarSign className="h-6 w-6 text-primary" />
              المستحقات المدفوعة
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 p-6">
            {/* فلاتر */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="اختر موظف" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الموظفين</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.user_id} value={emp.user_id}>
                      {emp.full_name || emp.name || 'غير معروف'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <DateRangePicker
                dateRange={dateRange}
                onDateRangeChange={() => {}}
                className="w-full sm:w-auto"
              />
            </div>

            {/* إحصائيات */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Receipt className="h-8 w-8 text-blue-600" />
                    <div>
                      <div className="text-2xl font-bold">{stats.totalInvoices}</div>
                      <div className="text-sm text-muted-foreground">إجمالي الفواتير</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-8 w-8 text-green-600" />
                    <div>
                      <div className="text-2xl font-bold">{stats.totalAmount.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">إجمالي المدفوعات</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* قائمة الفواتير */}
            <div className="space-y-4 max-h-[40vh] overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">
                  <div className="text-muted-foreground">جاري التحميل...</div>
                </div>
              ) : filteredInvoices.length > 0 ? (
                filteredInvoices.map((invoice) => (
                  <Card key={invoice.id} className="hover:bg-muted/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <User className="h-5 w-5 text-muted-foreground" />
                            <span className="font-medium">
                              {employeesMap.get(invoice.employee_id) || invoice.employee_name || 'غير معروف'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              فاتورة رقم: {invoice.invoice_number}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {format(parseISO(invoice.settlement_date || invoice.created_at), 'dd/MM/yyyy - HH:mm', { locale: ar })}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-lg font-bold text-primary">
                              {(invoice.total_amount || 0).toLocaleString()}
                            </div>
                            <div className="text-sm text-muted-foreground">دينار عراقي</div>
                          </div>
                          <Button 
                            onClick={() => handlePreviewInvoice(invoice)}
                            size="sm"
                            variant="outline"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            معاينة
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-12">
                  <Receipt className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">لا توجد مستحقات مدفوعة</h3>
                  <p className="text-sm text-muted-foreground">لم يتم العثور على أي فواتير تسوية في الفترة المحددة</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end p-6 border-t">
            <Button onClick={() => onClose()} className="w-full sm:w-auto">
              إغلاق
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* نافذة معاينة الفاتورة */}
      <InvoicePreviewDialog
        invoice={selectedInvoice}
        open={isInvoicePreviewOpen}
        onOpenChange={setIsInvoicePreviewOpen}
        settledProfits={settledProfits}
        allOrders={allOrders}
      />
    </>
  );
};

export default SettledDuesDialog;