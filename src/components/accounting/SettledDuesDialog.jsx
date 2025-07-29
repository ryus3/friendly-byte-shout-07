import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { CheckCircle2, FileText, Calendar, User, DollarSign, Receipt, Eye, Filter, Clock, Star, Package, ShoppingCart, TrendingUp, Calculator } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

// مكون معاينة الفاتورة
const InvoicePreviewDialog = ({ invoice, open, onOpenChange }) => {
  const [relatedOrders, setRelatedOrders] = useState([]);
  const [relatedProfits, setRelatedProfits] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && invoice) {
      fetchRelatedData();
    }
  }, [open, invoice]);

  const fetchRelatedData = async () => {
    if (!invoice?.metadata?.employee_id) return;
    
    setLoading(true);
    try {
      // جلب الأرباح المرتبطة بالموظف
      const { data: profitsData } = await supabase
        .from('profits')
        .select(`
          *,
          orders!inner(
            id, order_number, customer_name, total_amount, 
            status, created_at, customer_phone
          )
        `)
        .eq('employee_id', invoice.metadata.employee_id)
        .eq('status', 'settled')
        .gte('settled_at', new Date(invoice.created_at).toISOString().split('T')[0])
        .lt('settled_at', new Date(new Date(invoice.created_at).getTime() + 24*60*60*1000).toISOString().split('T')[0]);

      setRelatedProfits(profitsData || []);

      // جلب الطلبات من الأرباح
      const orderIds = profitsData?.map(p => p.order_id) || [];
      if (orderIds.length > 0) {
        const { data: ordersData } = await supabase
          .from('orders')
          .select(`
            *,
            order_items(
              id, quantity, unit_price, total_price,
              product_variants(
                id,
                products(name),
                colors(name),
                sizes(name)
              )
            )
          `)
          .in('id', orderIds);

        setRelatedOrders(ordersData || []);
      }
    } catch (error) {
      console.error('خطأ في جلب البيانات المرتبطة:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!invoice) return null;

  // حساب الإحصائيات
  const totalRevenue = relatedOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const totalProfit = relatedProfits.reduce((sum, profit) => sum + Number(profit.profit_amount || 0), 0);
  const totalItems = relatedOrders.reduce((sum, order) => 
    sum + (order.order_items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0), 0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[95vh] bg-gradient-to-br from-background via-muted/20 to-background border-0 shadow-2xl">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-8">
            {/* Header */}
            <div className="text-center pb-6 border-b border-border/60">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="p-3 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-xl text-white shadow-lg">
                  <Receipt className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                    فاتورة تسوية مفصلة
                  </h1>
                  <p className="text-sm text-muted-foreground">تفاصيل شاملة لمستحقات الموظف</p>
                </div>
              </div>
              
              <div className="inline-block bg-muted/50 backdrop-blur-sm rounded-xl px-6 py-3 shadow-sm border">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <p className="text-sm font-medium">
                    تاريخ التسوية: {format(parseISO(invoice.created_at), 'dd MMMM yyyy - HH:mm', { locale: ar })}
                  </p>
                </div>
              </div>
            </div>

            {/* معلومات أساسية */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-card/50 backdrop-blur-sm border">
                <CardHeader className="pb-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg text-white">
                      <User className="w-4 h-4" />
                    </div>
                    معلومات الموظف
                  </h3>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">اسم الموظف</p>
                      <p className="font-semibold">{invoice.employee_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">رقم الفاتورة</p>
                      <p className="font-mono text-primary font-semibold">{invoice.invoice_number}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white border-0">
                <CardHeader className="pb-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    المبلغ المدفوع
                  </h3>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-4xl font-bold mb-2">
                    {invoice.settlement_amount?.toLocaleString()}
                  </p>
                  <p className="text-sm opacity-90">دينار عراقي</p>
                  <Badge className="mt-3 bg-white/20 text-white border-0">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    تسوية مكتملة
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {/* إحصائيات مالية */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <ShoppingCart className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold text-blue-700 dark:text-blue-300">إجمالي المبيعات</h4>
                  </div>
                  <p className="text-2xl font-bold text-blue-600 mb-1">{totalRevenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">د.ع</p>
                </CardContent>
              </Card>

              <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <h4 className="font-semibold text-green-700 dark:text-green-300">إجمالي الأرباح</h4>
                  </div>
                  <p className="text-2xl font-bold text-green-600 mb-1">{totalProfit.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">د.ع</p>
                </CardContent>
              </Card>

              <Card className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Package className="w-5 h-5 text-purple-600" />
                    <h4 className="font-semibold text-purple-700 dark:text-purple-300">عدد المنتجات</h4>
                  </div>
                  <p className="text-2xl font-bold text-purple-600 mb-1">{totalItems}</p>
                  <p className="text-xs text-muted-foreground">قطعة</p>
                </CardContent>
              </Card>
            </div>

            {/* جدول الطلبات */}
            {relatedOrders.length > 0 && (
              <Card className="bg-card/50 backdrop-blur-sm border">
                <CardHeader>
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg text-white">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    الطلبات المرتبطة ({relatedOrders.length})
                  </h3>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">رقم الطلب</TableHead>
                          <TableHead className="text-right">العميل</TableHead>
                          <TableHead className="text-right">المبلغ</TableHead>
                          <TableHead className="text-right">المنتجات</TableHead>
                          <TableHead className="text-right">التاريخ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {relatedOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono font-semibold text-blue-600">
                              {order.order_number}
                            </TableCell>
                            <TableCell className="font-medium">{order.customer_name}</TableCell>
                            <TableCell className="font-semibold text-green-600">
                              {Number(order.total_amount).toLocaleString()} د.ع
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {order.order_items?.slice(0, 2).map((item, idx) => (
                                  <div key={idx} className="text-xs">
                                    {item.product_variants?.products?.name} - 
                                    {item.product_variants?.colors?.name} - 
                                    {item.product_variants?.sizes?.name} 
                                    (×{item.quantity})
                                  </div>
                                ))}
                                {order.order_items?.length > 2 && (
                                  <div className="text-xs text-muted-foreground">
                                    و {order.order_items.length - 2} منتجات أخرى...
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {format(parseISO(order.created_at), 'dd/MM/yyyy', { locale: ar })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* تفاصيل الأرباح */}
            {relatedProfits.length > 0 && (
              <Card className="bg-card/50 backdrop-blur-sm border">
                <CardHeader>
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg text-white">
                      <Calculator className="w-4 h-4" />
                    </div>
                    تفاصيل الأرباح ({relatedProfits.length})
                  </h3>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">رقم الطلب</TableHead>
                          <TableHead className="text-right">مبلغ الربح</TableHead>
                          <TableHead className="text-right">النسبة</TableHead>
                          <TableHead className="text-right">تاريخ التسوية</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {relatedProfits.map((profit) => (
                          <TableRow key={profit.id}>
                            <TableCell className="font-mono font-semibold text-blue-600">
                              {profit.orders?.order_number}
                            </TableCell>
                            <TableCell className="font-semibold text-green-600">
                              {Number(profit.profit_amount).toLocaleString()} د.ع
                            </TableCell>
                            <TableCell className="font-medium">
                              {profit.profit_percentage}%
                            </TableCell>
                            <TableCell className="text-sm">
                              {format(parseISO(profit.settled_at), 'dd/MM/yyyy HH:mm', { locale: ar })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* وصف التسوية */}
            <Card className="bg-card/50 backdrop-blur-sm border">
              <CardHeader>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <div className="p-2 bg-gradient-to-r from-slate-600 to-slate-700 rounded-lg text-white">
                    <FileText className="w-4 h-4" />
                  </div>
                  وصف التسوية
                </h3>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <p className="text-sm leading-relaxed">
                    {invoice.description || 'لا يوجد وصف إضافي للتسوية'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
        
        <div className="p-4 border-t bg-muted/30">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const SettledDuesDialog = ({ open, onOpenChange, initialFilters = {} }) => {
  const [selectedEmployee, setSelectedEmployee] = useState(initialFilters.employee || 'all');
  const [selectedPeriod, setSelectedPeriod] = useState(initialFilters.period || 'month'); // افتراضي: شهر
  const [dateRange, setDateRange] = useState(initialFilters.dateRange || {
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [settledDues, setSettledDues] = useState([]);
  const [settledProfits, setSettledProfits] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState(null);

  // جلب البيانات
  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // جلب الموظفين
      const { data: employeesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, role, status')
        .eq('status', 'active')
        .neq('role', 'admin');
      
      setEmployees(employeesData || []);

      // جلب المصاريف المدفوعة (المستحقات المدفوعة)
      const { data: expensesData } = await supabase
        .from('expenses')
        .select('*')
        .eq('category', 'مستحقات الموظفين')
        .eq('expense_type', 'system')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      // معالجة البيانات
      const processedDues = expensesData?.map(expense => ({
        id: expense.id,
        invoice_number: expense.receipt_number || `RY-${expense.id.slice(-6).toUpperCase()}`,
        employee_name: expense.vendor_name || extractEmployeeNameFromDescription(expense.description),
        settlement_amount: Number(expense.amount) || 0,
        settlement_date: expense.created_at, // استخدام created_at كتاريخ التسوية
        status: 'completed',
        description: expense.description,
        metadata: expense.metadata || {},
        receipt_number: expense.receipt_number,
        created_at: expense.created_at
      })) || [];

      setSettledDues(processedDues);

    } catch (error) {
      console.error('خطأ في جلب البيانات:', error);
    } finally {
      setLoading(false);
    }
  };

  // استخراج اسم الموظف من الوصف
  const extractEmployeeNameFromDescription = (description) => {
    if (!description || typeof description !== 'string') {
      return 'غير محدد';
    }
    
    const cleanDesc = description.trim();
    const match = cleanDesc.match(/الموظف\s+(.+?)(?:\s*$)/i);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    const words = cleanDesc.split(/\s+/);
    if (words.length >= 2) {
      return words[words.length - 1];
    }
    
    return 'غير محدد';
  };

  // تطبيق فلتر الفترة على dateRange
  useEffect(() => {
    const now = new Date();
    let newDateRange = null;

    switch (selectedPeriod) {
      case 'today':
        newDateRange = { from: now, to: now };
        break;
      case 'week':
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        newDateRange = { from: startOfWeek, to: endOfWeek };
        break;
      case 'month':
        newDateRange = {
          from: startOfMonth(new Date()),
          to: endOfMonth(new Date())
        };
        break;
      case 'quarter':
        const currentMonth = new Date().getMonth();
        const quarterStart = new Date(new Date().getFullYear(), Math.floor(currentMonth / 3) * 3, 1);
        const quarterEnd = new Date(new Date().getFullYear(), Math.floor(currentMonth / 3) * 3 + 3, 0);
        newDateRange = { from: quarterStart, to: quarterEnd };
        break;
      case 'all':
      default:
        newDateRange = null;
        break;
    }

    if (selectedPeriod !== 'all') {
      setDateRange(newDateRange);
    }
  }, [selectedPeriod]);

  // فلترة البيانات
  const filteredDues = useMemo(() => {
    return settledDues.filter(due => {
      // فلتر الموظف
      const employeeMatch = selectedEmployee === 'all' || 
        due.employee_name?.toLowerCase().includes(
          employees.find(e => e.user_id === selectedEmployee)?.full_name?.toLowerCase() || ''
        );
      
      // فلتر التاريخ
      const dateMatch = !dateRange?.from || 
        (new Date(due.settlement_date) >= dateRange.from && 
         new Date(due.settlement_date) <= (dateRange.to || new Date()));
      
      return employeeMatch && dateMatch;
    });
  }, [settledDues, selectedEmployee, dateRange, employees]);

  // حساب الإجمالي
  const totalAmount = useMemo(() => {
    return filteredDues.reduce((sum, due) => sum + (Number(due.settlement_amount) || 0), 0);
  }, [filteredDues]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[95vh] bg-gradient-to-br from-background via-muted/20 to-background border-0 shadow-2xl">
        {/* Header محسن ومدمج */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-purple-500/10 rounded-t-2xl"></div>
          <DialogHeader className="relative z-10 p-6 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-blue-500 rounded-xl blur-md opacity-60"></div>
                <div className="relative p-3 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-xl text-white shadow-lg">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>
              <div className="text-right">
                <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                  المستحقات المدفوعة
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  عرض وإدارة فواتير التحاسب المكتملة للموظفين
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        <ScrollArea className="flex-1 px-4">
          {/* فلاتر مدمجة وأنيقة */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6 p-4 bg-card/50 backdrop-blur-sm rounded-xl border">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <User className="w-3.5 h-3.5" />
                الموظف
              </label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="h-9 text-sm bg-background/50 border-border/50">
                  <SelectValue placeholder="جميع الموظفين" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="all">جميع الموظفين</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.user_id} value={emp.user_id}>
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                فترة التاريخ
              </label>
              <DateRangePicker
                date={dateRange}
                onDateChange={setDateRange}
                className="h-9 text-sm"
                placeholder="اختر تاريخين"
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Filter className="w-3.5 h-3.5" />
                الفترة
              </label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="h-9 text-sm bg-background/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كافة الفترات</SelectItem>
                  <SelectItem value="today">اليوم</SelectItem>
                  <SelectItem value="week">هذا الأسبوع</SelectItem>
                  <SelectItem value="month">هذا الشهر</SelectItem>
                  <SelectItem value="quarter">هذا الربع</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* كارت الإحصائيات المحسن */}
          <Card className="mb-6 bg-gradient-to-br from-emerald-500/90 via-teal-500/90 to-cyan-500/90 text-white border-0 shadow-xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
            <CardContent className="p-5 relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <DollarSign className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">إجمالي المستحقات المدفوعة</h3>
                    <p className="text-white/80 text-sm">المبلغ الكلي للتسويات المكتملة</p>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-black mb-1 drop-shadow-lg">
                    {totalAmount.toLocaleString()}
                  </p>
                  <p className="text-lg font-semibold opacity-90">دينار عراقي</p>
                  <div className="flex items-center justify-center gap-2 mt-2 text-white/80">
                    <Receipt className="w-4 h-4" />
                    <span className="text-sm font-medium">عدد الفواتير: {filteredDues.length}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* جدول البيانات المحسن */}
          {filteredDues.length > 0 ? (
            <div className="space-y-3">
              {filteredDues.map((due, index) => (
                <Card key={due.id} className="bg-card/80 backdrop-blur-sm border border-border/50 shadow-md hover:shadow-lg transition-all group">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                      {/* رقم الفاتورة */}
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg text-white group-hover:scale-105 transition-transform">
                          <Receipt className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">رقم الفاتورة</p>
                          <p className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">
                            {due.invoice_number}
                          </p>
                        </div>
                      </div>

                      {/* اسم الموظف */}
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full text-white">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">الموظف</p>
                          <p className="font-semibold text-foreground">
                            {due.employee_name}
                          </p>
                        </div>
                      </div>

                      {/* المبلغ */}
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-emerald-600" />
                        <div>
                          <p className="text-xs text-muted-foreground">المبلغ</p>
                          <p className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                            {due.settlement_amount?.toLocaleString()} د.ع
                          </p>
                        </div>
                      </div>

                      {/* تاريخ التسوية - محسن */}
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <div>
                          <p className="text-xs text-muted-foreground">تاريخ التسوية</p>
                          <p className="text-sm font-medium text-foreground">
                            {due.settlement_date || due.created_at ? 
                              format(parseISO(due.settlement_date || due.created_at), 'dd/MM/yyyy', { locale: ar }) :
                              format(new Date(), 'dd/MM/yyyy', { locale: ar })
                            }
                          </p>
                        </div>
                      </div>

                      {/* الحالة */}
                      <div className="flex justify-center">
                        <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-sm">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          مكتملة
                        </Badge>
                      </div>

                      {/* الإجراءات */}
                      <div className="flex justify-center">
                        <Button
                          onClick={() => setPreviewInvoice(due)}
                          size="sm"
                          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0 shadow-sm hover:shadow-md transition-all"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          معاينة
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-card/80 backdrop-blur-sm border-0 shadow-lg text-center py-12">
              <CardContent>
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-gradient-to-br from-muted to-muted/50 rounded-full">
                    <FileText className="w-12 h-12 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-2">
                      لا توجد مستحقات مدفوعة
                    </h3>
                    <p className="text-muted-foreground">
                      لم يتم العثور على أي فواتير تسوية مطابقة للمرشحات المحددة
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/30 flex justify-end">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="min-w-[120px]"
          >
            إغلاق
          </Button>
        </div>
      </DialogContent>
      
      {/* معاينة الفاتورة */}
      <InvoicePreviewDialog 
        invoice={previewInvoice}
        open={!!previewInvoice}
        onOpenChange={(open) => !open && setPreviewInvoice(null)}
      />
    </Dialog>
  );
};

export default SettledDuesDialog;