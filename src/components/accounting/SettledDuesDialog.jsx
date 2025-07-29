import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { CheckCircle2, FileText, Calendar, User, DollarSign, Receipt, Eye, Filter, Clock, Star } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

// مكون معاينة الفاتورة
const InvoicePreviewDialog = ({ invoice, open, onOpenChange, settledProfits, allOrders }) => {
  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-gradient-to-br from-background via-muted/30 to-background border-0 shadow-2xl">
        <ScrollArea className="h-full max-h-[80vh]">
          <div className="p-6">
            {/* Header */}
            <div className="text-center mb-8 pb-6 border-b border-border/60">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="p-3 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-xl text-white shadow-lg">
                  <Receipt className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                    فاتورة تسوية
                  </h1>
                  <p className="text-sm text-muted-foreground">مستحقات الموظف</p>
                </div>
              </div>
              
              <div className="inline-block bg-muted/50 backdrop-blur-sm rounded-xl px-6 py-3 shadow-sm border">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <p className="text-sm font-medium">
                    تاريخ الإصدار: {invoice.settlement_date || invoice.created_at ? 
                      format(parseISO(invoice.settlement_date || invoice.created_at), 'dd MMMM yyyy - HH:mm', { locale: ar }) :
                      format(new Date(), 'dd MMMM yyyy - HH:mm', { locale: ar })
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* معلومات الفاتورة */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* معلومات أساسية */}
              <div className="lg:col-span-2 space-y-4">
                <Card className="bg-card/50 backdrop-blur-sm border">
                  <CardContent className="p-5">
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg text-white">
                        <User className="w-4 h-4" />
                      </div>
                      معلومات الموظف
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-medium">اسم الموظف</p>
                        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                          <Star className="w-4 h-4 text-primary" />
                          <p className="font-semibold text-lg">{invoice.employee_name}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-medium">رقم الفاتورة</p>
                        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                          <Receipt className="w-4 h-4 text-primary" />
                          <p className="font-mono font-semibold text-primary">{invoice.invoice_number}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* المبلغ المدفوع */}
              <div className="space-y-4">
                <Card className="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white border-0 shadow-lg overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                  <CardContent className="p-5 relative z-10 text-center">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <div className="p-2 bg-white/20 rounded-lg">
                        <DollarSign className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold">المبلغ المدفوع</h3>
                    </div>
                    <p className="text-4xl font-bold mb-2 drop-shadow-sm">
                      {invoice.settlement_amount?.toLocaleString()}
                    </p>
                    <p className="text-sm font-medium opacity-90">دينار عراقي</p>
                  </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm border">
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg text-white">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <h3 className="text-sm font-semibold text-green-700 dark:text-green-400">تسوية مكتملة</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">تم إتمام الدفع بنجاح</p>
                    <div className="mt-3 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>معالج تلقائياً بواسطة النظام</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* وصف التسوية */}
            <Card className="bg-card/50 backdrop-blur-sm border">
              <CardContent className="p-5">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <div className="p-2 bg-gradient-to-r from-slate-600 to-slate-700 rounded-lg text-white">
                    <FileText className="w-4 h-4" />
                  </div>
                  وصف التسوية
                </h3>
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <p className="text-sm leading-relaxed">
                    {invoice.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
        
        <div className="p-6 border-t bg-muted/30">
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
  const [selectedPeriod, setSelectedPeriod] = useState(initialFilters.period || 'all');
  const [dateRange, setDateRange] = useState(initialFilters.dateRange || null);
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
        settledProfits={settledProfits}
        allOrders={allOrders}
      />
    </Dialog>
  );
};

export default SettledDuesDialog;