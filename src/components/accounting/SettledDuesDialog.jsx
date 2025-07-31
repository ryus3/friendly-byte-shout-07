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

  console.log('🔍 فحص بيانات الفاتورة:', {
    invoice_number: invoice.invoice_number,
    employee_id: invoice.employee_id,
    order_ids: invoice.order_ids,
    profit_ids: invoice.profit_ids,
    settled_orders: invoice.settled_orders
  });

  console.log('🔍 الأرباح المسواة المرسلة:', settledProfits?.length || 0);
  console.log('🔍 الطلبات المرسلة:', allOrders?.length || 0);

  // البحث عن الأرباح والطلبات المرتبطة بهذا الموظف
  const relatedProfits = settledProfits?.filter(profit => 
    profit.employee_id === invoice.employee_id
  ) || [];

  console.log('🔍 الأرباح المرتبطة بالموظف:', relatedProfits);

  // البحث عن الطلبات المسواة
  let settledOrders = [];
  
  // أولاً: البحث عن الطلبات من order_ids إذا كانت موجودة
  if (invoice.order_ids && Array.isArray(invoice.order_ids) && invoice.order_ids.length > 0) {
    console.log('✅ استخدام order_ids من الفاتورة:', invoice.order_ids);
    settledOrders = allOrders?.filter(order => 
      invoice.order_ids.includes(order.id)
    ) || [];
  }
  // ثانياً: البحث في settled_orders إذا كانت موجودة  
  else if (invoice.settled_orders && Array.isArray(invoice.settled_orders) && invoice.settled_orders.length > 0) {
    console.log('✅ استخدام settled_orders من الفاتورة:', invoice.settled_orders);
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
    console.log('✅ استخدام الأرباح المسواة للبحث عن الطلبات');
    settledOrders = allOrders?.filter(order => 
      relatedProfits.some(profit => profit.order_id === order.id)
    ) || [];
  }
  // رابعاً: البحث عن طلبات الموظف مباشرة
  else {
    console.log('⚠️ البحث عن طلبات الموظف مباشرة');
    settledOrders = allOrders?.filter(order => 
      order.created_by === invoice.employee_id
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
                        (invoice.created_at ? 
                          format(parseISO(invoice.created_at), 'dd MMMM yyyy - HH:mm', { locale: ar }) :
                          format(new Date(), 'dd MMMM yyyy - HH:mm', { locale: ar })
                        )
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* معلومات الفاتورة */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* معلومات الموظف */}
              <Card className="lg:col-span-2 relative overflow-hidden">
                <CardContent className="p-6">
                  <div className="bg-gradient-to-br from-slate-600 to-slate-800 text-white rounded-xl p-6 relative overflow-hidden">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 bg-white/10 rounded-full backdrop-blur-sm">
                        <User className="w-8 h-8" />
                      </div>
                      <h3 className="font-bold text-2xl">معلومات الموظف والفاتورة</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                          <p className="text-sm opacity-90 font-medium mb-1">اسم الموظف</p>
                          <p className="font-bold text-xl">{invoice.employee_name}</p>
                        </div>
                        <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                          <p className="text-sm opacity-90 font-medium mb-1">معرف الموظف</p>
                          <p className="font-mono text-lg font-bold text-blue-300">{invoice.employee_code || 'غير محدد'}</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                          <p className="text-sm opacity-90 font-medium mb-1">رقم الفاتورة</p>
                          <p className="font-mono font-bold text-lg text-purple-300">{invoice.invoice_number}</p>
                        </div>
                        <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                          <p className="text-sm opacity-90 font-medium mb-1">طريقة الدفع</p>
                          <p className="font-semibold">{invoice.payment_method === 'cash' ? 'نقدي' : invoice.payment_method}</p>
                        </div>
                      </div>
                    </div>
                    {/* تأثيرات بصرية */}
                    <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/5 rounded-full"></div>
                    <div className="absolute -top-2 -left-2 w-16 h-16 bg-white/5 rounded-full"></div>
                  </div>
                </CardContent>
              </Card>

              {/* المبلغ المدفوع */}
              <Card className="relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                <CardContent className="p-6 text-center">
                  <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl p-6 relative overflow-hidden">
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <div className="p-3 bg-white/10 rounded-full backdrop-blur-sm">
                        <DollarSign className="w-10 h-10" />
                      </div>
                      <h3 className="text-xl font-bold">المبلغ المدفوع</h3>
                    </div>
                    <p className="text-5xl font-black mb-3 drop-shadow-lg">
                      {invoice.total_amount?.toLocaleString()}
                    </p>
                    <p className="text-lg font-bold opacity-90 mb-3">دينار عراقي</p>
                    <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        <span>تم الدفع بنجاح</span>
                      </div>
                    </div>
                    {/* تأثيرات بصرية */}
                    <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/5 rounded-full"></div>
                    <div className="absolute -top-4 -left-4 w-16 h-16 bg-white/5 rounded-full"></div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* إحصائيات الأرباح */}
            {stats.ordersCount > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <Card className="relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl">
                  <CardContent className="p-4 text-center">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-lg p-4 relative overflow-hidden">
                      <div className="flex justify-center mb-2">
                        <div className="p-2 bg-white/10 rounded-full backdrop-blur-sm">
                          <Award className="w-6 h-6" />
                        </div>
                      </div>
                      <p className="text-xs opacity-90 mb-1">عدد الطلبات</p>
                      <p className="text-2xl font-black">{stats.ordersCount}</p>
                      <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white/5 rounded-full"></div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl">
                  <CardContent className="p-4 text-center">
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-lg p-4 relative overflow-hidden">
                      <div className="flex justify-center mb-2">
                        <div className="p-2 bg-white/10 rounded-full backdrop-blur-sm">
                          <TrendingUp className="w-6 h-6" />
                        </div>
                      </div>
                      <p className="text-xs opacity-90 mb-1">إجمالي الإيرادات</p>
                      <p className="text-lg font-black">{stats.totalRevenue.toLocaleString()}</p>
                      <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white/5 rounded-full"></div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl">
                  <CardContent className="p-4 text-center">
                    <div className="bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-lg p-4 relative overflow-hidden">
                      <div className="flex justify-center mb-2">
                        <div className="p-2 bg-white/10 rounded-full backdrop-blur-sm">
                          <DollarSign className="w-6 h-6" />
                        </div>
                      </div>
                      <p className="text-xs opacity-90 mb-1">التكاليف</p>
                      <p className="text-lg font-black">{stats.totalCost.toLocaleString()}</p>
                      <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white/5 rounded-full"></div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl">
                  <CardContent className="p-4 text-center">
                    <div className="bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-lg p-4 relative overflow-hidden">
                      <div className="flex justify-center mb-2">
                        <div className="p-2 bg-white/10 rounded-full backdrop-blur-sm">
                          <Banknote className="w-6 h-6" />
                        </div>
                      </div>
                      <p className="text-xs opacity-90 mb-1">ربح الموظف</p>
                      <p className="text-lg font-black">{stats.totalProfit.toLocaleString()}</p>
                      <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white/5 rounded-full"></div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* الطلبات المسواة */}
            {settledOrders.length > 0 && (
              <Card className="mb-8 relative overflow-hidden shadow-2xl">
                <CardContent className="p-8">
                  <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-2xl p-8 relative overflow-hidden">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm">
                        <FileText className="w-10 h-10" />
                      </div>
                      <h3 className="font-black text-3xl">
                        تفاصيل الطلبات المسواة
                      </h3>
                    </div>
                    
                    <div className="bg-white/10 rounded-2xl p-1 backdrop-blur-sm">
                      <div className="bg-slate-900/80 rounded-xl overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-8 py-6">
                          <div className="grid grid-cols-5 gap-6 text-center font-bold text-lg">
                            <div className="text-blue-300 flex items-center justify-center gap-2">
                              <FileText className="w-5 h-5" />
                              رقم الطلب
                            </div>
                            <div className="text-green-300 flex items-center justify-center gap-2">
                              <TrendingUp className="w-5 h-5" />
                              الإيرادات
                            </div>
                            <div className="text-orange-300 flex items-center justify-center gap-2">
                              <DollarSign className="w-5 h-5" />
                              التكاليف
                            </div>
                            <div className="text-purple-300 flex items-center justify-center gap-2">
                              <Banknote className="w-5 h-5" />
                              ربح الموظف
                            </div>
                            <div className="text-cyan-300 flex items-center justify-center gap-2">
                              <Calendar className="w-5 h-5" />
                              تاريخ التسوية
                            </div>
                          </div>
                        </div>
                        
                        {/* Orders List */}
                        <div className="divide-y divide-slate-700">
                          {settledOrders.map((order, index) => {
                            const orderProfit = relatedProfits.find(p => p.order_id === order.id);
                            return (
                              <div 
                                key={order.id} 
                                className={`grid grid-cols-5 gap-6 py-6 px-8 text-center transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-900/20 hover:to-purple-900/20 ${
                                  index % 2 === 0 ? 'bg-slate-800/50' : 'bg-slate-900/30'
                                }`}
                              >
                                {/* رقم الطلب */}
                                <div className="flex items-center justify-center">
                                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white font-mono font-bold px-4 py-3 rounded-xl shadow-lg text-lg hover:scale-105 transition-transform relative overflow-hidden">
                                    {order.order_number || order.trackingnumber || 'N/A'}
                                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white/20 rounded-full"></div>
                                  </div>
                                </div>
                                
                                {/* الإيرادات */}
                                <div className="flex flex-col items-center justify-center">
                                  <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl p-3 shadow-lg">
                                    <div className="text-2xl font-black mb-1">
                                      {(orderProfit?.total_revenue || order.total_amount || order.total || 0).toLocaleString()}
                                    </div>
                                    <div className="text-xs opacity-90 font-semibold">د.ع</div>
                                  </div>
                                </div>
                                
                                {/* التكاليف الحقيقية */}
                                <div className="flex flex-col items-center justify-center">
                                  <div className="bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-xl p-3 shadow-lg">
                                    <div className="text-2xl font-black mb-1">
                                      {(orderProfit?.total_cost || 0).toLocaleString()}
                                    </div>
                                    <div className="text-xs opacity-90 font-semibold">د.ع</div>
                                  </div>
                                </div>
                                
                                {/* ربح الموظف */}
                                <div className="flex flex-col items-center justify-center">
                                  <div className="bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-xl p-3 shadow-lg">
                                    <div className="text-2xl font-black mb-1">
                                      {(orderProfit?.employee_profit || 0).toLocaleString()}
                                    </div>
                                    <div className="text-xs opacity-90 font-semibold">د.ع</div>
                                  </div>
                                </div>
                                
                                {/* تاريخ التسوية الحقيقي */}
                                <div className="flex flex-col items-center justify-center">
                                  <div className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-xl p-3 shadow-lg">
                                    <div className="text-lg font-bold mb-1">
                                      {invoice.settlement_date ? 
                                        format(parseISO(invoice.settlement_date), 'dd/MM/yyyy', { locale: ar }) :
                                        (orderProfit?.settled_at ? 
                                          format(parseISO(orderProfit.settled_at), 'dd/MM/yyyy', { locale: ar }) :
                                          'غير محدد'
                                        )
                                      }
                                    </div>
                                    <div className="text-xs opacity-90 font-semibold">
                                      {invoice.settlement_date ? 
                                        format(parseISO(invoice.settlement_date), 'HH:mm', { locale: ar }) :
                                        (orderProfit?.settled_at ? 
                                          format(parseISO(orderProfit.settled_at), 'HH:mm', { locale: ar }) :
                                          '00:00'
                                        )
                                      }
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    
                    {/* تأثيرات بصرية */}
                    <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/5 rounded-full"></div>
                    <div className="absolute -top-4 -left-4 w-20 h-20 bg-white/5 rounded-full"></div>
                  </div>
                </CardContent>
              </Card>
            )}


            {/* حالة التسوية */}
            <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                  <h3 className="text-2xl font-bold text-green-700 dark:text-green-400">تسوية مكتملة</h3>
                </div>
                <p className="text-green-600 dark:text-green-400 text-lg">تم إتمام الدفع وتسجيل جميع البيانات بنجاح</p>
                <div className="mt-3 text-sm text-green-600 dark:text-green-400 opacity-80">
                  ✓ تم خصم المبلغ من القاصة الرئيسية
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
const SettledDuesDialog = ({ open, onOpenChange, invoices, allUsers, profits = [], orders = [] }) => {
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [dateRange, setDateRange] = useState(null);
  const [settledProfits, setSettledProfits] = useState([]);
  const [timePeriod, setTimePeriod] = useState('month'); // فلتر الفترة الزمنية - افتراضي شهر

  // جلب فواتير التسوية الحقيقية
  const [realSettlementInvoices, setRealSettlementInvoices] = useState([]);
  const [loadingRealInvoices, setLoadingRealInvoices] = useState(false);

  // جلب الأرباح المسواة والطلبات
  useEffect(() => {
    const fetchSettledProfits = async () => {
      try {
        console.log('🔄 جلب الأرباح المسواة...');
        const { data, error } = await supabase
          .from('profits')
          .select(`
            *,
            orders!inner(order_number, customer_name, total_amount, created_at)
          `)
          .eq('status', 'settled');

        if (error) {
          console.error('❌ خطأ في جلب الأرباح المسواة:', error);
        } else {
          console.log('✅ تم جلب الأرباح المسواة:', data?.length || 0);
          const profitsWithOrderData = data?.map(profit => ({
            ...profit,
            order_number: profit.orders?.order_number,
            customer_name: profit.orders?.customer_name,
            employee_name: allUsers?.find(user => user.user_id === profit.employee_id)?.full_name || 'غير محدد'
          })) || [];
          
          setSettledProfits(profitsWithOrderData);
          console.log('📊 الأرباح مع بيانات الطلبات:', profitsWithOrderData);
        }
      } catch (error) {
        console.error('❌ خطأ غير متوقع:', error);
      }
    };

    // جلب جميع الطلبات للموظف المحدد
    const fetchAllOrdersForEmployee = async () => {
      try {
        console.log('🔄 جلب جميع الطلبات للموظف المحدد...');
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('created_by', 'fba59dfc-451c-4906-8882-ae4601ff34d4'); // معرف موظف احمد

        if (error) {
          console.error('❌ خطأ في جلب الطلبات:', error);
        } else {
          console.log('✅ تم جلب طلبات الموظف:', data?.length || 0, data);
        }
      } catch (error) {
        console.error('❌ خطأ غير متوقع في جلب الطلبات:', error);
      }
    };

    if (open) {
      fetchSettledProfits();
      fetchAllOrdersForEmployee();
    }
  }, [open, allUsers]);

  // جلب فواتير التسوية الحقيقية مع فلتر الفترة الزمنية
  useEffect(() => {
    const fetchRealSettlementInvoices = async () => {
      setLoadingRealInvoices(true);
      try {
        let query = supabase
          .from('settlement_invoices')
          .select('*');

        // تطبيق فلتر الفترة الزمنية
        const now = new Date();
        let startDate;
        
        switch (timePeriod) {
          case 'day':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            weekStart.setHours(0, 0, 0, 0);
            startDate = weekStart;
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
          default:
            startDate = null;
        }

        if (startDate) {
          query = query.gte('settlement_date', startDate.toISOString());
        }

        // تطبيق فلتر النطاق الزمني المخصص إذا كان موجوداً
        if (dateRange?.from) {
          query = query.gte('settlement_date', dateRange.from.toISOString());
        }
        if (dateRange?.to) {
          const endOfDay = new Date(dateRange.to);
          endOfDay.setHours(23, 59, 59, 999);
          query = query.lte('settlement_date', endOfDay.toISOString());
        }

        const { data, error } = await query.order('settlement_date', { ascending: false });

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
  }, [open, timePeriod, dateRange]);

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
        employee_code: invoice.employee_code, // المعرف الصغير
        total_amount: invoice.total_amount,
        settlement_date: invoice.settlement_date,
        created_at: invoice.created_at,
        description: invoice.description,
        status: invoice.status || 'completed',
        type: 'real_settlement',
        payment_method: invoice.payment_method,
        notes: invoice.notes,
        settled_orders: invoice.settled_orders || [] // الطلبات المسواة
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
          <DialogHeader className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-r from-emerald-500 to-green-600 rounded-full text-white shadow-lg">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <DialogTitle className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                  المستحقات المدفوعة
                </DialogTitle>
                <DialogDescription className="text-lg text-slate-600 dark:text-slate-400 mt-2">
                  عرض جميع فواتير التسوية المكتملة للموظفين
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6">
            <div className="space-y-6">
              {/* الفلاتر */}
              <Card className="relative overflow-hidden shadow-lg border-0">
                <CardContent className="p-6">
                  <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl p-6 text-white">
                    <div className="flex items-center gap-3 mb-6">
                      <Calendar className="w-6 h-6" />
                      <h3 className="text-xl font-bold">الفلاتر والبحث</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium opacity-90">اختر التاريخ</label>
                        <DateRangePicker
                          date={dateRange}
                          onDateChange={setDateRange}
                          className="w-full bg-white/10 border-white/20 text-white"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium opacity-90">جميع الموظفين</label>
                        <Select value={selectedEmployeeFilter} onValueChange={setSelectedEmployeeFilter}>
                          <SelectTrigger className="bg-white/10 border-white/20 text-white">
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
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* إحصائيات ملونة مثل التصميم المطلوب */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* عدد الموظفين - بنفسجي */}
                <Card className="relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl border-0">
                  <CardContent className="p-0">
                    <div className="bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-2xl p-8 relative overflow-hidden">
                      <div className="flex justify-center mb-4">
                        <div className="p-4 bg-white/10 rounded-full backdrop-blur-sm">
                          <User className="w-12 h-12" />
                        </div>
                      </div>
                      <p className="text-lg font-bold opacity-90 mb-2 text-center">عدد الموظفين</p>
                      <p className="text-6xl font-black mb-4 drop-shadow-lg text-center">
                        {employees.length}
                      </p>
                      {/* تأثيرات بصرية */}
                      <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/10 rounded-full"></div>
                      <div className="absolute -top-2 -left-2 w-16 h-16 bg-white/10 rounded-full"></div>
                    </div>
                  </CardContent>
                </Card>

                {/* إجمالي المبلغ - أخضر */}
                <Card className="relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl border-0">
                  <CardContent className="p-0">
                    <div className="bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-2xl p-8 relative overflow-hidden">
                      <div className="flex justify-center mb-4">
                        <div className="p-4 bg-white/10 rounded-full backdrop-blur-sm">
                          <DollarSign className="w-12 h-12" />
                        </div>
                      </div>
                      <p className="text-lg font-bold opacity-90 mb-2 text-center">إجمالي المبلغ</p>
                      <p className="text-6xl font-black mb-4 drop-shadow-lg text-center">
                        {totalAmount.toLocaleString()}
                      </p>
                      <p className="text-sm font-medium text-center opacity-90">دينار عراقي</p>
                      {/* تأثيرات بصرية */}
                      <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/10 rounded-full"></div>
                      <div className="absolute -top-2 -left-2 w-16 h-16 bg-white/10 rounded-full"></div>
                    </div>
                  </CardContent>
                </Card>

                {/* عدد الفواتير - أزرق */}
                <Card className="relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl border-0">
                  <CardContent className="p-0">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-2xl p-8 relative overflow-hidden">
                      <div className="flex justify-center mb-4">
                        <div className="p-4 bg-white/10 rounded-full backdrop-blur-sm">
                          <FileText className="w-12 h-12" />
                        </div>
                      </div>
                      <p className="text-lg font-bold opacity-90 mb-2 text-center">عدد الفواتير</p>
                      <p className="text-6xl font-black mb-4 drop-shadow-lg text-center">
                        {filteredInvoices.length}
                      </p>
                      {/* تأثيرات بصرية */}
                      <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/10 rounded-full"></div>
                      <div className="absolute -top-2 -left-2 w-16 h-16 bg-white/10 rounded-full"></div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* جدول الفواتير بتصميم كروت ملونة */}
              <Card className="mt-6 relative overflow-hidden shadow-lg border-0">
                <CardContent className="p-6">
                  <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-8 py-6">
                      <div className="grid grid-cols-6 gap-6 text-center font-bold text-lg">
                        <div className="text-blue-300 flex items-center justify-center gap-2">
                          <FileText className="w-5 h-5" />
                          رقم الفاتورة
                        </div>
                        <div className="text-green-300 flex items-center justify-center gap-2">
                          <User className="w-5 h-5" />
                          اسم الموظف
                        </div>
                        <div className="text-emerald-300 flex items-center justify-center gap-2">
                          <DollarSign className="w-5 h-5" />
                          المبلغ
                        </div>
                        <div className="text-cyan-300 flex items-center justify-center gap-2">
                          <Calendar className="w-5 h-5" />
                          تاريخ التسوية
                        </div>
                        <div className="text-purple-300 flex items-center justify-center gap-2">
                          <CheckCircle className="w-5 h-5" />
                          الحالة
                        </div>
                        <div className="text-orange-300 flex items-center justify-center gap-2">
                          <Eye className="w-5 h-5" />
                          الإجراءات
                        </div>
                      </div>
                    </div>
                    
                    {/* Content */}
                    <ScrollArea className="h-[400px]">
                      <div className="divide-y divide-slate-700">
                        {loadingRealInvoices ? (
                          <div className="text-center py-8 text-white">
                            جاري تحميل البيانات...
                          </div>
                        ) : filteredInvoices.length === 0 ? (
                          <div className="text-center py-8 text-slate-300">
                            لا توجد فواتير تسوية
                          </div>
                        ) : (
                          filteredInvoices.map((invoice, index) => (
                            <div 
                              key={invoice.id} 
                              className={`grid grid-cols-6 gap-6 py-6 px-8 text-center transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-900/20 hover:to-purple-900/20 ${
                                index % 2 === 0 ? 'bg-slate-800/50' : 'bg-slate-900/30'
                              }`}
                            >
                              {/* رقم الفاتورة */}
                              <div className="flex items-center justify-center">
                                <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white font-mono font-bold px-4 py-3 rounded-xl shadow-lg hover:scale-105 transition-transform relative overflow-hidden">
                                  {invoice.invoice_number}
                                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white/20 rounded-full"></div>
                                </div>
                              </div>
                              
                              {/* اسم الموظف */}
                              <div className="flex items-center justify-center">
                                <div className="bg-gradient-to-r from-green-500 to-green-600 text-white font-bold px-4 py-3 rounded-xl shadow-lg hover:scale-105 transition-transform relative overflow-hidden">
                                  {invoice.employee_name}
                                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white/20 rounded-full"></div>
                                </div>
                              </div>
                              
                              {/* المبلغ */}
                              <div className="flex flex-col items-center justify-center">
                                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-xl p-3 shadow-lg">
                                  <div className="text-2xl font-black mb-1">
                                    {invoice.total_amount?.toLocaleString()}
                                  </div>
                                  <div className="text-xs opacity-90 font-semibold">د.ع</div>
                                </div>
                              </div>
                              
                              {/* تاريخ التسوية */}
                              <div className="flex flex-col items-center justify-center">
                                <div className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-xl p-3 shadow-lg">
                                  <div className="text-lg font-bold mb-1">
                                    {invoice.settlement_date ? 
                                      format(parseISO(invoice.settlement_date), 'dd/MM/yyyy', { locale: ar }) :
                                      format(new Date(), 'dd/MM/yyyy', { locale: ar })
                                    }
                                  </div>
                                  <div className="text-xs opacity-90 font-semibold">
                                    {invoice.settlement_date ? 
                                      format(parseISO(invoice.settlement_date), 'HH:mm', { locale: ar }) :
                                      format(new Date(), 'HH:mm', { locale: ar })
                                    }
                                  </div>
                                </div>
                              </div>
                              
                              {/* الحالة */}
                              <div className="flex items-center justify-center">
                                <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold px-4 py-3 rounded-xl shadow-lg hover:scale-105 transition-transform relative overflow-hidden">
                                  مكتملة
                                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white/20 rounded-full"></div>
                                </div>
                              </div>
                              
                              {/* الإجراءات */}
                              <div className="flex items-center justify-center">
                                <Button
                                  onClick={() => handlePreviewInvoice(invoice)}
                                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold px-4 py-3 rounded-xl shadow-lg hover:scale-105 transition-all duration-300 gap-2"
                                >
                                  <Eye className="w-4 h-4" />
                                  معاينة الفاتورة
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </div>
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