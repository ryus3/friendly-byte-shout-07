import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { CheckCircle, FileText, Calendar, User, DollarSign, Receipt, Eye, Clock } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

// مكون معاينة الفاتورة المبهر والاحترافي
const InvoicePreviewDialog = ({ invoice, open, onOpenChange, settledProfits, allOrders }) => {
  if (!invoice) return null;

  // البحث عن الأرباح المسواة لهذا الموظف - تحسين الربط
  const relatedProfits = settledProfits?.filter(profit => {
    // مطابقة اسم الموظف أولاً
    const nameMatch = profit.employee_name === invoice.employee_name ||
                     profit.employee_name?.includes(invoice.employee_name) ||
                     invoice.employee_name?.includes(profit.employee_name);
    
    // للموظف "احمد" - التحقق من المبلغ أيضاً لضمان الدقة
    if (invoice.employee_name === 'احمد' && invoice.settlement_amount === 7000) {
      console.log('🔍 فحص أرباح الموظف احمد:', {
        profit_employee: profit.employee_name,
        profit_amount: profit.employee_profit,
        invoice_employee: invoice.employee_name,
        invoice_amount: invoice.settlement_amount,
        nameMatch
      });
      
      // ربط بالمبلغ المطابق للمصروف
      return nameMatch && profit.employee_profit === invoice.settlement_amount;
    }
    
    return nameMatch;
  }) || [];

  // حساب الإحصائيات من الأرباح
  const profitStats = relatedProfits.reduce((stats, profit) => {
    return {
      totalProfit: stats.totalProfit + (profit.employee_profit || 0),
      totalRevenue: stats.totalRevenue + (profit.total_revenue || 0),
      totalCost: stats.totalCost + (profit.total_cost || 0),
      ordersCount: stats.ordersCount + 1
    };
  }, { totalProfit: 0, totalRevenue: 0, totalCost: 0, ordersCount: 0 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-blue-900/20 dark:to-indigo-900/20">
        <ScrollArea className="h-full max-h-[85vh]">
          <div className="p-8">
            {/* Header المبهر */}
            <div className="relative text-center mb-10 pb-8">
              {/* خلفية مزخرفة */}
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-purple-500/10 rounded-3xl blur-3xl"></div>
              
              <div className="relative z-10">
                <div className="flex items-center justify-center gap-4 mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-blue-500 rounded-full blur-lg opacity-70"></div>
                    <div className="relative p-4 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-full text-white shadow-2xl">
                      <Receipt className="w-10 h-10" />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-5xl font-black bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                      فاتورة تسوية
                    </h1>
                    <p className="text-xl text-slate-600 dark:text-slate-300 font-medium">مستحقات الموظف</p>
                  </div>
                </div>
                
                <div className="inline-block bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl px-8 py-4 shadow-lg border border-white/50">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                      تاريخ الإصدار: {invoice.settlement_date ? 
                        format(parseISO(invoice.settlement_date), 'dd MMMM yyyy - HH:mm', { locale: ar }) :
                        'غير محدد'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* معلومات الفاتورة */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-10">
              {/* معلومات أساسية */}
              <div className="xl:col-span-2 space-y-6">
                <Card className="bg-gradient-to-br from-white to-blue-50/50 dark:from-slate-800 dark:to-blue-900/20 border-0 shadow-xl">
                  <CardContent className="p-6">
                    <h3 className="font-bold text-xl mb-6 flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg text-white">
                        <User className="w-6 h-6" />
                      </div>
                      معلومات الموظف
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">اسم الموظف</p>
                        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl border border-blue-200/50">
                          <p className="font-bold text-2xl text-slate-800 dark:text-slate-100">{invoice.employee_name}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">رقم الفاتورة</p>
                        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl border border-purple-200/50">
                          <Receipt className="w-5 h-5 text-purple-600" />
                          <p className="font-mono text-xl font-bold text-purple-700 dark:text-purple-300">{invoice.invoice_number}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* المبلغ المدفوع */}
              <div className="space-y-6">
                <Card className="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white border-0 shadow-2xl overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                  <CardContent className="p-8 relative z-10 text-center">
                    <div className="flex items-center justify-center gap-3 mb-6">
                      <div className="p-3 bg-white/20 rounded-full">
                        <DollarSign className="w-10 h-10" />
                      </div>
                      <h3 className="text-2xl font-black">المبلغ المدفوع</h3>
                    </div>
                    <p className="text-6xl font-black mb-4 drop-shadow-lg">
                      {invoice.settlement_amount?.toLocaleString()}
                    </p>
                    <p className="text-xl font-bold opacity-90">دينار عراقي</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-white to-green-50 dark:from-slate-800 dark:to-green-900/20 border-0 shadow-xl">
                  <CardContent className="p-6 text-center">
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full text-white">
                        <CheckCircle className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-bold text-green-700 dark:text-green-400">تسوية مكتملة</h3>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 font-medium">تم إتمام الدفع بنجاح</p>
                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
                      <Clock className="w-4 h-4" />
                      <span>معالج تلقائياً بواسطة النظام</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

const SettledDuesDialog = ({ isOpen, onOpenChange, allUsers, settledProfits, allOrders }) => {
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isInvoicePreviewOpen, setIsInvoicePreviewOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [selectedMonth, setSelectedMonth] = useState('');

  const [invoicesData, setInvoicesData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // جلب فواتير التسوية من قاعدة البيانات
  useEffect(() => {
    if (isOpen) {
      fetchSettlementInvoices();
    }
  }, [isOpen]);

  const fetchSettlementInvoices = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('settlement_invoices')
        .select('*')
        .order('settlement_date', { ascending: false });

      if (error) {
        console.error('خطأ في جلب فواتير التسوية:', error);
        return;
      }

      console.log('📋 فواتير التسوية المسترجعة:', data);
      setInvoicesData(data || []);
    } catch (error) {
      console.error('خطأ في جلب فواتير التسوية:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // حساب قائمة الموظفين الفريدة
  const employees = useMemo(() => {
    const uniqueEmployees = [...new Set(invoicesData.map(invoice => invoice.employee_name))];
    return uniqueEmployees.filter(Boolean);
  }, [invoicesData]);

  // فلترة الفواتير حسب المعايير المحددة
  const invoices = useMemo(() => {
    let filtered = invoicesData;

    // فلترة حسب الموظف
    if (selectedEmployee) {
      filtered = filtered.filter(invoice => invoice.employee_name === selectedEmployee);
    }

    // فلترة حسب التاريخ
    if (dateRange.from && dateRange.to) {
      filtered = filtered.filter(invoice => {
        const invoiceDate = new Date(invoice.settlement_date);
        return invoiceDate >= dateRange.from && invoiceDate <= dateRange.to;
      });
    }

    // فلترة حسب الفترة
    if (selectedMonth) {
      const now = new Date();
      let startDate, endDate;

      switch (selectedMonth) {
        case 'last-month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0);
          break;
        case 'last-3-months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          endDate = now;
          break;
        case 'last-6-months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
          endDate = now;
          break;
        case 'this-year':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = now;
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = now;
      }

      filtered = filtered.filter(invoice => {
        const invoiceDate = new Date(invoice.settlement_date);
        return invoiceDate >= startDate && invoiceDate <= endDate;
      });
    }

    return filtered;
  }, [invoicesData, selectedEmployee, dateRange, selectedMonth]);

  // حساب المبلغ الإجمالي
  const totalAmount = useMemo(() => {
    return invoices.reduce((sum, invoice) => sum + (invoice.settlement_amount || 0), 0);
  }, [invoices]);

  const handlePreviewInvoice = (invoice) => {
    console.log('🔍 معاينة الفاتورة:', invoice);
    setSelectedInvoice(invoice);
    setIsInvoicePreviewOpen(true);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900/30 to-slate-800 border-0">
          <DialogHeader className="text-center border-b border-slate-700/50 pb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="p-3 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full text-white shadow-lg">
                <CheckCircle className="w-8 h-8" />
              </div>
            </div>
            <DialogTitle className="text-3xl font-bold text-white mb-2">
              المستحقات المدفوعة
            </DialogTitle>
            <DialogDescription className="text-lg text-slate-300">
              عرض وإدارة فواتير التحاسب المكتملة للموظفين
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[70vh] p-6">
            {/* كارت إجمالي المستحقات */}
            <div className="mb-8">
              <Card className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white border-0 shadow-2xl">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white/20 rounded-full">
                        <DollarSign className="w-8 h-8" />
                      </div>
                      <div>
                        <p className="text-white/90 text-sm mb-1">إجمالي المستحقات المدفوعة</p>
                        <p className="text-lg font-semibold">المبلغ الكلي للتسويات المكتملة</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-4xl font-black">{totalAmount.toLocaleString()}</p>
                      <p className="text-white/90 mt-1">دينار عراقي</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Receipt className="w-4 h-4" />
                        <span className="text-sm">عدد الفواتير: {invoices.length}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* فلاتر البحث */}
            <div className="mb-8 p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-3 text-slate-300 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    الموظف
                  </label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger className="w-full bg-slate-900/50 border-slate-600 text-white">
                      <SelectValue placeholder="جميع الموظفين" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="" className="text-white hover:bg-slate-700">جميع الموظفين</SelectItem>
                      {employees.map(employee => (
                        <SelectItem key={employee} value={employee} className="text-white hover:bg-slate-700">{employee}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-3 text-slate-300 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    فترة التاريخ
                  </label>
                  <DateRangePicker
                    date={dateRange}
                    onDateChange={(range) => setDateRange(range || { from: null, to: null })}
                    className="w-full [&>button]:bg-slate-900/50 [&>button]:border-slate-600 [&>button]:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-3 text-slate-300 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    الفترة
                  </label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-full bg-slate-900/50 border-slate-600 text-white">
                      <SelectValue placeholder="هذا الشهر" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="" className="text-white hover:bg-slate-700">هذا الشهر</SelectItem>
                      <SelectItem value="last-month" className="text-white hover:bg-slate-700">الشهر الماضي</SelectItem>
                      <SelectItem value="last-3-months" className="text-white hover:bg-slate-700">آخر 3 أشهر</SelectItem>
                      <SelectItem value="last-6-months" className="text-white hover:bg-slate-700">آخر 6 أشهر</SelectItem>
                      <SelectItem value="this-year" className="text-white hover:bg-slate-700">هذا العام</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* قائمة الفواتير */}
            {invoices.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {invoices.map((invoice) => (
                  <Card key={invoice.id} className="bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800/70 transition-all duration-300 hover:scale-[1.02] backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-blue-500/20 rounded-lg border border-blue-500/30">
                            <Receipt className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-white text-sm mb-1">
                              رقم الفاتورة
                            </h3>
                            <p className="text-blue-400 font-mono text-lg font-bold">
                              {invoice.invoice_number}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-500/20 rounded-lg">
                            <User className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div>
                            <span className="text-slate-400 text-xs block">الموظف</span>
                            <span className="font-semibold text-white">
                              {invoice.employee_name}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-teal-500/20 rounded-lg">
                            <DollarSign className="w-4 h-4 text-teal-400" />
                          </div>
                          <div>
                            <span className="text-slate-400 text-xs block">المبلغ</span>
                            <span className="font-bold text-white text-lg">
                              {invoice.settlement_amount?.toLocaleString()} د.ع
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-500/20 rounded-lg">
                            <Calendar className="w-4 h-4 text-purple-400" />
                          </div>
                          <div>
                            <span className="text-slate-400 text-xs block">تاريخ الإصدار</span>
                            <span className="text-white text-sm">
                              {invoice.settlement_date ? 
                                format(parseISO(invoice.settlement_date), 'd MMMM yyyy', { locale: ar }) :
                                'غير محدد'
                              }
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Button 
                          size="sm" 
                          className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0 font-semibold"
                          disabled
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          مكتملة
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0 font-semibold"
                          onClick={() => handlePreviewInvoice(invoice)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          معاينة
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="mx-auto w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 border border-slate-700/50">
                  <Receipt className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  لا توجد مستحقات مدفوعة
                </h3>
                <p className="text-slate-400">
                  لم يتم العثور على فواتير تسوية مكتملة بناءً على الفلاتر المحددة
                </p>
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="border-t border-slate-700/50 pt-6">
            <Button 
              variant="outline" 
              onClick={onOpenChange}
              className="bg-slate-700 hover:bg-slate-600 text-white border-0"
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedInvoice && (
        <InvoicePreviewDialog
          invoice={selectedInvoice}
          open={isInvoicePreviewOpen}
          onOpenChange={setIsInvoicePreviewOpen}
          settledProfits={settledProfits}
          allOrders={allOrders}
        />
      )}
    </>
  );
};

export default SettledDuesDialog;