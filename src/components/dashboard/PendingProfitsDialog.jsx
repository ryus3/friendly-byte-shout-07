import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PackageCheck, DollarSign, Calendar, User, MapPin, Phone } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const PendingProfitsDialog = ({ 
  open, 
  onClose, 
  pendingProfitOrders = [], 
  onReceiveInvoices,
  user,
  isEmployeeView = false
}) => {
  const [selectedOrders, setSelectedOrders] = useState([]);

  useEffect(() => {
    if (!open) {
      setSelectedOrders([]);
    }
  }, [open]);

  const toggleOrderSelection = (orderId) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const selectAllOrders = () => {
    if (selectedOrders.length === pendingProfitOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(pendingProfitOrders.map(o => o.id));
    }
  };


  const calculateOrderProfit = (order) => {
    if (!order.items || !Array.isArray(order.items)) return 0;
    
    return order.items.reduce((sum, item) => {
      // التأكد من التحويل الصحيح للأرقام
      const unitPrice = parseFloat(item.unit_price || item.price) || 0;
      const costPrice = parseFloat(item.cost_price || item.costPrice) || 0;
      const quantity = parseInt(item.quantity) || 0;
      
      // للموظف: حساب ربحه فقط (لا يشمل ربح المدير)
      // للمدير: حساب الربح الكامل للطلب
      const profit = (unitPrice - costPrice) * quantity;
      
      console.log('💰 حساب الربح للطلب:', order.order_number, {
        product: item.product_name || item.name,
        unitPrice,
        costPrice,
        quantity,
        profit,
        isEmployeeView,
        orderCreatedBy: order.created_by,
        currentUser: user?.user_id || user?.id
      });
      
      return sum + Math.max(0, profit);
    }, 0);
  };

  const totalPendingProfit = pendingProfitOrders.reduce((sum, order) => {
    return sum + calculateOrderProfit(order);
  }, 0);

  const selectedOrdersProfit = pendingProfitOrders
    .filter(order => selectedOrders.includes(order.id))
    .reduce((sum, order) => sum + calculateOrderProfit(order), 0);

  const handleReceiveInvoices = async () => {
    if (selectedOrders.length === 0) {
      toast({
        title: "يرجى اختيار طلبات",
        description: "اختر طلباً واحداً على الأقل للتحاسب عليه",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsProcessing(true);

      if (isEmployeeView) {
        // للموظف: طلب تحاسب من المدير
        const { error } = await supabase
          .from('notifications')
          .insert({
            title: 'طلب تحاسب جديد',
            message: `طلب ${user?.full_name || 'موظف'} تحاسب على ${selectedOrders.length} طلب بمبلغ ${selectedOrdersProfit.toLocaleString()} د.ع`,
            type: 'profit_settlement_request',
            priority: 'high',
            data: {
              employee_id: user?.user_id || user?.id,
              employee_name: user?.full_name,
              order_ids: selectedOrders,
              total_profit: selectedOrdersProfit,
              orders_count: selectedOrders.length
            },
            user_id: '91484496-b887-44f7-9e5d-be9db5567604' // المدير
          });

        if (error) throw error;

        toast({
          title: "تم إرسال طلب التحاسب",
          description: `تم إرسال طلب تحاسب على ${selectedOrders.length} طلب للمدير بنجاح`,
          variant: "success"
        });
        
      } else {
        // للمدير: استلام فواتير
        const { error } = await supabase
          .from('orders')
          .update({
            receipt_received: true,
            receipt_received_at: new Date().toISOString(),
            receipt_received_by: user?.user_id || user?.id
          })
          .in('id', selectedOrders);

        if (error) throw error;

        // حساب الأرباح وإدخالها في جدول profits
        for (const orderId of selectedOrders) {
          try {
            await supabase.rpc('calculate_order_profit', { order_id_input: orderId });
          } catch (profitError) {
            console.error('خطأ في حساب الأرباح للطلب:', orderId, profitError);
          }
        }

        toast({
          title: "تم استلام الفواتير بنجاح",
          description: `تم استلام ${selectedOrders.length} فاتورة وتحويل الأرباح إلى المحاسبة`,
          variant: "success"
        });
      }

      if (onReceiveInvoices) onReceiveInvoices();
      onClose();

    } catch (error) {
      console.error('خطأ في المعالجة:', error);
      toast({
        title: isEmployeeView ? "خطأ في إرسال طلب التحاسب" : "خطأ في استلام الفواتير",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const [isProcessing, setIsProcessing] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[98vw] max-w-6xl h-[95vh] flex flex-col p-0 gap-0 bg-gradient-to-br from-white via-slate-50 to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-blue-900">
        <DialogHeader className="flex-shrink-0 p-6 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
          <DialogTitle className="text-2xl font-bold flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-slate-800 dark:text-white">
                {isEmployeeView ? 'أرباحي المعلقة - طلبات للتحاسب' : 'الأرباح المعلقة - طلبات محلية'}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 font-normal">
                {isEmployeeView ? 'طلباتك المُسلّمة والمنتظرة للتحاسب عليها' : 'الطلبات المُوصلة والمنتظرة لاستلام الفواتير لاحتساب الأرباح الفعلية'}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 p-6 gap-6">
          {/* إحصائيات سريعة بتصميم أنيق */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-shrink-0">
            <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-slate-200 dark:border-slate-600 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                    <PackageCheck className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">إجمالي الطلبات</p>
                    <p className="text-3xl font-bold text-slate-800 dark:text-white">{pendingProfitOrders.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-slate-200 dark:border-slate-600 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg">
                    <DollarSign className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">إجمالي الأرباح المعلقة</p>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">{totalPendingProfit.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">د.ع</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-slate-200 dark:border-slate-600 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                    <DollarSign className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">الأرباح المحددة</p>
                    <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{selectedOrdersProfit.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">د.ع</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* أزرار التحكم بتصميم أنيق */}
          <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
            <Button 
              onClick={selectAllOrders}
              variant="outline"
              size="lg"
              className="w-full sm:w-auto bg-white/50 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 backdrop-blur-sm shadow-lg"
            >
              {selectedOrders.length === pendingProfitOrders.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
            </Button>
            
            <Button 
              onClick={handleReceiveInvoices}
              disabled={selectedOrders.length === 0 || isProcessing}
              size="lg"
              className="w-full sm:w-auto bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <PackageCheck className="h-5 w-5 animate-spin ml-2" />
                  جاري المعالجة...
                </>
              ) : isEmployeeView ? (
                <>
                  <DollarSign className="h-5 w-5 ml-2" />
                  طلب تحاسب ({selectedOrders.length})
                </>
              ) : (
                <>
                  <PackageCheck className="h-5 w-5 ml-2" />
                  استلام فواتير ({selectedOrders.length})
                </>
              )}
            </Button>
          </div>

          {/* قائمة الطلبات */}
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full w-full">
              <div className="space-y-2 pr-1">
                 {pendingProfitOrders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <PackageCheck className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">{isEmployeeView ? 'لا توجد طلبات معلقة للتحاسب' : 'لا توجد طلبات معلقة لاستلام فواتير'}</p>
                  </div>
                ) : (
                 pendingProfitOrders.map((order) => {
                    const orderProfit = calculateOrderProfit(order);
                    const isSelected = selectedOrders.includes(order.id);

                    return (
                      <Card 
                        key={order.id} 
                        className={`cursor-pointer transition-all duration-300 hover:shadow-xl border-2 ${
                          isSelected 
                            ? 'border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 shadow-lg' 
                            : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                        onClick={() => toggleOrderSelection(order.id)}
                      >
                        <CardContent className="p-6">
                          <div className="space-y-4">
                            {/* الصف الأول: معلومات الطلب والحالة */}
                            <div className="flex flex-wrap items-center gap-3">
                              <Badge variant="outline" className="text-sm font-mono bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                {order.order_number}
                              </Badge>
                              <Badge variant="secondary" className="text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                {isEmployeeView ? 'مُسلّم' : 'مُوصل'}
                              </Badge>
                              {order.tracking_number && (
                                <Badge variant="outline" className="text-sm font-mono bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                  {order.tracking_number}
                                </Badge>
                              )}
                              {isSelected && (
                                <Badge className="text-sm bg-green-500 text-white shadow-md">
                                  محدد ✓
                                </Badge>
                              )}
                            </div>

                            {/* الصف الثاني: معلومات العميل */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center shadow-md">
                                    <User className="w-5 h-5 text-white" />
                                  </div>
                                  <div>
                                    <p className="font-semibold text-slate-800 dark:text-white">{order.customer_name}</p>
                                    {order.customer_phone && (
                                      <p className="text-sm text-slate-600 dark:text-slate-300 font-mono">{order.customer_phone}</p>
                                    )}
                                  </div>
                                </div>
                                
                                {order.customer_province && (
                                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                    <MapPin className="w-4 h-4" />
                                    <span>{order.customer_province}</span>
                                  </div>
                                )}
                                
                                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                  <Calendar className="w-4 h-4" />
                                  <span>{format(parseISO(order.created_at), 'dd MMM yyyy', { locale: ar })}</span>
                                </div>
                              </div>

                              {/* الأرباح والمعلومات المالية */}
                              <div className="space-y-2">
                                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                                  <div className="text-center">
                                    <p className="text-sm sm:text-base font-bold text-green-600">
                                      {orderProfit.toLocaleString()} د.ع
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {isEmployeeView ? 'ربح الموظف' : 'ربح متوقع'}
                                    </p>
                                  </div>
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                                  <div className="text-center">
                                    <p className="text-sm font-medium">
                                      {(order.total_amount || 0).toLocaleString()} د.ع
                                    </p>
                                    <p className="text-xs text-muted-foreground">إجمالي المبيعات</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* الصف الثالث: تفاصيل المنتجات */}
                            {order.items && order.items.length > 0 && (
                              <div className="border-t pt-2">
                                <p className="text-xs text-muted-foreground mb-2">المنتجات ({order.items.length}):</p>
                                <div className="space-y-1 max-h-20 overflow-y-auto">
                                  {order.items.map((item, index) => (
                                    <div key={index} className="flex justify-between items-center text-xs bg-muted/30 rounded px-2 py-1">
                                      <span className="truncate flex-1">{item.product_name || item.name}</span>
                                      <span className="ml-2 font-mono">x{item.quantity}</span>
                                      <span className="ml-2 font-medium">{(item.unit_price * item.quantity).toLocaleString()} د.ع</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* تذييل النافذة */}
        <div className="flex-shrink-0 p-3 sm:p-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
            <Button variant="outline" onClick={onClose} size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
              إغلاق
            </Button>
            <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-right">
              {selectedOrders.length} من {pendingProfitOrders.length} طلب محدد
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PendingProfitsDialog;