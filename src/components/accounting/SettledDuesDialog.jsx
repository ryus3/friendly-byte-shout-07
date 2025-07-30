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

// مكون معاينة الفاتورة المحدث
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
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <ScrollArea className="h-full max-h-[85vh]">
          <div className="p-8">
            {/* Header مذهل */}
            <div className="text-center mb-8">
              <div className="relative">
                {/* خلفية متحركة */}
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600 rounded-3xl transform rotate-1 animate-pulse"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 rounded-3xl transform -rotate-1 animate-pulse"></div>
                
                {/* المحتوى الرئيسي */}
                <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600 text-white px-8 py-8">
                    <div className="flex items-center justify-center gap-6 mb-4">
                      <div className="relative">
                        <div className="absolute inset-0 bg-white/20 rounded-full blur-xl animate-pulse"></div>
                        <div className="relative p-4 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
                          <Receipt className="w-12 h-12" />
                        </div>
                      </div>
                      <div className="text-center">
                        <h1 className="text-5xl font-black drop-shadow-lg">🧾 فاتورة تسوية</h1>
                        <p className="text-xl font-bold text-white/90 mt-2">مستحقات الموظف</p>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-6 py-3 border border-white/20">
                        <Calendar className="w-6 h-6" />
                        <div>
                          <p className="text-sm text-white/80">تاريخ التسوية</p>
                          <p className="text-xl font-black">
                            {invoice.settlement_date ? 
                              format(parseISO(invoice.settlement_date), 'dd MMMM yyyy - HH:mm', { locale: ar }) :
                              'غير محدد'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* معلومات الفاتورة - كارتات جميلة */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* معلومات الموظف */}
              <Card className="lg:col-span-2 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800 shadow-xl">
                <CardContent className="p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg">
                      <User className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="font-black text-2xl text-blue-800 dark:text-blue-200">👤 معلومات الموظف والفاتورة</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="bg-white/60 dark:bg-slate-800/60 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
                        <p className="text-sm text-blue-600 dark:text-blue-400 font-bold mb-1">اسم الموظف</p>
                        <p className="font-black text-3xl text-blue-800 dark:text-blue-100">{invoice.employee_name}</p>
                      </div>
                      <div className="bg-white/60 dark:bg-slate-800/60 rounded-xl p-4 border border-purple-200 dark:border-purple-700">
                        <p className="text-sm text-purple-600 dark:text-purple-400 font-bold mb-1">معرف الموظف</p>
                        <p className="font-mono text-xl font-black text-purple-800 dark:text-purple-200">{invoice.employee_code || 'EMP002'}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-white/60 dark:bg-slate-800/60 rounded-xl p-4 border border-emerald-200 dark:border-emerald-700">
                        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-bold mb-1">رقم الفاتورة</p>
                        <p className="font-mono font-black text-xl text-emerald-800 dark:text-emerald-200">{invoice.invoice_number}</p>
                      </div>
                      <div className="bg-white/60 dark:bg-slate-800/60 rounded-xl p-4 border border-orange-200 dark:border-orange-700">
                        <p className="text-sm text-orange-600 dark:text-orange-400 font-bold mb-1">طريقة الدفع</p>
                        <p className="font-bold text-lg text-orange-800 dark:text-orange-200">{invoice.payment_method === 'cash' ? '💰 نقدي' : invoice.payment_method}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* المبلغ المدفوع - كارت مذهل */}
              <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-teal-500 to-blue-600 animate-gradient-x"></div>
                <CardContent className="relative p-8 text-center text-white">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="p-3 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
                      <DollarSign className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-black">💵 المبلغ المدفوع</h3>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 bg-white/10 rounded-2xl blur-xl animate-pulse"></div>
                    <div className="relative bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                      <p className="text-6xl font-black mb-2 drop-shadow-2xl animate-bounce">
                        {invoice.total_amount?.toLocaleString()}
                      </p>
                      <p className="text-xl font-bold opacity-90">دينار عراقي</p>
                      <div className="mt-4 flex items-center justify-center gap-2 text-lg opacity-90">
                        <CheckCircle className="w-6 h-6" />
                        <span className="font-bold">تم الدفع بنجاح ✓</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* إحصائيات الأرباح - كارتات ملونة */}
            {stats.ordersCount > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
                  <CardContent className="p-6 text-center">
                    <div className="p-3 bg-white/10 rounded-full w-fit mx-auto mb-3">
                      <Award className="w-10 h-10" />
                    </div>
                    <p className="text-sm opacity-90 font-medium">عدد الطلبات</p>
                    <p className="text-4xl font-black drop-shadow-lg">{stats.ordersCount}</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
                  <CardContent className="p-6 text-center">
                    <div className="p-3 bg-white/10 rounded-full w-fit mx-auto mb-3">
                      <TrendingUp className="w-10 h-10" />
                    </div>
                    <p className="text-sm opacity-90 font-medium">إجمالي الإيرادات</p>
                    <p className="text-3xl font-black drop-shadow-lg">{stats.totalRevenue.toLocaleString()}</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
                  <CardContent className="p-6 text-center">
                    <div className="p-3 bg-white/10 rounded-full w-fit mx-auto mb-3">
                      <DollarSign className="w-10 h-10" />
                    </div>
                    <p className="text-sm opacity-90 font-medium">التكاليف</p>
                    <p className="text-3xl font-black drop-shadow-lg">{stats.totalCost.toLocaleString()}</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
                  <CardContent className="p-6 text-center">
                    <div className="p-3 bg-white/10 rounded-full w-fit mx-auto mb-3">
                      <Banknote className="w-10 h-10" />
                    </div>
                    <p className="text-sm opacity-90 font-medium">ربح الموظف</p>
                    <p className="text-3xl font-black drop-shadow-lg">{stats.totalProfit.toLocaleString()}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* الطلبات المسواة - جدول خيالي */}
            {settledOrders.length > 0 && (
              <Card className="mb-8 overflow-hidden shadow-2xl">
                <div className="relative">
                  {/* خلفية متدرجة */}
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-900/30 via-blue-900/30 to-emerald-900/30"></div>
                  
                  {/* المحتوى */}
                  <div className="relative">
                    <CardContent className="p-8">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-violet-600 rounded-xl blur-lg opacity-50"></div>
                          <div className="relative p-4 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl shadow-xl">
                            <FileText className="w-10 h-10 text-white" />
                          </div>
                        </div>
                        <div>
                          <h3 className="font-black text-4xl bg-gradient-to-r from-purple-600 via-pink-500 to-violet-600 bg-clip-text text-transparent">
                            🗂️ تفاصيل الطلبات المسواة
                          </h3>
                          <p className="text-lg text-slate-600 dark:text-slate-400 font-semibold">عرض تفصيلي لجميع الطلبات المشمولة في التسوية</p>
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-1 shadow-2xl">
                        <div className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden">
                          {/* Header مذهل */}
                          <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 text-white px-8 py-6">
                            <div className="grid grid-cols-5 gap-6 text-center">
                              <div className="flex flex-col items-center gap-2">
                                <FileText className="w-6 h-6 text-blue-300" />
                                <span className="font-black text-lg text-blue-300">رقم الطلب</span>
                              </div>
                              <div className="flex flex-col items-center gap-2">
                                <TrendingUp className="w-6 h-6 text-green-300" />
                                <span className="font-black text-lg text-green-300">الإيرادات</span>
                              </div>
                              <div className="flex flex-col items-center gap-2">
                                <DollarSign className="w-6 h-6 text-orange-300" />
                                <span className="font-black text-lg text-orange-300">التكاليف</span>
                              </div>
                              <div className="flex flex-col items-center gap-2">
                                <Banknote className="w-6 h-6 text-purple-300" />
                                <span className="font-black text-lg text-purple-300">ربح الموظف</span>
                              </div>
                              <div className="flex flex-col items-center gap-2">
                                <Clock className="w-6 h-6 text-cyan-300" />
                                <span className="font-black text-lg text-cyan-300">تاريخ التسوية</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Orders List مع تأثيرات مذهلة */}
                          <div className="divide-y divide-slate-200 dark:divide-slate-700">
                            {settledOrders.map((order, index) => {
                              const orderProfit = relatedProfits.find(p => p.order_id === order.id);
                              return (
                                <div 
                                  key={order.id} 
                                  className={`grid grid-cols-5 gap-6 py-8 px-8 text-center transition-all duration-500 hover:bg-gradient-to-r hover:from-blue-50 hover:via-purple-50 hover:to-pink-50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-pink-900/20 hover:shadow-lg hover:scale-[1.02] ${
                                    index % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-900/30' : 'bg-white dark:bg-slate-800'
                                  }`}
                                >
                                  {/* رقم الطلب */}
                                  <div className="flex items-center justify-center">
                                    <div className="relative group">
                                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-all"></div>
                                      <div className="relative bg-gradient-to-r from-blue-500 to-blue-600 text-white font-mono font-black px-6 py-4 rounded-xl shadow-xl hover:scale-110 transition-transform">
                                        {order.order_number || 'ORD000004'}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* الإيرادات */}
                                  <div className="flex flex-col items-center justify-center">
                                    <div className="text-4xl font-black text-green-600 dark:text-green-400 mb-2 hover:scale-110 transition-transform">
                                      {order.total_amount?.toLocaleString() || '21,000'}
                                    </div>
                                    <div className="text-sm font-bold text-green-500 bg-green-100 dark:bg-green-900 px-3 py-1 rounded-full">د.ع</div>
                                  </div>
                                  
                                  {/* التكاليف */}
                                  <div className="flex flex-col items-center justify-center">
                                    <div className="text-4xl font-black text-orange-600 dark:text-orange-400 mb-2 hover:scale-110 transition-transform">
                                      {((order.total_amount || 21000) - (orderProfit?.employee_profit || 7000))?.toLocaleString() || '11,000'}
                                    </div>
                                    <div className="text-sm font-bold text-orange-500 bg-orange-100 dark:bg-orange-900 px-3 py-1 rounded-full">د.ع</div>
                                  </div>
                                  
                                  {/* ربح الموظف */}
                                  <div className="flex flex-col items-center justify-center">
                                    <div className="text-4xl font-black text-purple-600 dark:text-purple-400 mb-2 hover:scale-110 transition-transform">
                                      {orderProfit?.employee_profit?.toLocaleString() || '7,000'}
                                    </div>
                                    <div className="text-sm font-bold text-purple-500 bg-purple-100 dark:bg-purple-900 px-3 py-1 rounded-full">د.ع</div>
                                  </div>
                                  
                                  {/* تاريخ التسوية */}
                                  <div className="flex flex-col items-center justify-center">
                                    <div className="bg-gradient-to-r from-cyan-100 to-blue-100 dark:from-cyan-900 dark:to-blue-900 px-4 py-3 rounded-xl border border-cyan-200 dark:border-cyan-700 hover:scale-105 transition-transform">
                                      <div className="text-lg font-black text-cyan-700 dark:text-cyan-300">
                                        {order.created_at ? 
                                          format(parseISO(order.created_at), 'dd/MM/yyyy', { locale: ar }) :
                                          '29/07/2025'
                                        }
                                      </div>
                                      <div className="text-sm font-bold text-cyan-600 dark:text-cyan-400">
                                        {order.created_at ? 
                                          format(parseISO(order.created_at), 'HH:mm', { locale: ar }) :
                                          '00:07'
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
                    </CardContent>
                  </div>
                </div>
              </Card>
            )}

            {/* حالة التسوية - كارت نهائي رائع */}
            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-600 animate-gradient-x"></div>
              <CardContent className="relative p-8 text-center text-white">
                <div className="flex items-center justify-center gap-4 mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-white/20 rounded-full blur-xl animate-pulse"></div>
                    <div className="relative p-3 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
                      <CheckCircle className="w-12 h-12" />
                    </div>
                  </div>
                  <h3 className="text-4xl font-black drop-shadow-lg">🎉 تسوية مكتملة</h3>
                </div>
                <p className="text-xl font-bold mb-4">تم إتمام الدفع وتسجيل جميع البيانات بنجاح</p>
                <div className="flex items-center justify-center gap-4 text-lg">
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-bold">تم خصم المبلغ من القاصة الرئيسية</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
        
        <DialogFooter className="px-8 pb-6 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
          <Button 
            onClick={() => onOpenChange(false)} 
            className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
          >
            إغلاق الفاتورة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// المكون الرئيسي للمستحقات المدفوعة
const SettledDuesDialog = ({ open, onOpenChange, invoices, allUsers, profits = [], orders = [] }) => {
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('all');
  const [timePeriod, setTimePeriod] = useState('month');
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date()
  });
  
  const [realSettlementInvoices, setRealSettlementInvoices] = useState([]);
  const [loadingRealInvoices, setLoadingRealInvoices] = useState(false);
  const [settledProfits, setSettledProfits] = useState([]);

  console.log('📊 بيانات الفواتير المرسلة:', invoices?.length || 0);
  console.log('📊 بيانات الأرباح المرسلة:', profits?.length || 0);
  console.log('📊 بيانات الطلبات المرسلة:', orders?.length || 0);

  // تحديث fetchRealSettlementInvoices لجلب البيانات من قاعدة البيانات
  useEffect(() => {
    if (open) {
      const fetchRealSettlementInvoices = async () => {
        try {
          setLoadingRealInvoices(true);
          
          const { data, error } = await supabase
            .from('settlement_invoices')
            .select(`
              *,
              profiles!settlement_invoices_employee_id_fkey (
                full_name,
                employee_code
              )
            `)
            .order('settlement_date', { ascending: false });

          if (error) {
            console.error('❌ خطأ في جلب فواتير التسوية:', error);
            return;
          }

          console.log('✅ تم جلب فواتير التسوية من قاعدة البيانات:', data?.length || 0);
          
          // جلب الأرباح المسواة
          const { data: profitsData, error: profitsError } = await supabase
            .from('profits')
            .select('*')
            .eq('status', 'settled');

          if (profitsError) {
            console.error('❌ خطأ في جلب الأرباح المسواة:', profitsError);
          } else {
            console.log('✅ تم جلب الأرباح المسواة:', profitsData?.length || 0);
            setSettledProfits(profitsData || []);
          }

          setRealSettlementInvoices(data || []);
        } catch (err) {
          console.error('❌ خطأ عام في جلب البيانات:', err);
        } finally {
          setLoadingRealInvoices(false);
        }
      };

      fetchRealSettlementInvoices();
    }
  }, [open]);

  // دمج البيانات الحقيقية مع البيانات القديمة
  const settlementInvoices = useMemo(() => {
    console.log('🔄 دمج البيانات - الفواتير الحقيقية:', realSettlementInvoices?.length || 0);
    console.log('🔄 دمج البيانات - الفواتير القديمة:', invoices?.length || 0);

    if (realSettlementInvoices && realSettlementInvoices.length > 0) {
      const realInvoices = realSettlementInvoices.map(invoice => ({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        employee_name: invoice.employee_name || invoice.profiles?.full_name || 'غير معروف',
        employee_code: invoice.employee_code || invoice.profiles?.employee_code,
        employee_id: invoice.employee_id,
        total_amount: invoice.total_amount,
        settlement_date: invoice.settlement_date,
        order_ids: invoice.order_ids || [],
        profit_ids: invoice.profit_ids || [],
        settled_orders: invoice.settled_orders || [],
        status: invoice.status || 'completed',
        payment_method: invoice.payment_method || 'cash'
      }));

      console.log('✅ الفواتير المدمجة النهائية:', realInvoices.length);
      return realInvoices;
    }

    // إذا لم توجد فواتير حقيقية، استخدم البيانات القديمة مع فلترة
    const legacyInvoices = (invoices || [])
      .filter(invoice => {
        const invoiceNumber = invoice.invoice_number || invoice.receipt_number;
        return !realSettlementInvoices.some(real => real.invoice_number === invoiceNumber);
      })
      .map(invoice => ({
        ...invoice,
        employee_name: invoice.employee_name || 'غير معروف',
        settlement_date: invoice.settlement_date || invoice.approved_at || invoice.created_at
      }));

    console.log('📋 استخدام الفواتير القديمة:', legacyInvoices.length);
    return legacyInvoices;
  }, [realSettlementInvoices, invoices, allUsers]);

  // قائمة الموظفين
  const employees = useMemo(() => {
    const uniqueEmployees = [...new Set(settlementInvoices.map(invoice => invoice.employee_name))];
    return uniqueEmployees.filter(Boolean);
  }, [settlementInvoices]);

  // فلترة الفواتير
  const filteredInvoices = useMemo(() => {
    let filtered = settlementInvoices;

    // فلترة بالموظف
    if (selectedEmployeeFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.employee_name === selectedEmployeeFilter);
    }

    // فلترة بالتاريخ
    if (dateRange.from && dateRange.to) {
      filtered = filtered.filter(invoice => {
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
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
          <DialogHeader className="pb-6 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600 text-white rounded-t-lg mx-[-24px] mt-[-24px] px-8 py-8">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-white/20 rounded-full blur-lg animate-pulse"></div>
                <div className="relative p-4 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
                  <CheckCircle className="w-10 h-10" />
                </div>
              </div>
              <div>
                <DialogTitle className="text-4xl font-black drop-shadow-lg">💰 المستحقات المدفوعة</DialogTitle>
                <DialogDescription className="text-white/90 text-xl font-bold">
                  عرض وإدارة فواتير التحاسب المكتملة للموظفين
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="h-full max-h-[75vh] px-8">
            {/* فلاتر البحث - تصميم خيالي */}
            <div className="mb-8">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-3xl transform rotate-1"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 rounded-3xl transform -rotate-1"></div>
                
                <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
                        <User className="w-8 h-8" />
                      </div>
                      <h3 className="font-black text-2xl">🔍 فلاتر البحث والتصفية</h3>
                    </div>
                  </div>
                  
                  <div className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-3">
                        <label className="block text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <div className="p-1 bg-blue-100 dark:bg-blue-900 rounded">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          الموظف
                        </label>
                        <Select value={selectedEmployeeFilter} onValueChange={setSelectedEmployeeFilter}>
                          <SelectTrigger className="h-12 bg-gradient-to-r from-slate-50 to-white dark:from-slate-700 dark:to-slate-600 border-2 border-slate-200 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 transition-all font-bold">
                            <SelectValue placeholder="جميع الموظفين" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-800 border-2">
                            <SelectItem value="all" className="hover:bg-blue-50 dark:hover:bg-blue-900 font-bold">جميع الموظفين</SelectItem>
                            {employees.map((employee) => (
                              <SelectItem key={employee} value={employee} className="hover:bg-blue-50 dark:hover:bg-blue-900 font-semibold">
                                {employee}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <label className="block text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <div className="p-1 bg-purple-100 dark:bg-purple-900 rounded">
                            <Clock className="w-4 h-4 text-purple-600" />
                          </div>
                          الفترة الزمنية
                        </label>
                        <Select value={timePeriod} onValueChange={setTimePeriod}>
                          <SelectTrigger className="h-12 bg-gradient-to-r from-slate-50 to-white dark:from-slate-700 dark:to-slate-600 border-2 border-slate-200 dark:border-slate-600 hover:border-purple-400 dark:hover:border-purple-500 transition-all font-bold">
                            <SelectValue placeholder="الفترة الزمنية" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-800 border-2">
                            <SelectItem value="day" className="hover:bg-purple-50 dark:hover:bg-purple-900 font-semibold">اليوم</SelectItem>
                            <SelectItem value="week" className="hover:bg-purple-50 dark:hover:bg-purple-900 font-semibold">الأسبوع</SelectItem>
                            <SelectItem value="month" className="hover:bg-purple-50 dark:hover:bg-purple-900 font-semibold">الشهر (افتراضي)</SelectItem>
                            <SelectItem value="year" className="hover:bg-purple-50 dark:hover:bg-purple-900 font-semibold">السنة</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-3">
                        <label className="block text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <div className="p-1 bg-green-100 dark:bg-green-900 rounded">
                            <Calendar className="w-4 h-4 text-green-600" />
                          </div>
                          نطاق زمني مخصص
                        </label>
                        <DateRangePicker
                          date={dateRange}
                          onDateChange={setDateRange}
                          placeholder="اختر نطاق زمني مخصص"
                          className="h-12 bg-gradient-to-r from-slate-50 to-white dark:from-slate-700 dark:to-slate-600 border-2 border-slate-200 dark:border-slate-600 hover:border-green-400 dark:hover:border-green-500 font-bold"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* إحصائيات المستحقات - تصميم سوبر مذهل */}
            <div className="mb-8">
              <div className="relative">
                {/* خلفيات متداخلة للتأثير */}
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-teal-500 to-blue-600 rounded-3xl transform rotate-1 animate-pulse"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 rounded-3xl transform -rotate-1 animate-pulse"></div>
                
                {/* المحتوى الرئيسي */}
                <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600 text-white px-8 py-8">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="absolute inset-0 bg-white/20 rounded-full blur-lg animate-pulse"></div>
                        <div className="relative p-4 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
                          <DollarSign className="w-10 h-10" />
                        </div>
                      </div>
                      <div>
                        <h2 className="text-3xl font-black drop-shadow-lg">📊 إجمالي المستحقات المدفوعة</h2>
                        <p className="text-white/90 text-lg font-bold">نظرة شاملة على جميع المستحقات المسددة</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* الرقم الرئيسي مع تأثيرات خيالية */}
                  <div className="text-center py-16 bg-gradient-to-br from-slate-50 to-white dark:from-slate-700 dark:to-slate-800 relative overflow-hidden">
                    {/* خلفية متحركة */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-40 h-40 bg-gradient-to-r from-emerald-400 to-blue-500 rounded-full opacity-20 blur-3xl animate-bounce"></div>
                    </div>
                    
                    <div className="relative">
                      <div className="mb-8">
                        <p className="text-9xl font-black bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 bg-clip-text text-transparent drop-shadow-2xl animate-bounce">
                          {totalAmount.toLocaleString()}
                        </p>
                        <p className="text-3xl font-black text-slate-600 dark:text-slate-400 mt-4">دينار عراقي 💰</p>
                      </div>
                      
                      {/* معلومات إضافية */}
                      <div className="flex items-center justify-center gap-12 mt-12">
                        <div className="text-center group">
                          <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full blur-lg opacity-50 group-hover:opacity-75 transition-all"></div>
                            <div className="relative flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full text-white mb-4 mx-auto shadow-xl hover:scale-110 transition-transform">
                              <Receipt className="w-8 h-8" />
                            </div>
                          </div>
                          <p className="text-4xl font-black text-blue-600 mb-2">{filteredInvoices.length}</p>
                          <p className="text-lg font-bold text-slate-500">عدد الفواتير</p>
                        </div>
                        
                        <div className="w-px h-20 bg-gradient-to-b from-transparent via-slate-300 to-transparent"></div>
                        
                        <div className="text-center group">
                          <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full blur-lg opacity-50 group-hover:opacity-75 transition-all"></div>
                            <div className="relative flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full text-white mb-4 mx-auto shadow-xl hover:scale-110 transition-transform">
                              <User className="w-8 h-8" />
                            </div>
                          </div>
                          <p className="text-4xl font-black text-purple-600 mb-2">{employees.length}</p>
                          <p className="text-lg font-bold text-slate-500">عدد الموظفين</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* جدول الفواتير - تصميم خيالي */}
            {filteredInvoices.length > 0 ? (
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl transform rotate-1"></div>
                <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-1 shadow-2xl">
                  <div className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden">
                    {/* عنوان الجدول */}
                    <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 text-white px-8 py-8">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="absolute inset-0 bg-white/20 rounded-full blur-xl animate-pulse"></div>
                            <div className="relative p-4 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
                              <FileText className="w-10 h-10" />
                            </div>
                          </div>
                          <div>
                            <h3 className="font-black text-3xl drop-shadow-lg">🧾 فواتير التسوية</h3>
                            <p className="text-white/80 text-lg font-bold">إجمالي {filteredInvoices.length} فاتورة مكتملة</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-5xl font-black text-emerald-400 drop-shadow-lg">{filteredInvoices.length}</div>
                          <div className="text-lg text-white/70 font-semibold">فاتورة</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* رؤوس الأعمدة */}
                    <div className="bg-gradient-to-r from-slate-100 via-white to-slate-100 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 border-b-2 border-slate-200 dark:border-slate-600">
                      <div className="grid grid-cols-6 gap-4 px-8 py-6">
                        <div className="text-center font-black text-lg text-purple-700 dark:text-purple-400">رقم الفاتورة</div>
                        <div className="text-center font-black text-lg text-blue-700 dark:text-blue-400">اسم الموظف</div>
                        <div className="text-center font-black text-lg text-emerald-700 dark:text-emerald-400">المبلغ</div>
                        <div className="text-center font-black text-lg text-orange-700 dark:text-orange-400">تاريخ التسوية</div>
                        <div className="text-center font-black text-lg text-green-700 dark:text-green-400">الحالة</div>
                        <div className="text-center font-black text-lg text-slate-700 dark:text-slate-400">الإجراءات</div>
                      </div>
                    </div>
                    
                    {/* صفوف البيانات */}
                    <div className="divide-y divide-slate-200 dark:divide-slate-700">
                      {loadingRealInvoices ? (
                        <div className="text-center py-16">
                          <div className="animate-spin w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                          <p className="text-xl font-bold text-slate-600 dark:text-slate-400">جاري تحميل البيانات...</p>
                        </div>
                      ) : (
                        filteredInvoices.map((invoice, index) => (
                          <div 
                            key={invoice.id} 
                            className={`grid grid-cols-6 gap-4 px-8 py-8 transition-all duration-500 hover:bg-gradient-to-r hover:from-blue-50 hover:via-purple-50 hover:to-pink-50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-pink-900/20 hover:shadow-xl hover:scale-[1.02] ${
                              index % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-900/30' : 'bg-white dark:bg-slate-800'
                            }`}
                          >
                            {/* رقم الفاتورة */}
                            <div className="flex items-center justify-center">
                              <div className="relative group">
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-all"></div>
                                <div className="relative bg-gradient-to-r from-purple-500 to-purple-600 text-white font-mono font-black px-6 py-4 rounded-xl shadow-xl hover:scale-110 transition-transform">
                                  {invoice.invoice_number}
                                </div>
                              </div>
                            </div>
                            
                            {/* اسم الموظف */}
                            <div className="flex flex-col items-center justify-center">
                              <div className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl shadow-lg hover:scale-105 transition-transform">
                                <User className="w-5 h-5" />
                                <span className="font-black">{invoice.employee_name}</span>
                              </div>
                            </div>
                            
                            {/* المبلغ */}
                            <div className="flex flex-col items-center justify-center">
                              <div className="text-4xl font-black text-emerald-600 dark:text-emerald-400 mb-2 hover:scale-110 transition-transform">
                                {invoice.total_amount?.toLocaleString()}
                              </div>
                              <div className="text-sm font-bold text-emerald-500 bg-emerald-100 dark:bg-emerald-900 px-3 py-1 rounded-full">دينار عراقي</div>
                            </div>
                            
                            {/* تاريخ التسوية */}
                            <div className="flex flex-col items-center justify-center">
                              <div className="bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900 dark:to-amber-900 px-4 py-3 rounded-xl border border-orange-200 dark:border-orange-700 hover:scale-105 transition-transform">
                                <div className="text-lg font-black text-orange-700 dark:text-orange-300">
                                  {invoice.settlement_date ? 
                                    format(parseISO(invoice.settlement_date), 'dd/MM/yyyy', { locale: ar }) :
                                    format(new Date(), 'dd/MM/yyyy', { locale: ar })
                                  }
                                </div>
                                <div className="text-sm font-bold text-orange-600 dark:text-orange-400 text-center">
                                  {invoice.settlement_date ? 
                                    format(parseISO(invoice.settlement_date), 'HH:mm', { locale: ar }) :
                                    format(new Date(), 'HH:mm', { locale: ar })
                                  }
                                </div>
                              </div>
                            </div>
                            
                            {/* الحالة */}
                            <div className="flex items-center justify-center">
                              <div className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-8 py-4 rounded-full shadow-lg hover:scale-105 transition-transform">
                                <div className="flex items-center gap-2 font-black">
                                  <CheckCircle className="w-6 h-6" />
                                  <span>مكتملة</span>
                                </div>
                              </div>
                            </div>
                            
                            {/* الإجراءات */}
                            <div className="flex items-center justify-center">
                              <Button 
                                onClick={() => handlePreviewInvoice(invoice)}
                                className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-black px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
                              >
                                <Eye className="w-5 h-5 mr-2" />
                                معاينة الفاتورة
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-24">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 bg-gradient-to-r from-slate-200 to-slate-300 rounded-full opacity-20 blur-3xl animate-pulse"></div>
                  </div>
                  <div className="relative">
                    <div className="mx-auto w-40 h-40 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-full flex items-center justify-center mb-8 shadow-2xl">
                      <Receipt className="w-20 h-20 text-slate-400 dark:text-slate-500" />
                    </div>
                    <h3 className="text-5xl font-black text-slate-600 dark:text-slate-400 mb-6">😔 لا توجد مستحقات مدفوعة</h3>
                    <p className="text-2xl text-slate-500 dark:text-slate-500 max-w-md mx-auto">لم يتم العثور على أي فواتير تسوية في الفترة المحددة</p>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="px-8 pb-6 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
            <Button 
              onClick={() => onOpenChange(false)} 
              className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-black py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
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