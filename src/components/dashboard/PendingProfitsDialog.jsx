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
      
      console.log('💰 حساب الربح:', {
        product: item.product_name || item.name,
        unitPrice,
        costPrice,
        quantity,
        profit: (unitPrice - costPrice) * quantity
      });
      
      // الربح = (سعر البيع - سعر التكلفة) × الكمية
      const profit = (unitPrice - costPrice) * quantity;
      return sum + Math.max(0, profit); // تجنب الأرباح السالبة
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
      <DialogContent className="w-[98vw] max-w-6xl h-[95vh] flex flex-col p-0 gap-0 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 border-none">
        <DialogHeader className="flex-shrink-0 p-4 border-b border-white/10 bg-black/20 backdrop-blur-xl">
          <DialogTitle className="text-xl font-bold flex items-center gap-3 text-white">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            {isEmployeeView ? 'أرباحي المعلقة - طلبات للتحاسب' : 'الأرباح المعلقة - طلبات محلية'}
          </DialogTitle>
          <div className="text-sm text-blue-100 mt-2 opacity-90">
            {isEmployeeView ? 'طلباتك المُسلّمة والمنتظرة للتحاسب عليها' : 'الطلبات المُوصلة والمنتظرة لاستلام الفواتير لاحتساب الأرباح الفعلية'}
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 p-4 gap-4">
          {/* إحصائيات سريعة بتصميم احترافي */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-shrink-0">
            <Card className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-300/30 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <PackageCheck className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-blue-200">إجمالي الطلبات</p>
                    <p className="text-2xl font-bold text-white">{pendingProfitOrders.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-300/30 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs text-green-200">إجمالي الأرباح المعلقة</p>
                    <p className="text-2xl font-bold text-white">{totalPendingProfit.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-300/30 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs text-amber-200">الأرباح المحددة</p>
                    <p className="text-2xl font-bold text-white">{selectedOrdersProfit.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* أزرار التحكم بتصميم احترافي */}
          <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
            <Button 
              onClick={selectAllOrders}
              variant="outline"
              size="sm"
              className="w-full sm:w-auto bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
            >
              {selectedOrders.length === pendingProfitOrders.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
            </Button>
            
            <Button 
              onClick={handleReceiveInvoices}
              disabled={selectedOrders.length === 0 || isProcessing}
              size="sm"
              className="w-full sm:w-auto bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg"
            >
              {isProcessing ? (
                <>
                  <PackageCheck className="h-4 w-4 animate-spin ml-2" />
                  جاري المعالجة...
                </>
              ) : isEmployeeView ? (
                <>
                  <DollarSign className="h-4 w-4 ml-2" />
                  طلب تحاسب ({selectedOrders.length})
                </>
              ) : (
                <>
                  <PackageCheck className="h-4 w-4 ml-2" />
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
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
                        }`}
                        onClick={() => toggleOrderSelection(order.id)}
                      >
                        <CardContent className="p-3">
                          <div className="space-y-3">
                            {/* الصف الأول: معلومات الطلب والحالة */}
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-xs font-mono">
                                {order.order_number}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {isEmployeeView ? 'مُسلّم' : 'مُوصل'}
                              </Badge>
                              {order.tracking_number && (
                                <Badge variant="outline" className="text-xs font-mono">
                                  {order.tracking_number}
                                </Badge>
                              )}
                              {isSelected && (
                                <Badge variant="default" className="text-xs bg-green-500">
                                  محدد
                                </Badge>
                              )}
                            </div>

                            {/* الصف الثاني: معلومات العميل */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                  <span className="text-sm font-medium truncate">{order.customer_name}</span>
                                </div>
                                {order.customer_phone && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                    <span className="text-xs font-mono">{order.customer_phone}</span>
                                  </div>
                                )}
                                {order.customer_province && (
                                  <div className="flex items-center gap-2">
                                    <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                    <span className="text-xs truncate">{order.customer_province}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                  <span className="text-xs">
                                    {format(parseISO(order.created_at), 'dd MMM yyyy', { locale: ar })}
                                  </span>
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