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
import { CheckCircle, FileText, Calendar, User, DollarSign, Receipt, Eye } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

// مكون معاينة الفاتورة المحدث - بحجم مناسب
const InvoicePreviewDialog = ({ invoice, open, onOpenChange, settledProfits, allOrders }) => {
  if (!invoice) return null;

  console.log('🔍 فحص بيانات الفاتورة:', {
    invoice_number: invoice.invoice_number,
    employee_id: invoice.employee_id,
    order_ids: invoice.order_ids,
    profit_ids: invoice.profit_ids,
    settled_orders: invoice.settled_orders
  });

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

  console.log('📋 الطلبات المسواة النهائية:', settledOrders);

  // حساب الإحصائيات
  const stats = relatedProfits.reduce((acc, profit) => ({
    totalRevenue: acc.totalRevenue + (profit.total_revenue || 0),
    totalCost: acc.totalCost + (profit.total_cost || 0),
    totalProfit: acc.totalProfit + (profit.employee_profit || 0),
    ordersCount: acc.ordersCount + 1
  }), { totalRevenue: 0, totalCost: 0, totalProfit: 0, ordersCount: 0 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
        <ScrollArea className="h-full max-h-[75vh]">
          <div className="p-4">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg p-4 mb-4">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Receipt className="w-8 h-8" />
                  <h1 className="text-2xl font-bold">🧾 فاتورة تسوية</h1>
                </div>
                <p className="text-lg">مستحقات الموظف</p>
              </div>
              
              <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border">
                <div className="flex items-center justify-center gap-2">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">تاريخ التسوية</p>
                    <p className="font-bold">
                      {invoice.settlement_date ? 
                        format(parseISO(invoice.settlement_date), 'dd MMMM yyyy - HH:mm', { locale: ar }) :
                        'غير محدد'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* معلومات الفاتورة */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              {/* معلومات الموظف والفاتورة */}
              <Card className="lg:col-span-2">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-500 rounded-lg">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-bold text-lg">معلومات الموظف والفاتورة</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="bg-muted rounded-lg p-3">
                        <p className="text-sm text-muted-foreground">اسم الموظف</p>
                        <p className="font-bold text-lg">{invoice.employee_name}</p>
                      </div>
                      <div className="bg-muted rounded-lg p-3">
                        <p className="text-sm text-muted-foreground">معرف الموظف</p>
                        <p className="font-mono font-bold">{invoice.employee_code || 'EMP002'}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-muted rounded-lg p-3">
                        <p className="text-sm text-muted-foreground">رقم الفاتورة</p>
                        <p className="font-mono font-bold">{invoice.invoice_number}</p>
                      </div>
                      <div className="bg-muted rounded-lg p-3">
                        <p className="text-sm text-muted-foreground">طريقة الدفع</p>
                        <p className="font-bold">{invoice.payment_method === 'cash' ? '💰 نقدي' : invoice.payment_method}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* المبلغ المدفوع */}
              <Card className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <DollarSign className="w-6 h-6" />
                    <h3 className="font-bold text-lg">💵 المبلغ المدفوع</h3>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4">
                    <p className="text-3xl font-bold mb-1">
                      {invoice.total_amount?.toLocaleString()}
                    </p>
                    <p className="text-sm opacity-90">دينار عراقي</p>
                    <div className="mt-2 flex items-center justify-center gap-1 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      <span>تم الدفع بنجاح ✓</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* إحصائيات الأرباح */}
            {stats.ordersCount > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <Card className="bg-blue-500 text-white">
                  <CardContent className="p-3 text-center">
                    <p className="text-sm opacity-90">عدد الطلبات</p>
                    <p className="text-2xl font-bold">{stats.ordersCount}</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-500 text-white">
                  <CardContent className="p-3 text-center">
                    <p className="text-sm opacity-90">الإيرادات</p>
                    <p className="text-xl font-bold">{stats.totalRevenue.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="bg-orange-500 text-white">
                  <CardContent className="p-3 text-center">
                    <p className="text-sm opacity-90">التكاليف</p>
                    <p className="text-xl font-bold">{stats.totalCost.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="bg-purple-500 text-white">
                  <CardContent className="p-3 text-center">
                    <p className="text-sm opacity-90">ربح الموظف</p>
                    <p className="text-xl font-bold">{stats.totalProfit.toLocaleString()}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* الطلبات المسواة */}
            {settledOrders.length > 0 && (
              <Card className="mb-6">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-purple-500 rounded-lg">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-bold text-lg">🗂️ تفاصيل الطلبات المسواة</h3>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-center">رقم الطلب</TableHead>
                          <TableHead className="text-center">العميل</TableHead>
                          <TableHead className="text-center">المبلغ</TableHead>
                          <TableHead className="text-center">التاريخ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {settledOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="font-mono">
                                {order.order_number}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {order.customer_name || 'غير محدد'}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-bold text-emerald-600">
                                {(order.total_amount || order.final_amount || 0).toLocaleString()}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              {order.created_at ? 
                                format(new Date(order.created_at), 'dd/MM/yyyy', { locale: ar }) : 
                                'غير محدد'
                              }
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* شارة التسوية المكتملة */}
            <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-3 text-green-700 dark:text-green-400">
                  <CheckCircle className="w-8 h-8" />
                  <div>
                    <h4 className="font-bold text-lg">✅ التسوية مكتملة</h4>
                    <p className="text-sm">تم دفع جميع المستحقات وإتمام التسوية بنجاح</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
        
        <DialogFooter className="pt-4">
          <Button onClick={onOpenChange} variant="outline">
            إغلاق الفاتورة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// المكون الرئيسي
export const SettledDuesDialog = ({ open, onOpenChange, settledDues = [], allUsers = [] }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [settledProfits, setSettledProfits] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  console.log('🔍 SettledDuesDialog Props:', {
    settledDuesCount: settledDues?.length || 0,
    allUsersCount: allUsers?.length || 0,
    settledDues: settledDues?.slice(0, 3)
  });

  // جلب البيانات المطلوبة للفاتورة
  const fetchInvoiceData = async () => {
    setIsLoading(true);
    try {
      console.log('🔄 بدء جلب بيانات الفاتورة...');

      // جلب الأرباح المسواة
      const { data: profitsData, error: profitsError } = await supabase
        .from('profits')
        .select(`
          id,
          order_id,
          employee_id,
          employee_profit,
          profit_amount,
          total_revenue,
          total_cost,
          status,
          settled_at,
          created_at
        `)
        .eq('status', 'settled');

      if (profitsError) {
        console.error('❌ خطأ في جلب الأرباح المسواة:', profitsError);
      } else {
        console.log('✅ تم جلب الأرباح المسواة:', profitsData?.length || 0);
        setSettledProfits(profitsData || []);
      }

      // جلب الطلبات
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          customer_name,
          total_amount,
          final_amount,
          created_by,
          created_at,
          status
        `)
        .in('status', ['delivered', 'completed']);

      if (ordersError) {
        console.error('❌ خطأ في جلب الطلبات:', ordersError);
      } else {
        console.log('✅ تم جلب الطلبات:', ordersData?.length || 0);
        setAllOrders(ordersData || []);
      }

    } catch (error) {
      console.error('❌ خطأ عام في جلب البيانات:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // جلب البيانات عند فتح النافذة
  useEffect(() => {
    if (open) {
      fetchInvoiceData();
    }
  }, [open]);

  // تصفية البيانات
  const filteredDues = useMemo(() => {
    if (!settledDues || !Array.isArray(settledDues)) {
      console.log('❌ لا توجد مستحقات مسواة');
      return [];
    }

    return settledDues.filter(due => {
      // فلترة حسب الموظف
      const matchesUser = selectedUser === 'all' || due.employee_id === selectedUser;
      
      // فلترة حسب الفترة
      let matchesPeriod = true;
      if (selectedPeriod !== 'all' && due.settlement_date) {
        const dueDate = new Date(due.settlement_date);
        const now = new Date();
        
        switch (selectedPeriod) {
          case 'today':
            matchesPeriod = dueDate.toDateString() === now.toDateString();
            break;
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            matchesPeriod = dueDate >= weekAgo;
            break;
          case 'month':
            matchesPeriod = dueDate.getMonth() === now.getMonth() && dueDate.getFullYear() === now.getFullYear();
            break;
          case 'year':
            matchesPeriod = dueDate.getFullYear() === now.getFullYear();
            break;
        }
      }
      
      return matchesUser && matchesPeriod;
    });
  }, [settledDues, selectedUser, selectedPeriod]);

  // حساب الإحصائيات
  const totalPaidAmount = filteredDues.reduce((sum, due) => sum + (due.total_amount || 0), 0);
  const uniqueEmployeesCount = new Set(filteredDues.map(due => due.employee_id)).size;

  // معالج عرض الفاتورة
  const handleViewInvoice = (invoice) => {
    console.log('🔍 عرض الفاتورة:', invoice);
    setSelectedInvoice(invoice);
    setShowInvoicePreview(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
        <DialogHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500 rounded-lg">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                💳 المستحقات المدفوعة
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                عرض وإدارة جميع المستحقات المسواة والفواتير
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[65vh]">
          <div className="space-y-4 p-4">
            {/* كارت إجمالي المستحقات المدفوعة */}
            <Card className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-lg">💰 إجمالي المدفوعات</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
                  <div className="bg-white/10 rounded-lg p-3">
                    <p className="text-2xl font-bold">
                      {totalPaidAmount.toLocaleString()}
                    </p>
                    <p className="text-sm opacity-90">دينار عراقي</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <p className="text-2xl font-bold">{filteredDues.length}</p>
                    <p className="text-sm opacity-90">عدد الفواتير</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <p className="text-2xl font-bold">{uniqueEmployeesCount}</p>
                    <p className="text-sm opacity-90">عدد الموظفين</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* فلاتر */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">فترة التسوية</label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الفترة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الفترات</SelectItem>
                    <SelectItem value="today">اليوم</SelectItem>
                    <SelectItem value="week">هذا الأسبوع</SelectItem>
                    <SelectItem value="month">هذا الشهر</SelectItem>
                    <SelectItem value="year">هذا العام</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">الموظف</label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الموظف" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الموظفين</SelectItem>
                    {allUsers.map(user => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* جدول المستحقات المدفوعة */}
            {filteredDues.length > 0 ? (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    قائمة المستحقات المدفوعة
                  </h3>
                  
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-center">رقم الفاتورة</TableHead>
                          <TableHead className="text-center">الموظف</TableHead>
                          <TableHead className="text-center">المبلغ</TableHead>
                          <TableHead className="text-center">التاريخ</TableHead>
                          <TableHead className="text-center">الإجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDues.map((due) => {
                          const user = allUsers.find(u => u.user_id === due.employee_id);
                          
                          return (
                            <TableRow key={due.id}>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="font-mono">
                                  {due.invoice_number}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center font-medium">
                                {user?.full_name || 'غير معروف'}
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="font-bold text-emerald-600">
                                  {due.total_amount?.toLocaleString()} د.ع
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                {due.settlement_date ? 
                                  format(new Date(due.settlement_date), 'dd/MM/yyyy', { locale: ar }) : 
                                  'غير محدد'
                                }
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  onClick={() => handleViewInvoice(due)}
                                  size="sm"
                                  variant="outline"
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  عرض
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <FileText className="w-12 h-12 text-muted-foreground" />
                    <div>
                      <h3 className="font-bold text-lg mb-1">لا توجد مستحقات مدفوعة</h3>
                      <p className="text-muted-foreground">لم يتم العثور على أي مستحقات مدفوعة في الفترة المحددة</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4">
          <Button onClick={onOpenChange} variant="outline">
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* نافذة معاينة الفاتورة */}
      <InvoicePreviewDialog
        invoice={selectedInvoice}
        open={showInvoicePreview}
        onOpenChange={setShowInvoicePreview}
        settledProfits={settledProfits}
        allOrders={allOrders}
      />
    </Dialog>
  );
};