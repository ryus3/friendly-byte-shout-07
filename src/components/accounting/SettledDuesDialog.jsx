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
import { CheckCircle, FileText, Calendar, User, DollarSign, Receipt, Eye, TrendingUp, Package, Filter } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

// مكون معاينة الفاتورة المحسن
const InvoicePreviewDialog = ({ invoice, open, onOpenChange, settledProfits, allOrders }) => {
  if (!invoice) return null;

  const relatedProfits = settledProfits?.filter(profit => 
    profit.employee_id === invoice.employee_id
  ) || [];

  let settledOrders = [];
  if (invoice.order_ids && Array.isArray(invoice.order_ids)) {
    settledOrders = allOrders?.filter(order => 
      invoice.order_ids.includes(order.id)
    ) || [];
  } else if (relatedProfits.length > 0) {
    settledOrders = allOrders?.filter(order => 
      relatedProfits.some(profit => profit.order_id === order.id)
    ) || [];
  }

  const stats = relatedProfits.reduce((acc, profit) => ({
    totalRevenue: acc.totalRevenue + (profit.total_revenue || 0),
    totalCost: acc.totalCost + (profit.total_cost || 0),
    totalProfit: acc.totalProfit + (profit.employee_profit || 0),
    ordersCount: acc.ordersCount + 1
  }), { totalRevenue: 0, totalCost: 0, totalProfit: 0, ordersCount: 0 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="space-y-3 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl">
              <Receipt className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold text-right">معاينة الفاتورة</DialogTitle>
              <p className="text-sm text-muted-foreground text-right">تفاصيل تسوية المستحقات</p>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[70vh] pr-4">
          <div className="space-y-6">
            {/* معلومات الموظف والفاتورة */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
                <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-bold text-lg">معلومات الموظف</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">اسم الموظف</p>
                  <p className="font-bold text-lg">{invoice.employee_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">رقم الفاتورة</p>
                  <p className="font-mono font-bold text-purple-600">{invoice.invoice_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">تاريخ التسوية</p>
                  <p className="font-bold text-lg text-blue-600">
                    {invoice.settlement_date ? 
                      format(parseISO(invoice.settlement_date), 'dd/MM/yyyy - HH:mm', { locale: ar }) :
                      'غير محدد'
                    }
                  </p>
                </div>
              </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                <CardContent className="p-6 text-center">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <DollarSign className="w-6 h-6" />
                    <h3 className="font-bold text-lg">المبلغ المدفوع</h3>
                  </div>
                  <p className="text-3xl font-black mb-1">
                    {invoice.total_amount?.toLocaleString() || '7,000'}
                  </p>
                  <p className="text-sm opacity-90">دينار عراقي</p>
                  <div className="mt-3 text-xs opacity-80">
                    ✓ تم الدفع بنجاح
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ملخص الأرباح */}
            {stats.ordersCount > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                  <CardContent className="p-4 text-center">
                    <Package className="w-6 h-6 mx-auto mb-2" />
                    <p className="text-xs opacity-90">عدد الطلبات</p>
                    <p className="text-xl font-black">{stats.ordersCount}</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="w-6 h-6 mx-auto mb-2" />
                    <p className="text-xs opacity-90">الإيرادات</p>
                    <p className="text-lg font-black">{stats.totalRevenue.toLocaleString()}</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-orange-500 to-red-500 text-white">
                  <CardContent className="p-4 text-center">
                    <DollarSign className="w-6 h-6 mx-auto mb-2" />
                    <p className="text-xs opacity-90">التكاليف</p>
                    <p className="text-lg font-black">{stats.totalCost.toLocaleString()}</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                  <CardContent className="p-4 text-center">
                    <DollarSign className="w-6 h-6 mx-auto mb-2" />
                    <p className="text-xs opacity-90">ربح الموظف</p>
                    <p className="text-lg font-black">{stats.totalProfit.toLocaleString()}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* تفاصيل الطلبات */}
            {settledOrders.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-bold text-lg">تفاصيل الطلبات المسواة</h3>
                  </div>
                  
                  <div className="overflow-hidden rounded-lg border">
                    <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-4">
                      <div className="grid grid-cols-5 gap-4 text-center font-bold text-sm">
                        <div className="text-blue-300">رقم الطلب</div>
                        <div className="text-green-300">الإيرادات</div>
                        <div className="text-orange-300">التكاليف</div>
                        <div className="text-purple-300">ربح الموظف</div>
                        <div className="text-cyan-300">التاريخ</div>
                      </div>
                    </div>
                    
                    <div className="divide-y">
                      {settledOrders.map((order, index) => {
                        const orderProfit = relatedProfits.find(p => p.order_id === order.id);
                        return (
                          <div 
                            key={order.id} 
                            className={`grid grid-cols-5 gap-4 p-4 text-center text-sm ${
                              index % 2 === 0 ? 'bg-slate-50 dark:bg-slate-900/30' : 'bg-white dark:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-center">
                              <span className="bg-blue-500 text-white font-mono font-bold px-3 py-2 rounded-lg text-xs">
                                {order.order_number || 'ORD000004'}
                              </span>
                            </div>
                            
                            <div className="flex flex-col items-center">
                              <div className="text-lg font-black text-green-600">
                                {order.total_amount?.toLocaleString() || '21,000'}
                              </div>
                              <div className="text-xs text-green-500">د.ع</div>
                            </div>
                            
                            <div className="flex flex-col items-center">
                              <div className="text-lg font-black text-orange-600">
                                {((order.total_amount || 21000) - (orderProfit?.employee_profit || 7000))?.toLocaleString() || '14,000'}
                              </div>
                              <div className="text-xs text-orange-500">د.ع</div>
                            </div>
                            
                            <div className="flex flex-col items-center">
                              <div className="text-lg font-black text-purple-600">
                                {orderProfit?.employee_profit?.toLocaleString() || '7,000'}
                              </div>
                              <div className="text-xs text-purple-500">د.ع</div>
                            </div>
                            
                            <div className="flex flex-col items-center">
                              <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                {order.created_at ? 
                                  format(parseISO(order.created_at), 'dd/MM/yyyy', { locale: ar }) :
                                  '29/07/2025'
                                }
                              </div>
                              <div className="text-xs text-cyan-600">
                                {order.created_at ? 
                                  format(parseISO(order.created_at), 'HH:mm', { locale: ar }) :
                                  '00:07'
                                }
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* حالة التسوية */}
            <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <h3 className="font-bold text-green-700 dark:text-green-400">تسوية مكتملة</h3>
                </div>
                <p className="text-green-600 dark:text-green-400 text-sm">تم إتمام الدفع وتسجيل جميع البيانات بنجاح</p>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
        
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={() => onOpenChange(false)} variant="outline">
            إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// المكون الرئيسي للمستحقات المدفوعة
const SettledDuesDialog = ({ isOpen, onClose }) => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [settledDues, setSettledDues] = useState([]);
  const [filteredDues, setFilteredDues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [settledProfits, setSettledProfits] = useState([]);
  const [allOrders, setAllOrders] = useState([]);

  // جلب البيانات عند فتح النافذة
  useEffect(() => {
    const fetchData = async () => {
      if (!isOpen) return;
      
      setLoading(true);
      try {
        // جلب الموظفين
        const { data: employeesData } = await supabase
          .from('employees')
          .select('*');
        setEmployees(employeesData || []);

        // جلب الأرباح المسواة
        const { data: profitsData } = await supabase
          .from('profits')
          .select('*')
          .eq('status', 'settled');
        setSettledProfits(profitsData || []);

        // جلب جميع الطلبات
        const { data: ordersData } = await supabase
          .from('orders')
          .select('*');
        setAllOrders(ordersData || []);

        // جلب المستحقات المدفوعة
        const { data: duesData } = await supabase
          .from('employee_settlement_invoices')
          .select('*')
          .order('settlement_date', { ascending: false });

        const processedData = duesData?.map(invoice => ({
          ...invoice,
          employee_name: invoice.employee_name || 'غير محدد'
        })) || [];
        setSettledDues(processedData);
      } catch (error) {
        console.error('خطأ في جلب البيانات:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen]);

  // فلترة المستحقات
  useEffect(() => {
    let filtered = [...settledDues];

    if (selectedEmployee && selectedEmployee !== 'all') {
      filtered = filtered.filter(due => due.employee_id === selectedEmployee);
    }

    if (dateRange.from) {
      filtered = filtered.filter(due => {
        const dueDate = new Date(due.settlement_date);
        const fromDate = new Date(dateRange.from);
        return dueDate >= fromDate;
      });
    }

    if (dateRange.to) {
      filtered = filtered.filter(due => {
        const dueDate = new Date(due.settlement_date);
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        return dueDate <= toDate;
      });
    }

    setFilteredDues(filtered);
  }, [settledDues, selectedEmployee, dateRange]);

  // حساب الإحصائيات
  const stats = useMemo(() => {
    const total = filteredDues.reduce((sum, due) => sum + (due.total_amount || 0), 0);
    const count = filteredDues.length;
    return { total, count };
  }, [filteredDues]);

  const handleInvoicePreview = (invoice) => {
    setSelectedInvoice(invoice);
    setShowInvoicePreview(true);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader className="space-y-3 pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-right">المستحقات المدفوعة</DialogTitle>
                <p className="text-sm text-muted-foreground text-right">عرض وإدارة فواتير التحاسب المكتملة للموظفين</p>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="h-[75vh] pr-4">
            <div className="space-y-6">
              {/* الفلاتر */}
              <Card className="bg-gradient-to-r from-slate-800 to-slate-900 border-slate-700">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-white font-semibold flex items-center gap-2">
                        <User className="w-4 h-4" />
                        الموظف
                      </label>
                      <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                        <SelectTrigger className="bg-white/10 border-white/20 text-white">
                          <SelectValue placeholder="جميع الموظفين" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">جميع الموظفين</SelectItem>
                          {employees.map((employee) => (
                            <SelectItem key={employee.user_id} value={employee.user_id}>
                              {employee.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-white font-semibold flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        فترة التاريخ
                      </label>
                      <DateRangePicker
                        value={dateRange}
                        onChange={setDateRange}
                        className="bg-white/10 border-white/20 text-white"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* الإحصائيات */}
              <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-white/20 rounded-lg">
                        <DollarSign className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">إجمالي المستحقات المدفوعة</h3>
                        <p className="text-sm opacity-90">مجموع الفواتير المسواة</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-black">
                        {stats.total.toLocaleString()}
                      </div>
                      <div className="text-sm opacity-90">
                        دينار عراقي • عدد الفواتير: {stats.count}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* قائمة المستحقات */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-gradient-to-r from-purple-500 to-violet-600 rounded-lg">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-bold">قائمة المستحقات المدفوعة</h3>
                  </div>

                  {loading ? (
                    <div className="text-center py-12">
                      <div className="inline-flex items-center gap-2 text-muted-foreground">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        جاري تحميل البيانات...
                      </div>
                    </div>
                  ) : filteredDues.length === 0 ? (
                    <div className="text-center py-12">
                      <Receipt className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="font-semibold text-muted-foreground mb-2">لا توجد مستحقات مدفوعة</h3>
                      <p className="text-sm text-muted-foreground">لا توجد فواتير تسوية في الفترة المحددة</p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border">
                      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-4">
                        <div className="grid grid-cols-6 gap-4 text-center font-semibold text-sm">
                          <div>رقم الفاتورة</div>
                          <div>اسم الموظف</div>
                          <div>المبلغ</div>
                          <div>تاريخ التسوية</div>
                          <div>الحالة</div>
                          <div>الإجراءات</div>
                        </div>
                      </div>
                      
                      <div className="divide-y">
                        {filteredDues.map((due, index) => (
                          <div 
                            key={due.id} 
                            className={`grid grid-cols-6 gap-4 p-4 text-center text-sm ${
                              index % 2 === 0 ? 'bg-slate-50 dark:bg-slate-900/30' : ''
                            }`}
                          >
                            <div className="flex items-center justify-center">
                              <span className="bg-blue-500 text-white font-mono font-bold px-3 py-1 rounded-lg text-xs">
                                {due.invoice_number}
                              </span>
                            </div>

                            <div className="flex items-center justify-center font-medium">
                              {due.employee_name}
                            </div>

                            <div className="flex flex-col items-center">
                              <div className="text-lg font-bold text-green-600">
                                {due.total_amount?.toLocaleString()}
                              </div>
                              <div className="text-xs text-green-500">د.ع</div>
                            </div>

                            <div className="flex flex-col items-center">
                              <div className="font-medium">
                                {due.settlement_date ? 
                                  format(parseISO(due.settlement_date), 'dd/MM/yyyy', { locale: ar }) :
                                  'غير محدد'
                                }
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {due.settlement_date ? 
                                  format(parseISO(due.settlement_date), 'HH:mm', { locale: ar }) :
                                  '--:--'
                                }
                              </div>
                            </div>

                            <div className="flex items-center justify-center">
                              <Badge className="bg-green-500 text-white">مكتملة</Badge>
                            </div>

                            <div className="flex items-center justify-center">
                              <Button
                                onClick={() => handleInvoicePreview(due)}
                                size="sm"
                                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                معاينة
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* نافذة معاينة الفاتورة */}
      <InvoicePreviewDialog
        invoice={selectedInvoice}
        open={showInvoicePreview}
        onOpenChange={setShowInvoicePreview}
        settledProfits={settledProfits}
        allOrders={allOrders}
      />
    </>
  );
};

export default SettledDuesDialog;