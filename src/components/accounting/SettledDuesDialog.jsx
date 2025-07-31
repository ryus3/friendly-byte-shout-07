import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { CheckCircle, FileText, Calendar, User, DollarSign, Receipt, Eye, TrendingUp, Banknote, Clock, Star, Award, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

// مكون معاينة الفاتورة
const InvoicePreviewDialog = ({ invoice, open, onOpenChange, settledProfits, allOrders }) => {
  if (!invoice) return null;

  console.log('🔍 فحص بيانات الفاتورة:', {
    invoice_number: invoice.invoice_number,
    employee_id: invoice.employee_id,
    order_ids: invoice.order_ids,
    profit_ids: invoice.profit_ids,
    settled_orders: invoice.settled_orders
  });

  // البحث عن الأرباح والطلبات المرتبطة بهذا الموظف
  const relatedProfits = settledProfits?.filter(profit => 
    profit.employee_id === invoice.employee_id
  ) || [];

  // البحث عن الطلبات المسواة
  let settledOrders = [];
  
  // أولاً: البحث عن الطلبات من order_ids إذا كانت موجودة
  if (invoice.order_ids && Array.isArray(invoice.order_ids) && invoice.order_ids.length > 0) {
    settledOrders = allOrders?.filter(order => 
      invoice.order_ids.includes(order.id)
    ) || [];
  }
  // ثانياً: البحث في settled_orders إذا كانت موجودة  
  else if (invoice.settled_orders && Array.isArray(invoice.settled_orders) && invoice.settled_orders.length > 0) {
    settledOrders = invoice.settled_orders.map(savedOrder => ({
      id: savedOrder.order_id,
      order_number: savedOrder.order_number,
      customer_name: savedOrder.customer_name,
      total_amount: savedOrder.order_total,
      employee_profit: savedOrder.employee_profit,
      created_at: savedOrder.order_date || new Date().toISOString()
    }));
  }
  // ثالثاً: البحث عن طلبات الموظف من الأرباح المسواة
  else if (relatedProfits.length > 0) {
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
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden">
        <ScrollArea className="h-full max-h-[85vh]">
          <div className="p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="p-3 bg-gradient-to-r from-emerald-500 to-blue-600 rounded-full text-white shadow-lg">
                  <Receipt className="w-10 h-10" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-100">فاتورة تسوية</h1>
                  <p className="text-lg text-slate-600 dark:text-slate-400">مستحقات الموظف</p>
                </div>
              </div>
              
              <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl px-8 py-4 inline-block shadow-md border">
                <div className="flex items-center gap-3">
                  <Calendar className="w-6 h-6 text-blue-600" />
                  <div className="text-right">
                    <p className="text-sm text-slate-600 dark:text-slate-400">تاريخ التسوية</p>
                    <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
                      {invoice.settlement_date ? 
                        format(parseISO(invoice.settlement_date), 'dd MMMM yyyy - HH:mm', { locale: ar }) :
                        format(new Date(), 'dd MMMM yyyy - HH:mm', { locale: ar })
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* معلومات الفاتورة */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* معلومات الموظف */}
              <Card className="lg:col-span-2">
                <CardContent className="p-6">
                  <h3 className="font-bold text-xl mb-6 flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                    معلومات الموظف والفاتورة
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">اسم الموظف</p>
                        <p className="font-bold text-2xl text-slate-800 dark:text-slate-100">{invoice.employee_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">معرف الموظف</p>
                        <p className="font-mono text-lg font-bold text-blue-600">{invoice.employee_code || invoice.invoice_number}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">رقم الفاتورة</p>
                        <p className="font-mono font-bold text-lg text-purple-700 dark:text-purple-400">{invoice.invoice_number}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">طريقة الدفع</p>
                        <p className="font-semibold text-slate-700 dark:text-slate-300">{invoice.payment_method === 'cash' ? 'نقدي' : invoice.payment_method}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* المبلغ المدفوع */}
              <Card className="bg-gradient-to-br from-emerald-500 to-blue-600 text-white shadow-xl">
                <CardContent className="p-6 text-center">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <DollarSign className="w-10 h-10" />
                    <h3 className="text-xl font-bold">المبلغ المدفوع</h3>
                  </div>
                  <p className="text-5xl font-black mb-2 drop-shadow-lg">
                    {invoice.total_amount?.toLocaleString()}
                  </p>
                  <p className="text-lg font-bold opacity-90">دينار عراقي</p>
                  <div className="mt-4 text-sm opacity-80">
                    تم الدفع بنجاح ✓
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* حالة التسوية */}
            <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                  <h3 className="text-2xl font-bold text-green-700 dark:text-green-400">تسوية مكتملة</h3>
                </div>
                <p className="text-green-600 dark:text-green-400 text-lg">تم إتمام الدفع وتسجيل جميع البيانات بنجاح</p>
                <div className="mt-3 text-sm text-green-600 dark:text-green-400 opacity-80">
                  ✓ تم خصم المبلغ من الخزنة الرئيسية
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
        
        <DialogFooter className="px-8 pb-6">
          <Button onClick={() => onOpenChange(false)} variant="outline" className="w-full">
            إغلاق الفاتورة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// المكون الرئيسي للمستحقات المدفوعة
const SettledDuesDialog = ({ open, onClose, employees, allOrders, settledProfits }) => {
  const [filters, setFilters] = useState({
    employeeId: 'all',
    period: 'month'
  });
  const [dateRange, setDateRange] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);

  // بيانات تجريبية للتصميم إذا لم تكن متوفرة
  const mockInvoices = [
    {
      id: 'inv_001',
      invoice_number: 'RY-EDC11E',
      employee_id: 'emp_001',
      employee_name: 'أحمد',
      employee_code: 'RY-EDC11E',
      total_amount: 7000,
      settlement_date: '2025-07-28T15:30:00Z',
      payment_method: 'cash',
      status: 'completed',
      order_ids: ['order_001'],
      profit_ids: ['profit_001']
    }
  ];

  // فلترة فواتير التسوية
  const filteredInvoices = useMemo(() => {
    let invoices = mockInvoices; // استخدام البيانات التجريبية للتصميم

    if (filters.employeeId !== 'all') {
      invoices = invoices.filter(inv => inv.employee_id === filters.employeeId);
    }

    if (dateRange?.from && dateRange?.to) {
      invoices = invoices.filter(inv => {
        const invDate = new Date(inv.settlement_date);
        return invDate >= dateRange.from && invDate <= dateRange.to;
      });
    }

    return invoices;
  }, [filters, dateRange]);

  // حساب الإحصائيات
  const stats = useMemo(() => {
    return filteredInvoices.reduce((acc, invoice) => ({
      totalAmount: acc.totalAmount + invoice.total_amount,
      totalInvoices: acc.totalInvoices + 1
    }), { totalAmount: 0, totalInvoices: 0 });
  }, [filteredInvoices]);

  const handleInvoiceClick = (invoice) => {
    console.log('📄 فتح فاتورة:', invoice);
    setSelectedInvoice(invoice);
    setIsInvoiceDialogOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-7xl max-h-[95vh] p-0 overflow-hidden bg-slate-900">
          <div className="h-full flex flex-col">
            {/* Header مع تدرج أخضر مذهل */}
            <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white p-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-black/10"></div>
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm shadow-2xl">
                    <CheckCircle className="w-12 h-12 text-white" />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black mb-2">المستحقات المدفوعة</h2>
                    <p className="text-xl text-white/90 font-medium">عرض وإدارة فواتير التحاسب المكتملة للموظفين</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onClose}
                  className="text-white hover:bg-white/20 w-12 h-12 rounded-xl"
                >
                  ✕
                </Button>
              </div>
            </div>

            <div className="flex-1 p-8 bg-slate-50 dark:bg-slate-900 overflow-auto">
              {/* الفلاتر */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-2">
                    <User className="w-4 h-4" />
                    الموظف
                  </Label>
                  <Select value={filters.employeeId} onValueChange={(value) => setFilters(prev => ({ ...prev, employeeId: value }))}>
                    <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                      <SelectValue placeholder="جميع الموظفين" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الموظفين</SelectItem>
                      {employees?.map(emp => (
                        <SelectItem key={emp.user_id} value={emp.user_id}>
                          {emp.full_name || emp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    فترة التاريخ
                  </Label>
                  <Select value={filters.period} onValueChange={(value) => setFilters(prev => ({ ...prev, period: value }))}>
                    <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">هذا الشهر</SelectItem>
                      <SelectItem value="week">هذا الأسبوع</SelectItem>
                      <SelectItem value="year">هذا العام</SelectItem>
                      <SelectItem value="custom">فترة مخصصة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {filters.period === 'custom' && (
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300 font-semibold">اختر التاريخ</Label>
                    <DateRangePicker 
                      value={dateRange} 
                      onChange={setDateRange}
                      className="bg-white dark:bg-slate-800"
                    />
                  </div>
                )}
              </div>

              {/* كارت الإحصائيات الرئيسي - مطابق للصورة */}
              <div className="relative mb-8">
                {/* الخلفية المتدرجة الأساسية */}
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 rounded-3xl transform rotate-1 shadow-2xl"></div>
                
                {/* المحتوى الرئيسي */}
                <Card className="relative bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 text-white border-0 rounded-3xl shadow-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-black/5"></div>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-24 -translate-x-24"></div>
                  
                  <CardContent className="relative z-10 p-8">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm shadow-lg">
                          <DollarSign className="w-12 h-12 text-white" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-white/90 mb-2">إجمالي المستحقات المدفوعة</h3>
                          <p className="text-lg text-white/80 font-medium">المبلغ الكلي للتسويات المكتملة</p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-6xl font-black text-white mb-2 drop-shadow-lg">
                          {stats.totalAmount.toLocaleString()}
                        </div>
                        <div className="text-xl font-bold text-white/90 mb-4">دينار عراقي</div>
                        <div className="flex items-center gap-2 text-white/80">
                          <Receipt className="w-5 h-5" />
                          <span className="font-semibold">عدد الفواتير: {stats.totalInvoices}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* جدول الفواتير - مطابق للصورة */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                {/* Header الجدول */}
                <div className="bg-slate-800 dark:bg-slate-900 text-white px-8 py-6">
                  <div className="grid grid-cols-6 gap-6 text-center font-bold text-lg">
                    <div className="text-purple-300">رقم الفاتورة</div>
                    <div className="text-blue-300">اسم الموظف</div>
                    <div className="text-green-300">المبلغ</div>
                    <div className="text-amber-300">تاريخ التسوية</div>
                    <div className="text-rose-300">الحالة</div>
                    <div className="text-cyan-300">الإجراءات</div>
                  </div>
                </div>

                {/* محتوى الجدول */}
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredInvoices.length > 0 ? (
                    filteredInvoices.map((invoice, index) => (
                      <div 
                        key={invoice.id}
                        className={`grid grid-cols-6 gap-6 py-6 px-8 text-center transition-all duration-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
                          index % 2 === 0 ? 'bg-slate-50/30 dark:bg-slate-800/30' : 'bg-white dark:bg-slate-800'
                        }`}
                      >
                        {/* رقم الفاتورة */}
                        <div className="flex items-center justify-center">
                          <div className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-mono font-bold px-4 py-2 rounded-xl shadow-lg">
                            <Receipt className="w-4 h-4" />
                            {invoice.invoice_number}
                          </div>
                        </div>

                        {/* اسم الموظف */}
                        <div className="flex items-center justify-center">
                          <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-xl">
                            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                              {invoice.employee_name.charAt(0)}
                            </div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{invoice.employee_name}</span>
                          </div>
                        </div>

                        {/* المبلغ */}
                        <div className="flex flex-col items-center justify-center">
                          <div className="text-3xl font-black text-green-600 dark:text-green-400 mb-1">
                            {invoice.total_amount.toLocaleString()}
                          </div>
                          <div className="text-sm text-green-500 font-semibold">د.ع</div>
                        </div>

                        {/* تاريخ التسوية */}
                        <div className="flex flex-col items-center justify-center">
                          <div className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">
                            {format(parseISO(invoice.settlement_date), 'dd/MM/yyyy', { locale: ar })}
                          </div>
                          <div className="text-sm text-amber-600 dark:text-amber-400 font-semibold">
                            {format(parseISO(invoice.settlement_date), 'HH:mm', { locale: ar })}
                          </div>
                        </div>

                        {/* الحالة */}
                        <div className="flex items-center justify-center">
                          <Badge className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 text-sm font-bold shadow-lg">
                            مكتملة
                          </Badge>
                        </div>

                        {/* الإجراءات */}
                        <div className="flex items-center justify-center">
                          <Button
                            onClick={() => handleInvoiceClick(invoice)}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 font-bold"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            معاينة
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-24 h-24 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Receipt className="w-12 h-12 text-slate-400" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-600 dark:text-slate-400 mb-2">لا توجد فواتير</h3>
                      <p className="text-slate-500 dark:text-slate-500">لم يتم العثور على أي فواتير مسواة بناءً على الفلاتر المحددة</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* معاينة الفاتورة */}
      <InvoicePreviewDialog
        invoice={selectedInvoice}
        open={isInvoiceDialogOpen}
        onOpenChange={setIsInvoiceDialogOpen}
        settledProfits={settledProfits}
        allOrders={allOrders}
      />
    </>
  );
};

export default SettledDuesDialog;