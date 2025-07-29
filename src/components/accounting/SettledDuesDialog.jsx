import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { CheckCircle2, FileText, Calendar, User, DollarSign, Receipt, Eye, Filter, Clock, Star, TrendingUp, Package, ShoppingCart } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

// مكون معاينة الفاتورة
const InvoicePreviewDialog = ({ invoice, open, onOpenChange }) => {
  const [relatedOrders, setRelatedOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && invoice) {
      fetchRelatedOrders();
    }
  }, [open, invoice]);

  const fetchRelatedOrders = async () => {
    if (!invoice.metadata?.employee_id) return;
    
    setLoading(true);
    try {
      // جلب الطلبات المسواة للموظف
      const { data: ordersData } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            *,
            product_variants(
              id,
              selling_price,
              cost_price,
              products(name),
              colors(name),
              sizes(name)
            )
          )
        `)
        .eq('created_by', invoice.metadata.employee_id)
        .eq('status', 'completed')
        .eq('receipt_received', true)
        .gte('created_at', new Date(new Date(invoice.settlement_date).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .lte('created_at', invoice.settlement_date);

      setRelatedOrders(ordersData || []);
    } catch (error) {
      console.error('خطأ في جلب الطلبات:', error);
    } finally {
      setLoading(false);
    }
  };

  // حساب الإحصائيات
  const stats = useMemo(() => {
    const totalRevenue = relatedOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    const totalCosts = relatedOrders.reduce((sum, order) => {
      const orderCost = order.order_items?.reduce((itemSum, item) => {
        const costPrice = item.product_variants?.cost_price || 0;
        return itemSum + (costPrice * item.quantity);
      }, 0) || 0;
      return sum + orderCost;
    }, 0);
    const totalOrders = relatedOrders.length;
    const totalItems = relatedOrders.reduce((sum, order) => {
      return sum + (order.order_items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0);
    }, 0);
    
    return {
      totalRevenue,
      totalCosts,
      grossProfit: totalRevenue - totalCosts,
      totalOrders,
      totalItems,
      profitMargin: totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue * 100) : 0
    };
  }, [relatedOrders]);

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 dark:from-slate-900 dark:via-slate-800/50 dark:to-slate-900 border-0 shadow-2xl">
        <ScrollArea className="h-full max-h-[85vh]">
          <div className="p-6">
            {/* Header أنيق */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-3 mb-4 p-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl text-white shadow-xl">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Receipt className="w-8 h-8" />
                </div>
                <div className="text-right">
                  <h1 className="text-2xl font-bold">فاتورة تسوية</h1>
                  <p className="text-blue-100 text-sm">معلومات الموظف</p>
                </div>
              </div>
            </div>

            {/* معلومات الموظف - تصميم مشابه للصورة */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-white/20 rounded-xl">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">اسم الموظف</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <Star className="w-5 h-5 text-yellow-300" />
                        <span className="text-2xl font-bold">{invoice.employee_name}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-white/20 rounded-xl">
                      <Receipt className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">رقم الفاتورة</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-2xl font-bold font-mono">{invoice.invoice_number}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ملخص الأرباح والإنجازات - تصميم مشابه للصورة */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center mb-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <ShoppingCart className="w-6 h-6" />
                    </div>
                  </div>
                  <h3 className="text-sm font-medium mb-1">عدد الطلبات</h3>
                  <p className="text-2xl font-bold">{stats.totalOrders}</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0 shadow-lg">
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center mb-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <DollarSign className="w-6 h-6" />
                    </div>
                  </div>
                  <h3 className="text-sm font-medium mb-1">إجمالي الإيرادات</h3>
                  <p className="text-2xl font-bold">{stats.totalRevenue.toLocaleString()}</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-lg">
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center mb-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Package className="w-6 h-6" />
                    </div>
                  </div>
                  <h3 className="text-sm font-medium mb-1">إجمالي التكاليف</h3>
                  <p className="text-2xl font-bold">{stats.totalCosts.toLocaleString()}</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-lg">
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center mb-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                  </div>
                  <h3 className="text-sm font-medium mb-1">ربح الموظف</h3>
                  <p className="text-2xl font-bold">{invoice.settlement_amount?.toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>

            {/* تفاصيل الطلبات المسواة */}
            <Card className="mb-6 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-border/50">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold">تفاصيل الطلبات المسواة</h3>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground mt-2">جاري تحميل الطلبات...</p>
                  </div>
                ) : relatedOrders.length > 0 ? (
                  <div className="space-y-4">
                    {/* Header للجدول */}
                    <div className="grid grid-cols-5 gap-4 p-3 bg-muted/50 rounded-lg font-semibold text-sm">
                      <span>رقم الطلب</span>
                      <span>الإيرادات</span>
                      <span>التكاليف</span>
                      <span>ربح الموظف</span>
                      <span>تاريخ التسوية</span>
                    </div>
                    
                    {relatedOrders.map((order) => {
                      const orderCost = order.order_items?.reduce((sum, item) => {
                        const costPrice = item.product_variants?.cost_price || 0;
                        return sum + (costPrice * item.quantity);
                      }, 0) || 0;
                      const orderRevenue = order.total_amount || 0;
                      const orderProfit = orderRevenue - orderCost;
                      
                      return (
                        <div key={order.id} className="grid grid-cols-5 gap-4 p-3 bg-card/50 rounded-lg border text-sm">
                          <span className="font-mono text-blue-600 dark:text-blue-400">{order.order_number}</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{orderRevenue.toLocaleString()}</span>
                          <span className="text-orange-600 dark:text-orange-400 font-semibold">{orderCost.toLocaleString()}</span>
                          <span className="text-purple-600 dark:text-purple-400 font-semibold">{orderProfit.toLocaleString()}</span>
                          <span className="text-muted-foreground">
                            {format(parseISO(order.created_at), 'dd/MM/yyyy', { locale: ar })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">لا توجد طلبات مسواة لهذه الفترة</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* معلومات إضافية */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-200 dark:border-emerald-800">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg text-white">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold text-emerald-700 dark:text-emerald-400">حالة التسوية</h3>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">تم إتمام الدفع بنجاح</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>معالج تلقائياً بواسطة النظام</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-200 dark:border-blue-800">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg text-white">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold text-blue-700 dark:text-blue-400">تاريخ الإصدار</h3>
                  </div>
                  <p className="text-sm font-medium">
                    {invoice.settlement_date || invoice.created_at ? 
                      format(parseISO(invoice.settlement_date || invoice.created_at), 'dd MMMM yyyy - HH:mm', { locale: ar }) :
                      format(new Date(), 'dd MMMM yyyy - HH:mm', { locale: ar })
                    }
                  </p>
                </CardContent>
              </Card>
            </div>
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
  const [selectedPeriod, setSelectedPeriod] = useState(initialFilters.period || 'month');
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

  // فلترة البيانات
  const filteredDues = useMemo(() => {
    return settledDues.filter(due => {
      const employeeMatch = selectedEmployee === 'all' || 
        due.employee_name?.toLowerCase().includes(
          employees.find(e => e.user_id === selectedEmployee)?.full_name?.toLowerCase() || ''
        );
      
      let dateMatch = true;
      
      // تطبيق فلتر الفترة
      if (selectedPeriod !== 'all') {
        const dueDate = new Date(due.settlement_date);
        const now = new Date();
        
        switch (selectedPeriod) {
          case 'today':
            dateMatch = dueDate.toDateString() === now.toDateString();
            break;
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            dateMatch = dueDate >= weekAgo;
            break;
          case 'month':
            const monthStart = startOfMonth(now);
            const monthEnd = endOfMonth(now);
            dateMatch = dueDate >= monthStart && dueDate <= monthEnd;
            break;
          case 'quarter':
            const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
            dateMatch = dueDate >= quarterStart;
            break;
        }
      }
      
      // تطبيق فلتر التاريخ المخصص
      if (dateRange?.from) {
        dateMatch = dateMatch && 
          new Date(due.settlement_date) >= dateRange.from && 
          new Date(due.settlement_date) <= (dateRange.to || new Date());
      }
      
      return employeeMatch && dateMatch;
    });
  }, [settledDues, selectedEmployee, selectedPeriod, dateRange, employees]);

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
                <SelectContent>
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