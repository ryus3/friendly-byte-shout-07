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
  user
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
    return (order.items || []).reduce((sum, item) => {
      const profit = (item.unit_price - (item.cost_price || item.costPrice || 0)) * item.quantity;
      return sum + profit;
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
        description: "اختر طلباً واحداً على الأقل لاستلام فاتورته",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsProcessing(true);

      // تحديث حالة استلام الفواتير للطلبات المختارة
      const { error } = await supabase
        .from('orders')
        .update({
          receipt_received: true,
          receipt_received_at: new Date().toISOString(),
          receipt_received_by: user?.user_id || user?.id
        })
        .in('id', selectedOrders);

      if (error) {
        throw new Error(`خطأ في تحديث حالة استلام الفواتير: ${error.message}`);
      }

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

      if (onReceiveInvoices) onReceiveInvoices();
      onClose();

    } catch (error) {
      console.error('خطأ في استلام الفواتير:', error);
      toast({
        title: "خطأ في استلام الفواتير",
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
      <DialogContent className="w-[95vw] max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="flex-shrink-0 p-4 sm:p-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />
            الأرباح المعلقة - طلبات محلية
          </DialogTitle>
          <div className="text-sm text-muted-foreground mt-2">
            الطلبات المُوصلة والمنتظرة لاستلام الفواتير لاحتساب الأرباح الفعلية
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 pt-2 gap-4">
          {/* إحصائيات سريعة */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-shrink-0">
            <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <PackageCheck className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">إجمالي الطلبات</p>
                    <p className="text-base sm:text-lg font-semibold">{pendingProfitOrders.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">إجمالي الأرباح المعلقة</p>
                    <p className="text-base sm:text-lg font-semibold">{totalPendingProfit.toLocaleString()} د.ع</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">الأرباح المحددة</p>
                    <p className="text-base sm:text-lg font-semibold">{selectedOrdersProfit.toLocaleString()} د.ع</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* أزرار التحكم */}
          <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
            <Button 
              onClick={selectAllOrders}
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
            >
              {selectedOrders.length === pendingProfitOrders.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
            </Button>
            
            <Button 
              onClick={handleReceiveInvoices}
              disabled={selectedOrders.length === 0 || isProcessing}
              size="sm"
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? (
                <>
                  <PackageCheck className="h-4 w-4 animate-spin ml-2" />
                  جاري الاستلام...
                </>
              ) : (
                <>استلام فواتير ({selectedOrders.length})</>
              )}
            </Button>
          </div>

          {/* قائمة الطلبات */}
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full w-full">
              <div className="space-y-2 pr-2">
                {pendingProfitOrders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <PackageCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>لا توجد طلبات معلقة لاستلام فواتير</p>
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
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex flex-col gap-3">
                            {/* معلومات الطلب الأساسية */}
                            <div className="flex flex-col xs:flex-row xs:items-center gap-2">
                              <Badge variant="outline" className="w-fit text-xs">
                                {order.order_number}
                              </Badge>
                              <Badge variant="secondary" className="w-fit text-xs">
                                مُوصل
                              </Badge>
                              {isSelected && (
                                <Badge variant="default" className="w-fit text-xs bg-green-500">
                                  محدد
                                </Badge>
                              )}
                            </div>

                            {/* معلومات العميل والأرباح */}
                            <div className="flex flex-col sm:flex-row justify-between gap-3">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  <span className="text-sm font-medium truncate">{order.customer_name}</span>
                                </div>
                                {order.customer_phone && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    <span className="text-sm font-mono">{order.customer_phone}</span>
                                  </div>
                                )}
                                {order.customer_province && (
                                  <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    <span className="text-sm truncate">{order.customer_province}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  <span className="text-sm">
                                    {format(parseISO(order.created_at), 'dd MMM yyyy', { locale: ar })}
                                  </span>
                                </div>
                              </div>

                              {/* الأرباح والمعلومات المالية */}
                              <div className="flex sm:flex-col items-start sm:items-end gap-2 sm:gap-1 sm:text-right min-w-fit">
                                <div className="flex-1 sm:flex-none">
                                  <p className="text-base sm:text-lg font-bold text-green-600">
                                    {orderProfit.toLocaleString()} د.ع
                                  </p>
                                  <p className="text-xs text-muted-foreground">ربح متوقع</p>
                                </div>
                                <div className="flex-1 sm:flex-none">
                                  <p className="text-sm font-medium">
                                    {(order.total_amount || 0).toLocaleString()} د.ع
                                  </p>
                                  <p className="text-xs text-muted-foreground">إجمالي المبيعات</p>
                                </div>
                              </div>
                            </div>
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
        <div className="flex-shrink-0 p-4 sm:p-6 pt-2 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
            <Button variant="outline" onClick={onClose} size="sm" className="w-full sm:w-auto">
              إغلاق
            </Button>
            <div className="text-sm text-muted-foreground text-center sm:text-right">
              {selectedOrders.length} من {pendingProfitOrders.length} طلب محدد
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PendingProfitsDialog;