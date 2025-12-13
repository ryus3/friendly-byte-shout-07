import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz/formatInTimeZone';
// تعيين التوقيت المحلي العراقي
const IRAQ_TIMEZONE = 'Asia/Baghdad';
import { ar } from 'date-fns/locale';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { CheckCircle, FileText, Calendar, User, DollarSign, Receipt, Eye, TrendingUp, Banknote, Clock, Star, Award } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

// مكون معاينة الفاتورة
const InvoicePreviewDialog = ({ invoice, open, onOpenChange, settledProfits, allOrders }) => {
  if (!invoice) return null;


  // البحث عن الأرباح المرتبطة بهذه الفاتورة المحددة فقط
  const relatedProfits = settledProfits?.filter(profit => 
    profit.employee_id === invoice.employee_id &&
    // إضافة فلتر إضافي للتأكد من أن الأرباح تخص هذه الفاتورة
    (invoice.profit_ids?.includes(profit.id) || 
     invoice.order_ids?.includes(profit.order_id) ||
     // إذا لم تكن هناك معرفات محددة، نأخذ الأرباح بناءً على تاريخ التسوية
     (!invoice.profit_ids && !invoice.order_ids))
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
  // رابعاً: البحث عن طلبات الموظف مباشرة
  else {
    
    settledOrders = allOrders?.filter(order => 
      order.created_by === invoice.employee_id
    ) || [];
  }

  

  // حساب الإحصائيات للفاتورة المحددة فقط
  const stats = useMemo(() => {
    // إذا كانت الفاتورة تحتوي على settled_orders، استخدمها مباشرة
    if (invoice.settled_orders && Array.isArray(invoice.settled_orders) && invoice.settled_orders.length > 0) {
      return invoice.settled_orders.reduce((acc, order) => ({
        totalRevenue: acc.totalRevenue + (parseFloat(order.order_total) || 0),
        totalCost: acc.totalCost + (parseFloat(order.total_cost) || 0),
        totalProfit: acc.totalProfit + (parseFloat(order.employee_profit) || 0),
        ordersCount: acc.ordersCount + 1
      }), { totalRevenue: 0, totalCost: 0, totalProfit: 0, ordersCount: 0 });
    }
    
    // وإلا احسب من الأرباح المرتبطة
    return relatedProfits.reduce((acc, profit) => ({
      totalRevenue: acc.totalRevenue + (profit.total_revenue || 0),
      totalCost: acc.totalCost + (profit.total_cost || 0),
      totalProfit: acc.totalProfit + (profit.employee_profit || 0),
      ordersCount: acc.ordersCount + 1
    }), { totalRevenue: 0, totalCost: 0, totalProfit: 0, ordersCount: 0 });
  }, [relatedProfits, invoice.settled_orders]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden p-0">
        <ScrollArea className="h-full max-h-[85vh]">
          <div className="p-4 md:p-8">
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
            </div>

            {/* معلومات الفاتورة */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* معلومات الموظف */}
              <Card className="lg:col-span-2 relative overflow-hidden group cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl bg-background border-border">
                <CardContent className="relative p-5">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 group-hover:scale-110 transition-all duration-300">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-bold text-lg text-foreground">معلومات الموظف والفاتورة</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-2 md:p-3 backdrop-blur-sm hover:from-blue-600 hover:to-blue-700 transition-all duration-300 relative overflow-hidden">
                        <div className="absolute -bottom-2 -right-2 w-6 h-6 md:w-8 md:h-8 bg-white/10 rounded-full"></div>
                        <p className="text-xs opacity-90 font-medium mb-1">اسم الموظف</p>
                        <p className="font-bold text-sm md:text-base">{invoice.employee_name}</p>
                      </div>
                      <div className="bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg p-2 md:p-3 backdrop-blur-sm hover:from-emerald-600 hover:to-green-700 transition-all duration-300 relative overflow-hidden">
                        <div className="absolute -bottom-2 -right-2 w-6 h-6 md:w-8 md:h-8 bg-white/10 rounded-full"></div>
                        <p className="text-xs opacity-90 font-medium mb-1">معرف الموظف</p>
                        <p className="font-mono font-bold text-xs md:text-sm">{invoice.employee_code || 'غير محدد'}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-lg p-2 md:p-3 backdrop-blur-sm hover:from-purple-600 hover:to-violet-700 transition-all duration-300 relative overflow-hidden">
                        <div className="absolute -bottom-2 -right-2 w-6 h-6 md:w-8 md:h-8 bg-white/10 rounded-full"></div>
                        <p className="text-xs opacity-90 font-medium mb-1">رقم الفاتورة</p>
                        <p className="font-mono font-bold text-xs md:text-sm">{invoice.invoice_number}</p>
                      </div>
                      <div className="bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-lg p-2 md:p-3 backdrop-blur-sm hover:from-orange-600 hover:to-amber-700 transition-all duration-300 relative overflow-hidden">
                        <div className="absolute -bottom-2 -right-2 w-6 h-6 md:w-8 md:h-8 bg-white/10 rounded-full"></div>
                        <p className="text-xs opacity-90 font-medium mb-1">طريقة الدفع</p>
                        <p className="font-bold text-xs md:text-sm">{invoice.payment_method === 'cash' ? 'نقدي' : invoice.payment_method}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* المبلغ المدفوع */}
              <Card className="relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl group cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700 opacity-90"></div>
                <div className="absolute inset-0 bg-black/10"></div>
                <CardContent className="relative p-3 md:p-5 text-white text-center">
                  <div className="flex items-center justify-center gap-2 md:gap-3 mb-3 md:mb-4">
                    <div className="p-2 md:p-3 bg-white/20 rounded-xl backdrop-blur-sm border border-white/30 group-hover:scale-110 transition-all duration-300">
                      <DollarSign className="w-6 h-6 md:w-8 md:h-8 drop-shadow-lg" />
                    </div>
                    <h3 className="text-base md:text-lg font-bold drop-shadow-lg">المبلغ المدفوع</h3>
                  </div>
                  <p className="text-2xl md:text-4xl font-black mb-2 md:mb-3 drop-shadow-2xl">
                    {invoice.total_amount?.toLocaleString()}
                  </p>
                  <p className="text-sm md:text-base font-bold opacity-90 mb-3 md:mb-4 drop-shadow-lg">دينار عراقي</p>
                  <div className="bg-white/10 rounded-xl p-2 md:p-3 backdrop-blur-sm border border-white/20">
                    <div className="flex items-center justify-center gap-2 text-xs md:text-sm font-bold">
                      <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                      <span>تم الدفع بنجاح</span>
                    </div>
                  </div>
                  {/* تأثيرات بصرية محسنة */}
                  <div className="absolute -bottom-4 -right-4 w-12 h-12 md:w-16 md:h-16 bg-white/5 rounded-full"></div>
                  <div className="absolute -top-3 -left-3 w-8 h-8 md:w-12 md:h-12 bg-white/5 rounded-full"></div>
                </CardContent>
              </Card>
            </div>

            {/* إحصائيات الأرباح */}
            {stats.ordersCount > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-4 md:mb-6">
                <Card className="relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl">
                  <CardContent className="p-2 md:p-3 text-center">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-lg p-2 md:p-3 relative overflow-hidden">
                      <div className="flex justify-center mb-1 md:mb-2">
                        <div className="p-1 md:p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                          <Award className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                      </div>
                      <p className="text-[10px] md:text-xs opacity-90 mb-1">عدد الطلبات</p>
                      <p className="text-lg md:text-xl font-black">{stats.ordersCount}</p>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 md:w-6 md:h-6 bg-white/5 rounded-full"></div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl">
                  <CardContent className="p-2 md:p-3 text-center">
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-lg p-2 md:p-3 relative overflow-hidden">
                      <div className="flex justify-center mb-1 md:mb-2">
                        <div className="p-1 md:p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                          <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                      </div>
                      <p className="text-[10px] md:text-xs opacity-90 mb-1">إجمالي الإيرادات</p>
                      <p className="text-sm md:text-base font-black">{stats.totalRevenue.toLocaleString()}</p>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 md:w-6 md:h-6 bg-white/5 rounded-full"></div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl">
                  <CardContent className="p-2 md:p-3 text-center">
                    <div className="bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-lg p-2 md:p-3 relative overflow-hidden">
                      <div className="flex justify-center mb-1 md:mb-2">
                        <div className="p-1 md:p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                          <DollarSign className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                      </div>
                      <p className="text-[10px] md:text-xs opacity-90 mb-1">التكاليف</p>
                      <p className="text-sm md:text-base font-black">{stats.totalCost.toLocaleString()}</p>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 md:w-6 md:h-6 bg-white/5 rounded-full"></div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl">
                  <CardContent className="p-2 md:p-3 text-center">
                    <div className="bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-lg p-2 md:p-3 relative overflow-hidden">
                      <div className="flex justify-center mb-1 md:mb-2">
                        <div className="p-1 md:p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                          <Banknote className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                      </div>
                      <p className="text-[10px] md:text-xs opacity-90 mb-1">ربح الموظف</p>
                      <p className="text-sm md:text-base font-black">{stats.totalProfit.toLocaleString()}</p>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 md:w-6 md:h-6 bg-white/5 rounded-full"></div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* الطلبات المسواة */}
            {settledOrders.length > 0 && (
              <Card className="mb-4 md:mb-8 relative overflow-hidden shadow-2xl">
                <CardContent className="p-4 md:p-8">
                  <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-xl md:rounded-2xl p-4 md:p-8 relative overflow-hidden">
                    <div className="flex items-center gap-2 md:gap-4 mb-4 md:mb-8">
                      <div className="p-2 md:p-4 bg-white/10 rounded-xl md:rounded-2xl backdrop-blur-sm">
                        <FileText className="w-6 h-6 md:w-10 md:h-10" />
                      </div>
                      <h3 className="font-black text-xl md:text-3xl">
                        تفاصيل الطلبات المسواة
                      </h3>
                    </div>
                    
                    {/* عرض الهاتف - بدون جدول */}
                    <div className="md:hidden space-y-3">
                      {settledOrders.map((order, index) => {
                        const orderProfit = relatedProfits.find(p => p.order_id === order.id);
                        return (
                          <div key={order.id} className="bg-white/10 rounded-xl p-3 backdrop-blur-sm space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-blue-300 font-bold text-sm">#{order.order_number || 'N/A'}</span>
                              <span className="text-cyan-300 text-xs">
                                {format(parseISO(order.created_at), 'dd/MM/yyyy', { locale: ar })}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="text-green-300">
                                <span className="opacity-70">الإيرادات: </span>
                                <span className="font-bold">{orderProfit?.total_revenue?.toLocaleString() || '0'}</span>
                              </div>
                              <div className="text-orange-300">
                                <span className="opacity-70">التكاليف: </span>
                                <span className="font-bold">{orderProfit?.total_cost?.toLocaleString() || '0'}</span>
                              </div>
                            </div>
                            <div className="text-purple-300 text-center font-bold">
                              ربح الموظف: {orderProfit?.employee_profit?.toLocaleString() || order.employee_profit?.toLocaleString() || '0'}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* عرض الديسكتوب - جدول */}
                    <div className="hidden md:block bg-white/10 rounded-2xl p-1 backdrop-blur-sm">
                      <div className="bg-slate-900/80 rounded-xl overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-4 md:px-8 py-4 md:py-6">
                          <div className="grid grid-cols-5 gap-3 md:gap-6 text-center font-bold text-sm md:text-lg">
                            <div className="text-blue-300 flex items-center justify-center gap-1 md:gap-2">
                              <FileText className="w-4 h-4 md:w-5 md:h-5" />
                              <span className="hidden md:inline">رقم الطلب</span>
                              <span className="md:hidden">الطلب</span>
                            </div>
                            <div className="text-green-300 flex items-center justify-center gap-1 md:gap-2">
                              <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
                              <span className="hidden md:inline">الإيرادات</span>
                              <span className="md:hidden">إيرادات</span>
                            </div>
                            <div className="text-orange-300 flex items-center justify-center gap-1 md:gap-2">
                              <DollarSign className="w-4 h-4 md:w-5 md:h-5" />
                              <span className="hidden md:inline">التكاليف</span>
                              <span className="md:hidden">تكاليف</span>
                            </div>
                            <div className="text-purple-300 flex items-center justify-center gap-1 md:gap-2">
                              <Banknote className="w-4 h-4 md:w-5 md:h-5" />
                              <span className="hidden md:inline">ربح الموظف</span>
                              <span className="md:hidden">ربح</span>
                            </div>
                            <div className="text-cyan-300 flex items-center justify-center gap-1 md:gap-2">
                              <Calendar className="w-4 h-4 md:w-5 md:h-5" />
                              <span className="hidden md:inline">تاريخ التسوية</span>
                              <span className="md:hidden">تاريخ</span>
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
                                className={`grid grid-cols-5 gap-3 md:gap-6 py-3 md:py-6 px-2 md:px-8 text-center transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-900/20 hover:to-purple-900/20 ${
                                  index % 2 === 0 ? 'bg-slate-800/50' : 'bg-slate-900/30'
                                }`}
                              >
                                {/* رقم الطلب */}
                                <div className="flex items-center justify-center">
                                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white font-mono font-bold px-2 md:px-4 py-1 md:py-3 rounded-lg md:rounded-xl shadow-lg text-xs md:text-lg hover:scale-105 transition-transform relative overflow-hidden">
                                    {order.order_number || order.trackingnumber || 'N/A'}
                                    <div className="absolute -bottom-1 -right-1 w-2 h-2 md:w-3 md:h-3 bg-white/20 rounded-full"></div>
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
                                        formatInTimeZone(new Date(invoice.settlement_date), IRAQ_TIMEZONE, 'dd/MM/yyyy', { locale: ar }) :
                                        (orderProfit?.settled_at ? 
                                          formatInTimeZone(new Date(orderProfit.settled_at), IRAQ_TIMEZONE, 'dd/MM/yyyy', { locale: ar }) :
                                          'غير محدد'
                                        )
                                      }
                                    </div>
                                    <div className="text-xs opacity-90 font-semibold">
                                      {invoice.settlement_date ? 
                                        formatInTimeZone(new Date(invoice.settlement_date), IRAQ_TIMEZONE, 'HH:mm', { locale: ar }) :
                                        (orderProfit?.settled_at ? 
                                          formatInTimeZone(new Date(orderProfit.settled_at), IRAQ_TIMEZONE, 'HH:mm', { locale: ar }) :
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
const SettledDuesDialog = ({ open, onOpenChange, invoices, allUsers, profits = [], orders = [], timePeriod: externalTimePeriod = null, supervisedEmployeeIds = null, isDepartmentManager = false }) => {
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [dateRange, setDateRange] = useState(null);
  const [settledProfits, setSettledProfits] = useState([]);
  // استرجاع إعداد الفترة من localStorage أو استخدام الافتراضي "all"
  // إذا تم تمرير فترة من الخارج، استخدمها، وإلا استخدم المحفوظ محلياً
  const [timePeriod, setTimePeriod] = useState(() => {
    if (externalTimePeriod) return externalTimePeriod;
    const saved = localStorage.getItem('settledDues_timePeriod');
    return saved || 'all'; // "all" كافتراضي جديد
  });
  
  // تحديث الفترة إذا تغيرت من الخارج
  React.useEffect(() => {
    if (externalTimePeriod && externalTimePeriod !== timePeriod) {
      setTimePeriod(externalTimePeriod);
    }
  }, [externalTimePeriod]);

  // جلب فواتير التسوية الحقيقية
  const [realSettlementInvoices, setRealSettlementInvoices] = useState([]);
  const [loadingRealInvoices, setLoadingRealInvoices] = useState(false);

  // جلب الأرباح المسواة والطلبات مع تشغيل الهجرة
  useEffect(() => {
    const fetchSettledProfits = async () => {
      try {
        // تشغيل هجرة المصروفات إلى فواتير التسوية أولاً
        
        const { data: migrationResult, error: migrationError } = await supabase
          .rpc('migrate_employee_dues_expenses');

        if (migrationError) {
          console.error('❌ خطأ في الهجرة:', migrationError);
        } else if (migrationResult?.migrated_count > 0) {
          
        }

        
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
          
          const profitsWithOrderData = data?.map(profit => ({
            ...profit,
            order_number: profit.orders?.order_number,
            customer_name: profit.orders?.customer_name,
            employee_name: allUsers?.find(user => user.user_id === profit.employee_id)?.full_name || 'غير محدد'
          })) || [];
          
          setSettledProfits(profitsWithOrderData);
          
        }
      } catch (error) {
        console.error('❌ خطأ غير متوقع:', error);
      }
    };

    // جلب جميع الطلبات للموظف المحدد
    const fetchAllOrdersForEmployee = async () => {
      try {
        
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('created_by', 'fba59dfc-451c-4906-8882-ae4601ff34d4'); // معرف موظف احمد

        if (error) {
          console.error('❌ خطأ في جلب الطلبات:', error);
        } else {
          
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

        // لمدير القسم: تصفية حسب الموظفين المشرف عليهم فقط
        if (isDepartmentManager && supervisedEmployeeIds?.length > 0) {
          query = query.in('employee_id', supervisedEmployeeIds);
        }

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
          case 'all':
          default:
            startDate = null; // لا فلترة زمنية
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
      
    }

    return allInvoices;
  }, [realSettlementInvoices, invoices, allUsers]);

  // قائمة الموظفين الفريدة - استخدام employee_id للتأكد من عدم التكرار
  const employees = useMemo(() => {
    const uniqueEmployeesMap = new Map();
    
    settlementInvoices.forEach(invoice => {
      if (invoice.employee_id && invoice.employee_name && invoice.employee_name !== 'غير محدد') {
        uniqueEmployeesMap.set(invoice.employee_id, invoice.employee_name);
      }
    });
    
    return Array.from(uniqueEmployeesMap.values());
  }, [settlementInvoices]);

  // تصفية الفواتير
  const filteredInvoices = useMemo(() => {
    let filtered = settlementInvoices;


    // تصفية حسب الموظف
    if (selectedEmployeeFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.employee_name === selectedEmployeeFilter);
      
    }

    // تصفية حسب الفترة الزمنية
    if (timePeriod && timePeriod !== 'all') {
      const now = new Date();
      let startDate = null;

      switch (timePeriod) {
        case 'day':
          // بداية اليوم الحالي
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
          const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
          

          filtered = filtered.filter(invoice => {
            // التأكد من وجود تاريخ صحيح
            const dateToCheck = invoice.settlement_date || invoice.created_at;
            if (!dateToCheck) {
              
              return false;
            }

            const invoiceDate = new Date(dateToCheck);
            
            // التحقق من صحة التاريخ
            if (isNaN(invoiceDate.getTime())) {
              
              return false;
            }

            const isInRange = invoiceDate >= startDate && invoiceDate <= endDate;
            

            return isInRange;
          });
          break;

        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          startDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter(invoice => {
            const dateToCheck = invoice.settlement_date || invoice.created_at;
            if (!dateToCheck) return false;
            const invoiceDate = new Date(dateToCheck);
            return !isNaN(invoiceDate.getTime()) && invoiceDate >= startDate;
          });
          break;

        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          filtered = filtered.filter(invoice => {
            const dateToCheck = invoice.settlement_date || invoice.created_at;
            if (!dateToCheck) return false;
            const invoiceDate = new Date(dateToCheck);
            return !isNaN(invoiceDate.getTime()) && invoiceDate >= startDate;
          });
          break;
      }

      
    }

    // تصفية حسب النطاق الزمني المخصص (إذا كان محدداً)
    if (dateRange?.from && dateRange?.to) {
      filtered = filtered.filter(invoice => {
        const dateToCheck = invoice.settlement_date || invoice.created_at;
        if (!dateToCheck) return false;
        const invoiceDate = new Date(dateToCheck);
        return !isNaN(invoiceDate.getTime()) && invoiceDate >= dateRange.from && invoiceDate <= dateRange.to;
      });
      
    }

    // ترتيب النتائج حسب التاريخ (الأحدث أولاً)
    const sortedFiltered = filtered
      .filter(invoice => {
        const dateToCheck = invoice.settlement_date || invoice.created_at;
        return dateToCheck && !isNaN(new Date(dateToCheck).getTime());
      })
      .sort((a, b) => {
        const dateA = new Date(a.settlement_date || a.created_at);
        const dateB = new Date(b.settlement_date || b.created_at);
        return dateB - dateA;
      });

    
    return sortedFiltered;
  }, [settlementInvoices, selectedEmployeeFilter, dateRange, timePeriod]);

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
        <DialogContent className="!w-[96vw] !max-w-[96vw] sm:!max-w-5xl !h-[92vh] !max-h-[92vh] !p-2 md:!p-6 !m-1 flex flex-col">
          <DialogHeader className="!pb-2 sm:!pb-4 !px-1">
            <DialogTitle className="!text-lg sm:!text-xl font-bold text-center flex items-center justify-center gap-2 sm:gap-3">
              <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg text-white">
                <CheckCircle className="w-5 h-5" />
              </div>
              المستحقات المدفوعة
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground text-sm">
              عرض جميع فواتير التسوية المكتملة للموظفين
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 !overflow-y-auto !max-h-[calc(100vh-200px)]">
            <div className="space-y-4 pr-4">
            {/* الفلاتر */}
            <div className="flex flex-col sm:flex-row gap-3 p-3 bg-muted/30 rounded-lg">
              <div className="flex-1">
                <Select value={selectedEmployeeFilter} onValueChange={setSelectedEmployeeFilter}>
                  <SelectTrigger className="h-9">
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

              <div className="flex-1">
                <Select value={timePeriod} onValueChange={(value) => {
                  setTimePeriod(value);
                  // حفظ الإعداد في localStorage
                  localStorage.setItem('settledDues_timePeriod', value);
                }}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="الفترة الزمنية" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الفترات (افتراضي)</SelectItem>
                    <SelectItem value="day">اليوم</SelectItem>
                    <SelectItem value="week">الأسبوع</SelectItem>
                    <SelectItem value="month">الشهر</SelectItem>
                    <SelectItem value="year">السنة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1">
                <DateRangePicker
                  date={dateRange}
                  onDateChange={setDateRange}
                  placeholder="اختر نطاق زمني"
                />
              </div>
            </div>

            {/* الإحصائيات */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="relative overflow-hidden group cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-700 opacity-90"></div>
                <div className="absolute inset-0 bg-black/10"></div>
                <CardContent className="relative p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-3xl font-black drop-shadow-lg">{employees.length}</p>
                      <p className="text-sm font-medium opacity-90">عدد الموظفين</p>
                      <div className="w-12 h-1 bg-white/30 rounded-full"></div>
                    </div>
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/30 group-hover:scale-110 transition-all duration-300">
                      <User className="w-7 h-7 drop-shadow-lg" />
                    </div>
                  </div>
                  <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/5 rounded-full"></div>
                  <div className="absolute -top-4 -left-4 w-16 h-16 bg-white/5 rounded-full"></div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden group cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700 opacity-90"></div>
                <div className="absolute inset-0 bg-black/10"></div>
                <CardContent className="relative p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-2xl font-black drop-shadow-lg">{totalAmount.toLocaleString()}</p>
                      <p className="text-sm font-medium opacity-90">إجمالي المبلغ (د.ع)</p>
                      <div className="w-12 h-1 bg-white/30 rounded-full"></div>
                    </div>
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/30 group-hover:scale-110 transition-all duration-300">
                      <DollarSign className="w-7 h-7 drop-shadow-lg" />
                    </div>
                  </div>
                  <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/5 rounded-full"></div>
                  <div className="absolute -top-4 -left-4 w-16 h-16 bg-white/5 rounded-full"></div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden group cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-cyan-600 to-indigo-700 opacity-90"></div>
                <div className="absolute inset-0 bg-black/10"></div>
                <CardContent className="relative p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-3xl font-black drop-shadow-lg">{filteredInvoices.length}</p>
                      <p className="text-sm font-medium opacity-90">عدد الفواتير</p>
                      <div className="w-12 h-1 bg-white/30 rounded-full"></div>
                    </div>
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/30 group-hover:scale-110 transition-all duration-300">
                      <FileText className="w-7 h-7 drop-shadow-lg" />
                    </div>
                  </div>
                  <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/5 rounded-full"></div>
                  <div className="absolute -top-4 -left-4 w-16 h-16 bg-white/5 rounded-full"></div>
                </CardContent>
              </Card>
            </div>

            {/* كروت الفواتير */}
            <div className="max-h-[400px] overflow-y-auto">
              {loadingRealInvoices ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="mt-2 text-sm text-muted-foreground">جاري تحميل البيانات...</p>
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="text-center py-12">
                  <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4">
                    <FileText className="w-8 h-8 text-muted-foreground mx-auto" />
                  </div>
                  <p className="text-muted-foreground">لا توجد فواتير تسوية</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredInvoices.map((invoice) => (
                    <Card 
                      key={invoice.id} 
                      className="group hover:shadow-lg transition-all duration-300 border border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50/80 to-white dark:from-slate-900/80 dark:to-slate-800"
                    >
                       <CardContent className="p-3">
                         {/* الهيدر - رقم الفاتورة والحالة */}
                         <div className="flex items-center justify-between mb-3">
                           <div className="flex items-center gap-2">
                             <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg text-white">
                               <Receipt className="w-3 h-3" />
                             </div>
                             <div>
                               <p className="font-bold text-blue-600 font-mono text-sm">
                                 {invoice.invoice_number}
                               </p>
                               <p className="text-xs text-muted-foreground">رقم الفاتورة</p>
                             </div>
                           </div>
                           <Badge 
                             variant="secondary" 
                             className="bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 text-xs font-bold px-2 py-1 rounded-md gap-1"
                           >
                             <CheckCircle className="w-3 h-3" />
                             مكتملة
                           </Badge>
                         </div>

                         {/* المعلومات الأساسية */}
                         <div className="space-y-2 mb-3">
                           {/* اسم الموظف */}
                           <div className="flex items-center gap-2">
                             <div className="p-1 bg-green-100 rounded dark:bg-green-900/30">
                               <User className="w-3 h-3 text-green-600" />
                             </div>
                             <div className="flex-1">
                               <span className="text-xs text-muted-foreground">الموظف: </span>
                               <span className="font-semibold text-green-700 dark:text-green-400 text-sm">
                                 {invoice.employee_name}
                               </span>
                             </div>
                           </div>

                           {/* المبلغ */}
                           <div className="flex items-center gap-2">
                             <div className="p-1 bg-emerald-100 rounded dark:bg-emerald-900/30">
                               <DollarSign className="w-3 h-3 text-emerald-600" />
                             </div>
                             <div className="flex-1">
                               <span className="text-xs text-muted-foreground">المبلغ: </span>
                               <span className="font-bold text-emerald-600 text-sm">
                                 {invoice.total_amount?.toLocaleString()} د.ع
                               </span>
                             </div>
                           </div>

                           {/* التاريخ */}
                           <div className="flex items-center gap-2">
                             <div className="p-1 bg-purple-100 rounded dark:bg-purple-900/30">
                               <Calendar className="w-3 h-3 text-purple-600" />
                             </div>
                             <div className="flex-1">
                               <span className="text-xs text-muted-foreground">التاريخ: </span>
                               <span className="font-medium text-purple-600 text-sm">
                                 {invoice.settlement_date ? 
                                   format(parseISO(invoice.settlement_date), 'dd/MM/yyyy - HH:mm', { locale: ar }) :
                                   (invoice.created_at ? 
                                     format(parseISO(invoice.created_at), 'dd/MM/yyyy - HH:mm', { locale: ar }) :
                                     'غير محدد'
                                   )
                                 }
                               </span>
                             </div>
                           </div>
                         </div>

                         {/* زر المعاينة */}
                         <div className="flex justify-end">
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => handlePreviewInvoice(invoice)}
                             className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-none hover:from-indigo-600 hover:to-purple-700 hover:shadow-lg transition-all duration-300 text-xs"
                           >
                             <Eye className="w-3 h-3" />
                             معاينة
                           </Button>
                         </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
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