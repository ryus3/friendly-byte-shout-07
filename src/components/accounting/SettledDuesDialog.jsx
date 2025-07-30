import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { CheckCircle, FileText, Calendar, User, DollarSign, Receipt, Eye, TrendingUp, Banknote, Clock, Star, Award } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

// مكون معاينة الفاتورة
const InvoicePreviewDialog = ({ invoice, open, onOpenChange, settledProfits, allOrders }) => {
  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden">
        <ScrollArea className="h-full max-h-[85vh]">
          <div className="p-6">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="p-3 bg-gradient-to-r from-emerald-500 to-blue-600 rounded-full text-white">
                  <Receipt className="w-8 h-8" />
                </div>
                <h1 className="text-3xl font-bold">فاتورة تسوية</h1>
              </div>
              
              <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl px-6 py-3 inline-block">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <p className="text-lg font-semibold">
                    تاريخ التسوية: {invoice.settlement_date ? 
                      format(parseISO(invoice.settlement_date), 'dd MMMM yyyy - HH:mm', { locale: ar }) :
                      'غير محدد'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* معلومات الفاتورة */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-bold text-xl mb-4 flex items-center gap-2">
                    <User className="w-6 h-6 text-blue-600" />
                    معلومات الموظف
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">اسم الموظف</p>
                      <p className="font-bold text-xl">{invoice.employee_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">رقم الفاتورة</p>
                      <p className="font-mono font-bold text-lg text-purple-700">{invoice.invoice_number}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-500 to-blue-600 text-white">
                <CardContent className="p-6 text-center">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <DollarSign className="w-8 h-8" />
                    <h3 className="text-xl font-bold">المبلغ المدفوع</h3>
                  </div>
                  <p className="text-4xl font-black mb-2">
                    {invoice.total_amount?.toLocaleString()}
                  </p>
                  <p className="text-lg font-bold opacity-90">دينار عراقي</p>
                </CardContent>
              </Card>
            </div>

            {/* وصف التسوية */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <h3 className="font-bold text-xl mb-4 flex items-center gap-2">
                  <FileText className="w-6 h-6" />
                  وصف التسوية
                </h3>
                <p className="text-slate-700 dark:text-slate-300 text-lg">
                  {invoice.description}
                </p>
              </CardContent>
            </Card>

            {/* حالة التسوية */}
            <Card className="bg-green-50 dark:bg-green-900/20">
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <h3 className="text-xl font-bold text-green-700 dark:text-green-400">تسوية مكتملة</h3>
                </div>
                <p className="text-green-600 dark:text-green-400">تم إتمام الدفع بنجاح</p>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
        
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// المكون الرئيسي للمستحقات المدفوعة
const SettledDuesDialog = ({ open, onOpenChange, invoices, allUsers, profits = [], orders = [] }) => {
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [dateRange, setDateRange] = useState(null);
  const [settledProfits, setSettledProfits] = useState([]);

  // جلب فواتير التسوية الحقيقية
  const [realSettlementInvoices, setRealSettlementInvoices] = useState([]);
  const [loadingRealInvoices, setLoadingRealInvoices] = useState(false);

  // جلب الأرباح المسواة
  useEffect(() => {
    const fetchSettledProfits = async () => {
      try {
        const { data, error } = await supabase
          .from('profits')
          .select(`
            *,
            orders!inner(order_number, customer_name)
          `)
          .eq('status', 'settled');

        if (error) {
          console.error('خطأ في جلب الأرباح المسواة:', error);
        } else {
          const profitsWithOrderData = data?.map(profit => ({
            ...profit,
            order_number: profit.orders?.order_number,
            customer_name: profit.orders?.customer_name,
            employee_name: allUsers?.find(user => user.user_id === profit.employee_id)?.full_name || 'غير محدد'
          })) || [];
          
          setSettledProfits(profitsWithOrderData);
        }
      } catch (error) {
        console.error('خطأ غير متوقع:', error);
      }
    };

    if (open) {
      fetchSettledProfits();
    }
  }, [open, allUsers]);

  // جلب فواتير التسوية الحقيقية
  useEffect(() => {
    const fetchRealSettlementInvoices = async () => {
      setLoadingRealInvoices(true);
      try {
        const { data, error } = await supabase
          .from('settlement_invoices')
          .select('*')
          .order('settlement_date', { ascending: false });

        if (error) {
          console.error('خطأ في جلب فواتير التسوية الحقيقية:', error);
        } else {
          console.log('✅ تم جلب فواتير التسوية الحقيقية:', data?.length || 0);
          setRealSettlementInvoices(data || []);
        }
      } catch (error) {
        console.error('خطأ غير متوقع:', error);
      } finally {
        setLoadingRealInvoices(false);
      }
    };

    if (open) {
      fetchRealSettlementInvoices();
    }
  }, [open]);

  // معالجة فواتير التحاسب - الفواتير الحقيقية أولاً
  const settlementInvoices = useMemo(() => {
    console.log('🔄 معالجة فواتير التحاسب الحقيقية');
    
    let allInvoices = [];

    // إضافة الفواتير الحقيقية أولاً
    if (realSettlementInvoices && realSettlementInvoices.length > 0) {
      const realInvoices = realSettlementInvoices.map(invoice => ({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        employee_name: invoice.employee_name,
        employee_id: invoice.employee_id,
        total_amount: invoice.total_amount,
        settlement_date: invoice.settlement_date,
        created_at: invoice.created_at,
        description: invoice.description,
        status: invoice.status || 'completed',
        type: 'real_settlement',
        payment_method: invoice.payment_method,
        notes: invoice.notes
      }));
      
      allInvoices = [...realInvoices];
      console.log('✅ تمت إضافة الفواتير الحقيقية:', realInvoices.length);
    }

    // إضافة الفواتير القديمة فقط إذا لم توجد نسخة حقيقية
    if (invoices && Array.isArray(invoices)) {
      const legacyInvoices = invoices
        .filter(expense => {
          const invoiceNumber = expense.receipt_number || `RY-${expense.id.slice(-6).toUpperCase()}`;
          return !realSettlementInvoices.some(real => real.invoice_number === invoiceNumber);
        })
        .map(expense => {
          const employeeName = allUsers?.find(user => 
            user.user_id === expense.metadata?.employee_id
          )?.full_name || expense.metadata?.employee_name || 'غير محدد';
          
          return {
            id: expense.id,
            invoice_number: expense.receipt_number || `RY-${expense.id.slice(-6).toUpperCase()}`,
            employee_name: employeeName,
            employee_id: expense.metadata?.employee_id,
            total_amount: expense.amount,
            settlement_date: expense.created_at,
            created_at: expense.created_at,
            description: expense.description,
            status: 'completed',
            type: 'legacy',
            metadata: expense.metadata || {}
          };
        });
      
      allInvoices = [...allInvoices, ...legacyInvoices];
      console.log('📝 تمت إضافة الفواتير القديمة:', legacyInvoices.length);
    }

    return allInvoices;
  }, [realSettlementInvoices, invoices, allUsers]);

  // قائمة الموظفين الفريدة
  const employees = useMemo(() => {
    const uniqueEmployees = [...new Set(settlementInvoices.map(invoice => invoice.employee_name))];
    return uniqueEmployees.filter(name => name && name !== 'غير محدد');
  }, [settlementInvoices]);

  // تصفية الفواتير
  const filteredInvoices = useMemo(() => {
    let filtered = settlementInvoices;

    // تصفية حسب الموظف
    if (selectedEmployeeFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.employee_name === selectedEmployeeFilter);
    }

    // تصفية حسب التاريخ
    if (dateRange?.from && dateRange?.to) {
      filtered = filtered.filter(invoice => {
        if (!invoice.settlement_date) return false;
        const invoiceDate = new Date(invoice.settlement_date);
        return invoiceDate >= dateRange.from && invoiceDate <= dateRange.to;
      });
    }

    return filtered.sort((a, b) => new Date(b.settlement_date) - new Date(a.settlement_date));
  }, [settlementInvoices, selectedEmployeeFilter, dateRange]);

  // إجمالي المبلغ
  const totalAmount = useMemo(() => {
    return filteredInvoices.reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0);
  }, [filteredInvoices]);

  const handlePreviewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setShowPreview(true);
  };

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-right flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg text-white">
                <CheckCircle className="w-7 h-7" />
              </div>
              المستحقات المدفوعة
            </DialogTitle>
            <DialogDescription className="text-right text-lg">
              عرض جميع فواتير التسوية المكتملة للموظفين
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* الفلاتر */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[250px]">
                <Select value={selectedEmployeeFilter} onValueChange={setSelectedEmployeeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="جميع الموظفين" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الموظفين</SelectItem>
                    {employees.map(employee => (
                      <SelectItem key={employee} value={employee}>{employee}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1 min-w-[300px]">
                <DateRangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  placeholder="اختر فترة زمنية"
                />
              </div>
            </div>

            {/* الإحصائيات */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <CardContent className="p-4 text-center">
                  <FileText className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm opacity-90">عدد الفواتير</p>
                  <p className="text-2xl font-bold">{filteredInvoices.length}</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
                <CardContent className="p-4 text-center">
                  <DollarSign className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm opacity-90">إجمالي المبلغ</p>
                  <p className="text-2xl font-bold">{totalAmount.toLocaleString()}</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                <CardContent className="p-4 text-center">
                  <User className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm opacity-90">عدد الموظفين</p>
                  <p className="text-2xl font-bold">{employees.length}</p>
                </CardContent>
              </Card>
            </div>

            {/* جدول الفواتير */}
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
                      <TableRow>
                        <TableHead className="text-right font-bold">رقم الفاتورة</TableHead>
                        <TableHead className="text-right font-bold">اسم الموظف</TableHead>
                        <TableHead className="text-right font-bold">المبلغ</TableHead>
                        <TableHead className="text-right font-bold">تاريخ التسوية</TableHead>
                        <TableHead className="text-right font-bold">النوع</TableHead>
                        <TableHead className="text-right font-bold">الحالة</TableHead>
                        <TableHead className="text-center font-bold">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingRealInvoices ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            جاري تحميل البيانات...
                          </TableCell>
                        </TableRow>
                      ) : filteredInvoices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                            لا توجد فواتير تسوية
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredInvoices.map((invoice) => (
                          <TableRow key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                            <TableCell className="font-mono font-bold text-blue-600">
                              {invoice.invoice_number}
                            </TableCell>
                            <TableCell className="font-semibold">
                              {invoice.employee_name}
                            </TableCell>
                            <TableCell className="font-bold text-green-600">
                              {invoice.total_amount?.toLocaleString()} د.ع
                            </TableCell>
                            <TableCell>
                              {invoice.settlement_date ? 
                                format(parseISO(invoice.settlement_date), 'dd/MM/yyyy HH:mm', { locale: ar }) :
                                'غير محدد'
                              }
                            </TableCell>
                            <TableCell>
                              <Badge variant={invoice.type === 'real_settlement' ? 'default' : 'secondary'}>
                                {invoice.type === 'real_settlement' ? 'فاتورة حقيقية' : 'قديمة'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                مكتملة
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePreviewInvoice(invoice)}
                                className="gap-2"
                              >
                                <Eye className="w-4 h-4" />
                                معاينة الفاتورة
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} variant="outline">
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* نافذة معاينة الفاتورة */}
      <InvoicePreviewDialog
        invoice={selectedInvoice}
        open={showPreview}
        onOpenChange={setShowPreview}
        settledProfits={settledProfits}
        allOrders={orders}
      />
    </>
  );
};

export default SettledDuesDialog;