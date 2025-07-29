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

// مكون معاينة الفاتورة المفصلة
const InvoicePreviewDialog = ({ invoice, open, onOpenChange, settledProfits, allOrders }) => {
  const [relatedOrders, setRelatedOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(false);

  if (!invoice) return null;

  // جلب الطلبات والعناصر المرتبطة بالفاتورة
  useEffect(() => {
    if (open && invoice) {
      fetchInvoiceDetails();
    }
  }, [open, invoice]);

  const fetchInvoiceDetails = async () => {
    setLoading(true);
    try {
      // جلب الطلبات المرتبطة بالموظف في نفس الفترة
      const invoiceDate = new Date(invoice.settlement_date || invoice.created_at);
      const startOfMonth = new Date(invoiceDate.getFullYear(), invoiceDate.getMonth(), 1);
      const endOfMonth = new Date(invoiceDate.getFullYear(), invoiceDate.getMonth() + 1, 0);

      const { data: ordersData } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            product_id,
            product_variants (
              *,
              products (name),
              colors (name),
              sizes (name)
            )
          )
        `)
        .eq('assigned_to', invoice.metadata?.employee_id || null)
        .gte('created_at', startOfMonth.toISOString())
        .lte('created_at', endOfMonth.toISOString())
        .order('created_at', { ascending: false });

      // جلب العناصر الفردية
      const allItems = ordersData?.flatMap(order => 
        order.order_items?.map(item => ({
          ...item,
          order_number: order.order_number,
          order_date: order.created_at,
          order_total: order.final_amount,
          customer_name: order.customer_name
        })) || []
      ) || [];

      setRelatedOrders(ordersData || []);
      setOrderItems(allItems);

    } catch (error) {
      console.error('خطأ في جلب تفاصيل الفاتورة:', error);
    } finally {
      setLoading(false);
    }
  };

  // حساب الإحصائيات التفصيلية
  const stats = useMemo(() => {
    const orders = relatedOrders || [];
    const items = orderItems || [];
    
    return {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, order) => sum + Number(order.final_amount || 0), 0),
      totalOriginalAmount: orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
      totalDiscount: orders.reduce((sum, order) => sum + Number(order.discount || 0), 0),
      totalDeliveryFees: orders.reduce((sum, order) => sum + Number(order.delivery_fee || 0), 0),
      totalItems: items.length,
      totalCost: items.reduce((sum, item) => sum + (Number(item.product_variants?.cost_price || 0) * Number(item.quantity || 0)), 0),
      estimatedProfit: orders.reduce((sum, order) => sum + Number(order.final_amount || 0), 0) - 
                      items.reduce((sum, item) => sum + (Number(item.product_variants?.cost_price || 0) * Number(item.quantity || 0)), 0),
      avgOrderValue: orders.length > 0 ? orders.reduce((sum, order) => sum + Number(order.final_amount || 0), 0) / orders.length : 0
    };
  }, [relatedOrders, orderItems]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[95vh] bg-gradient-to-br from-background via-muted/20 to-background border-0 shadow-2xl">
        <ScrollArea className="h-full">
          <div className="p-8">
            {/* Header مفصل */}
            <div className="text-center mb-8 pb-6 border-b-2 border-gradient-to-r from-emerald-500 to-blue-500">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-blue-500 rounded-2xl blur-lg opacity-60"></div>
                  <div className="relative p-4 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-2xl text-white shadow-2xl">
                    <Receipt className="w-12 h-12" />
                  </div>
                </div>
                <div>
                  <h1 className="text-5xl font-black bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                    فاتورة تسوية مفصلة
                  </h1>
                  <p className="text-xl text-muted-foreground font-medium">بيان شامل لمستحقات الموظف</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 p-4 rounded-xl border border-emerald-200/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-5 h-5 text-emerald-600" />
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">تاريخ الإصدار</span>
                  </div>
                  <p className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
                    {invoice.settlement_date || invoice.created_at ? 
                      format(parseISO(invoice.settlement_date || invoice.created_at), 'EEEE dd MMMM yyyy - HH:mm', { locale: ar }) :
                      format(new Date(), 'EEEE dd MMMM yyyy - HH:mm', { locale: ar })
                    }
                  </p>
                </div>
                
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-xl border border-blue-200/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Receipt className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-blue-700 dark:text-blue-300">رقم الفاتورة</span>
                  </div>
                  <p className="text-lg font-bold text-blue-800 dark:text-blue-200 font-mono">
                    {invoice.invoice_number}
                  </p>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-4 rounded-xl border border-purple-200/50">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-5 h-5 text-purple-600" />
                    <span className="font-semibold text-purple-700 dark:text-purple-300">الموظف</span>
                  </div>
                  <p className="text-lg font-bold text-purple-800 dark:text-purple-200">
                    {invoice.employee_name}
                  </p>
                </div>
              </div>
            </div>

            {/* إحصائيات شاملة */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-8">
              <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0 shadow-xl">
                <CardContent className="p-6 text-center">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <DollarSign className="w-8 h-8" />
                    <h3 className="text-lg font-bold">المبلغ المدفوع</h3>
                  </div>
                  <p className="text-4xl font-black mb-2">
                    {invoice.settlement_amount?.toLocaleString()}
                  </p>
                  <p className="text-sm opacity-90">دينار عراقي</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-xl">
                <CardContent className="p-6 text-center">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <FileText className="w-8 h-8" />
                    <h3 className="text-lg font-bold">عدد الطلبات</h3>
                  </div>
                  <p className="text-4xl font-black mb-2">
                    {stats.totalOrders}
                  </p>
                  <p className="text-sm opacity-90">طلب</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-xl">
                <CardContent className="p-6 text-center">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <TrendingUp className="w-8 h-8" />
                    <h3 className="text-lg font-bold">إجمالي الإيرادات</h3>
                  </div>
                  <p className="text-4xl font-black mb-2">
                    {stats.totalRevenue.toLocaleString()}
                  </p>
                  <p className="text-sm opacity-90">دينار عراقي</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-500 to-red-500 text-white border-0 shadow-xl">
                <CardContent className="p-6 text-center">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Star className="w-8 h-8" />
                    <h3 className="text-lg font-bold">متوسط الطلب</h3>
                  </div>
                  <p className="text-4xl font-black mb-2">
                    {stats.avgOrderValue.toLocaleString()}
                  </p>
                  <p className="text-sm opacity-90">دينار عراقي</p>
                </CardContent>
              </Card>
            </div>

            {/* تفاصيل مالية إضافية */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <Card className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-blue-900/20 border-0 shadow-lg">
                <CardContent className="p-6">
                  <h3 className="font-bold text-xl mb-4 flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg text-white">
                      <DollarSign className="w-6 h-6" />
                    </div>
                    التفاصيل المالية
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg">
                      <span className="text-sm font-medium text-muted-foreground">إجمالي قيمة الطلبات:</span>
                      <span className="font-bold text-lg">{stats.totalOriginalAmount.toLocaleString()} د.ع</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg">
                      <span className="text-sm font-medium text-muted-foreground">إجمالي الخصومات:</span>
                      <span className="font-bold text-lg text-red-600">-{stats.totalDiscount.toLocaleString()} د.ع</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg">
                      <span className="text-sm font-medium text-muted-foreground">رسوم التوصيل:</span>
                      <span className="font-bold text-lg text-blue-600">+{stats.totalDeliveryFees.toLocaleString()} د.ع</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30 rounded-lg border border-emerald-200/50">
                      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">صافي الإيرادات:</span>
                      <span className="font-black text-xl text-emerald-600 dark:text-emerald-400">{stats.totalRevenue.toLocaleString()} د.ع</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-0 shadow-lg">
                <CardContent className="p-6">
                  <h3 className="font-bold text-xl mb-4 flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    تحليل الأرباح
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg">
                      <span className="text-sm font-medium text-muted-foreground">إجمالي التكاليف:</span>
                      <span className="font-bold text-lg text-orange-600">{stats.totalCost.toLocaleString()} د.ع</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg">
                      <span className="text-sm font-medium text-muted-foreground">الربح المقدر:</span>
                      <span className="font-bold text-lg text-green-600">{stats.estimatedProfit.toLocaleString()} د.ع</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg">
                      <span className="text-sm font-medium text-muted-foreground">عدد المنتجات:</span>
                      <span className="font-bold text-lg">{stats.totalItems} منتج</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-lg border border-purple-200/50">
                      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">هامش الربح:</span>
                      <span className="font-black text-xl text-purple-600 dark:text-purple-400">
                        {stats.totalRevenue > 0 ? ((stats.estimatedProfit / stats.totalRevenue) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* جدول الطلبات المفصل */}
            {relatedOrders.length > 0 && (
              <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-2xl mb-8">
                <CardContent className="p-8">
                  <h3 className="font-bold text-2xl mb-6 flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg text-white">
                      <FileText className="w-7 h-7" />
                    </div>
                    تفاصيل الطلبات ({relatedOrders.length} طلب)
                  </h3>
                  
                  <div className="overflow-hidden rounded-2xl border border-border/60">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gradient-to-r from-muted to-muted/50">
                            <th className="text-right py-4 px-6 font-bold text-foreground">رقم الطلب</th>
                            <th className="text-right py-4 px-6 font-bold text-foreground">العميل</th>
                            <th className="text-right py-4 px-6 font-bold text-foreground">التاريخ</th>
                            <th className="text-right py-4 px-6 font-bold text-foreground">المبلغ الأصلي</th>
                            <th className="text-right py-4 px-6 font-bold text-foreground">الخصم</th>
                            <th className="text-right py-4 px-6 font-bold text-foreground">رسوم التوصيل</th>
                            <th className="text-right py-4 px-6 font-bold text-foreground">المبلغ النهائي</th>
                            <th className="text-right py-4 px-6 font-bold text-foreground">الحالة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {relatedOrders.map((order, index) => (
                            <tr key={order.id} className={`${index % 2 === 0 ? 'bg-background' : 'bg-muted/30'} hover:bg-muted/50 transition-colors`}>
                              <td className="py-4 px-6">
                                <span className="font-mono text-primary font-bold bg-primary/10 px-3 py-1 rounded-lg">
                                  {order.order_number}
                                </span>
                              </td>
                              <td className="py-4 px-6 font-semibold">
                                {order.customer_name}
                              </td>
                              <td className="py-4 px-6 text-muted-foreground font-medium">
                                {format(parseISO(order.created_at), 'dd/MM/yyyy HH:mm', { locale: ar })}
                              </td>
                              <td className="py-4 px-6">
                                <span className="text-blue-600 dark:text-blue-400 font-bold text-lg">
                                  {Number(order.total_amount || 0).toLocaleString()}
                                </span>
                              </td>
                              <td className="py-4 px-6">
                                <span className="text-red-600 dark:text-red-400 font-bold">
                                  -{Number(order.discount || 0).toLocaleString()}
                                </span>
                              </td>
                              <td className="py-4 px-6">
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                  +{Number(order.delivery_fee || 0).toLocaleString()}
                                </span>
                              </td>
                              <td className="py-4 px-6">
                                <span className="text-purple-600 dark:text-purple-400 font-black text-xl">
                                  {Number(order.final_amount || 0).toLocaleString()}
                                </span>
                              </td>
                              <td className="py-4 px-6">
                                <Badge className={`
                                  ${order.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 
                                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'}
                                `}>
                                  {order.status === 'completed' ? 'مكتمل' : 
                                   order.status === 'pending' ? 'قيد الانتظار' : 
                                   order.status === 'processing' ? 'قيد المعالجة' : order.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* جدول المنتجات المفصل */}
            {orderItems.length > 0 && (
              <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-2xl mb-8">
                <CardContent className="p-8">
                  <h3 className="font-bold text-2xl mb-6 flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg text-white">
                      <Star className="w-7 h-7" />
                    </div>
                    تفاصيل المنتجات ({orderItems.length} منتج)
                  </h3>
                  
                  <div className="overflow-hidden rounded-2xl border border-border/60">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gradient-to-r from-muted to-muted/50">
                            <th className="text-right py-4 px-6 font-bold text-foreground">رقم الطلب</th>
                            <th className="text-right py-4 px-6 font-bold text-foreground">المنتج</th>
                            <th className="text-right py-4 px-6 font-bold text-foreground">اللون/المقاس</th>
                            <th className="text-right py-4 px-6 font-bold text-foreground">الكمية</th>
                            <th className="text-right py-4 px-6 font-bold text-foreground">سعر الوحدة</th>
                            <th className="text-right py-4 px-6 font-bold text-foreground">سعر التكلفة</th>
                            <th className="text-right py-4 px-6 font-bold text-foreground">إجمالي السعر</th>
                            <th className="text-right py-4 px-6 font-bold text-foreground">إجمالي التكلفة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderItems.map((item, index) => (
                            <tr key={`${item.order_id}-${item.id}`} className={`${index % 2 === 0 ? 'bg-background' : 'bg-muted/30'} hover:bg-muted/50 transition-colors`}>
                              <td className="py-3 px-6">
                                <span className="font-mono text-xs text-primary font-bold bg-primary/10 px-2 py-1 rounded">
                                  {item.order_number}
                                </span>
                              </td>
                              <td className="py-3 px-6 font-semibold">
                                {item.product_variants?.products?.name || 'منتج غير محدد'}
                              </td>
                              <td className="py-3 px-6 text-sm text-muted-foreground">
                                <div className="space-y-1">
                                  {item.product_variants?.colors?.name && (
                                    <div>اللون: {item.product_variants.colors.name}</div>
                                  )}
                                  {item.product_variants?.sizes?.name && (
                                    <div>المقاس: {item.product_variants.sizes.name}</div>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-6 text-center">
                                <span className="font-bold text-lg bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-full text-blue-700 dark:text-blue-400">
                                  {item.quantity}
                                </span>
                              </td>
                              <td className="py-3 px-6">
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                  {Number(item.unit_price || 0).toLocaleString()}
                                </span>
                              </td>
                              <td className="py-3 px-6">
                                <span className="text-orange-600 dark:text-orange-400 font-bold">
                                  {Number(item.product_variants?.cost_price || 0).toLocaleString()}
                                </span>
                              </td>
                              <td className="py-3 px-6">
                                <span className="text-purple-600 dark:text-purple-400 font-black text-lg">
                                  {Number(item.total_price || 0).toLocaleString()}
                                </span>
                              </td>
                              <td className="py-3 px-6">
                                <span className="text-red-600 dark:text-red-400 font-bold">
                                  {(Number(item.product_variants?.cost_price || 0) * Number(item.quantity || 0)).toLocaleString()}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {/* وصف التسوية وملاحظات */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-0 shadow-xl">
                <CardContent className="p-6">
                  <h3 className="font-bold text-xl mb-4 flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-slate-600 to-slate-700 rounded-lg text-white">
                      <FileText className="w-6 h-6" />
                    </div>
                    وصف التسوية
                  </h3>
                  <div className="p-4 bg-white/60 dark:bg-slate-900/60 rounded-lg border">
                    <p className="text-foreground leading-relaxed font-medium">
                      {invoice.description}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 border-0 shadow-xl">
                <CardContent className="p-6">
                  <h3 className="font-bold text-xl mb-4 flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg text-white">
                      <Star className="w-6 h-6" />
                    </div>
                    معلومات النظام
                  </h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg border">
                      <p className="text-xs text-muted-foreground mb-1">معرف الفاتورة</p>
                      <p className="font-mono text-sm font-bold">{invoice.id}</p>
                    </div>
                    {invoice.metadata?.employee_id && (
                      <div className="p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg border">
                        <p className="text-xs text-muted-foreground mb-1">معرف الموظف</p>
                        <p className="font-mono text-sm font-bold">{invoice.metadata.employee_id}</p>
                      </div>
                    )}
                    <div className="p-3 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-lg border border-green-200/50">
                      <p className="text-xs text-green-700 dark:text-green-300 mb-1">حالة المعالجة</p>
                      <p className="font-bold text-green-800 dark:text-green-200">معالج تلقائياً بواسطة النظام</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* معلومات إضافية للفاتورة */}
            <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-0 shadow-xl">
              <CardContent className="p-6">
                <h3 className="font-bold text-xl mb-4 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-lg text-white">
                    <Clock className="w-6 h-6" />
                  </div>
                  ملخص الفترة الزمنية
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-white/60 dark:bg-slate-800/60 rounded-lg border">
                    <p className="text-sm text-muted-foreground mb-2">تاريخ بداية الفترة</p>
                    <p className="font-bold text-lg">
                      {invoice.settlement_date || invoice.created_at ? 
                        format(new Date(new Date(invoice.settlement_date || invoice.created_at).getFullYear(), new Date(invoice.settlement_date || invoice.created_at).getMonth(), 1), 'dd MMMM yyyy', { locale: ar }) :
                        'غير محدد'
                      }
                    </p>
                  </div>
                  <div className="text-center p-4 bg-white/60 dark:bg-slate-800/60 rounded-lg border">
                    <p className="text-sm text-muted-foreground mb-2">تاريخ نهاية الفترة</p>
                    <p className="font-bold text-lg">
                      {invoice.settlement_date || invoice.created_at ? 
                        format(new Date(new Date(invoice.settlement_date || invoice.created_at).getFullYear(), new Date(invoice.settlement_date || invoice.created_at).getMonth() + 1, 0), 'dd MMMM yyyy', { locale: ar }) :
                        'غير محدد'
                      }
                    </p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30 rounded-lg border border-amber-200/50">
                    <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">مدة الفترة</p>
                    <p className="font-bold text-lg text-amber-800 dark:text-amber-200">
                      {invoice.settlement_date || invoice.created_at ? 
                        `${new Date(new Date(invoice.settlement_date || invoice.created_at).getFullYear(), new Date(invoice.settlement_date || invoice.created_at).getMonth() + 1, 0).getDate()} يوم` :
                        'غير محدد'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
        
        <div className="p-6 border-t bg-muted/30 flex justify-between items-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Star className="w-4 h-4" />
            <span>تم إنشاء هذه الفاتورة تلقائياً بواسطة نظام إدارة المخزون</span>
          </div>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="min-w-[120px]"
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