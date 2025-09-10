import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PackageCheck, DollarSign, Calendar, User, MapPin, Phone, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from '@/components/ui/use-toast';
import superAPI from '@/api/SuperAPI';
import { useSuper } from '@/contexts/SuperProvider';

const PendingProfitsDialog = ({ 
  open, 
  onClose, 
  pendingProfitOrders = [], 
  onReceiveInvoices,
  user
}) => {
  const [selectedOrders, setSelectedOrders] = useState([]);
  const { calculateProfit, calculateManagerProfit } = useSuper();

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


  // دوال مساعدة للحسابات المالية
  const getNetSales = (order) => {
    // إجمالي المبيعات بدون رسوم التوصيل
    return (order.sales_amount != null)
      ? (Number(order.sales_amount) || 0)
      : (Number(order.final_amount || order.total_amount || 0) - Number(order.delivery_fee || 0));
  };

  const getTotalCost = (order) => {
    if (!order.items || !Array.isArray(order.items)) return 0;
    return order.items.reduce((costSum, item) => {
      const costPrice = item.cost_price || item.costPrice || 0;
      const quantity = item.quantity || 0;
      return costSum + (costPrice * quantity);
    }, 0);
  };

  const getEmployeeProfit = (order) => {
    if (!order.items || !Array.isArray(order.items) || !calculateProfit) return 0;
    
    return order.items.reduce((sum, item) => {
      const profit = calculateProfit(item, order.created_by) || 0;
      return sum + profit;
    }, 0);
  };

  const getTotalProfit = (order) => {
    const netSales = getNetSales(order);
    const totalCost = getTotalCost(order);
    return Math.max(0, netSales - totalCost);
  };

  const getManagerProfit = (order) => {
    if (!calculateManagerProfit) return 0;
    return calculateManagerProfit(order) || 0;
  };

  const calculateOrderProfitForDisplay = (order) => {
    const netSales = getNetSales(order);
    const totalCost = getTotalCost(order);
    const employeeProfit = getEmployeeProfit(order);
    const totalProfit = getTotalProfit(order);
    const managerProfit = getManagerProfit(order);

    console.log('🔢 تفاصيل حساب ربح الطلب:', { 
      orderNumber: order.order_number,
      createdBy: order.created_by,
      netSales,
      totalCost,
      employeeProfit,
      totalProfit,
      managerProfit,
      hasEmployeeProfitRules: employeeProfit > 0
    });

    return {
      netSales,
      totalCost,
      employeeProfit,
      totalProfit,
      managerProfit
    };
  };

  // حساب إجمالي أرباح الموظفين المعلقة (وليس الأرباح الإجمالية)
  const totalPendingProfit = pendingProfitOrders.reduce((sum, order) => {
    return sum + getEmployeeProfit(order);
  }, 0);

  const selectedOrdersProfit = pendingProfitOrders
    .filter(order => selectedOrders.includes(order.id))
    .reduce((sum, order) => sum + getEmployeeProfit(order), 0);

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

      // تحديث حالة استلام الفواتير + حساب الأرباح عبر API الموحد
      await superAPI.markOrdersReceiptReceived(selectedOrders, user?.user_id || user?.id);
      await superAPI.calculateProfitsForOrders(selectedOrders);

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
      <DialogContent className="w-[98vw] max-w-5xl h-[95vh] flex flex-col p-0 gap-0">
        <DialogHeader className="flex-shrink-0 p-3 sm:p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
            <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
            الأرباح المعلقة - طلبات محلية
          </DialogTitle>
          <div className="text-xs sm:text-sm text-muted-foreground mt-1">
            الطلبات المُوصلة والمنتظرة لاستلام الفواتير لاحتساب الأرباح الفعلية
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 p-2 sm:p-4 gap-3">
          {/* إحصائيات سريعة */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-shrink-0">
            <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
              <CardContent className="p-2 sm:p-3">
                <div className="flex items-center gap-2">
                  <PackageCheck className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">إجمالي الطلبات</p>
                    <p className="text-sm sm:text-base font-semibold">{pendingProfitOrders.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
              <CardContent className="p-2 sm:p-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">أرباح الموظفين المعلقة</p>
                    <p className="text-sm sm:text-base font-semibold">{totalPendingProfit.toLocaleString()} د.ع</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20">
              <CardContent className="p-2 sm:p-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-orange-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">أرباح الموظفين المحددة</p>
                    <p className="text-sm sm:text-base font-semibold">{selectedOrdersProfit.toLocaleString()} د.ع</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* توضيح نظام الخصومات */}
          <div className="mb-4 p-3 bg-muted/50 rounded-lg border-l-4 border-primary">
            <p className="text-sm text-muted-foreground">
              <strong>ملاحظة عن الخصومات:</strong> عند تطبيق خصم على طلب يحتوي على عدة منتجات، يتم تطبيق الخصم على إجمالي ربح الموظف وليس على منتج محدد. 
              الخصم يقلل من الربح الكلي للموظف وليس من سعر المنتجات الفردية.
            </p>
          </div>

          {/* أزرار التحكم */}
          <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
            <Button 
              onClick={selectAllOrders}
              variant="outline"
              size="sm"
              className="w-full sm:w-auto text-xs sm:text-sm"
            >
              {selectedOrders.length === pendingProfitOrders.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
            </Button>
            
            <Button 
              onClick={handleReceiveInvoices}
              disabled={selectedOrders.length === 0 || isProcessing}
              size="sm"
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-xs sm:text-sm"
            >
              {isProcessing ? (
                <>
                  <PackageCheck className="h-3 w-3 sm:h-4 sm:w-4 animate-spin ml-1" />
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
              <div className="space-y-2 pr-1">
                {pendingProfitOrders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <PackageCheck className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">لا توجد طلبات معلقة لاستلام فواتير</p>
                  </div>
                ) : (
                  pendingProfitOrders.map((order) => {
                    const profitData = calculateOrderProfitForDisplay(order);
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
                                مُوصل
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
                                {/* ربح الموظف المتوقع */}
                                <div className={`rounded-lg p-2 ${
                                  profitData.employeeProfit > 0 
                                    ? 'bg-green-50 dark:bg-green-900/20' 
                                    : 'bg-yellow-50 dark:bg-yellow-900/20'
                                }`}>
                                  <div className="text-center">
                                    <p className={`text-sm sm:text-base font-bold ${
                                      profitData.employeeProfit > 0 
                                        ? 'text-green-600' 
                                        : 'text-yellow-600'
                                    }`}>
                                      {profitData.employeeProfit.toLocaleString()} د.ع
                                    </p>
                                    <p className="text-xs text-muted-foreground">ربح الموظف المتوقع</p>
                                    {profitData.employeeProfit === 0 && (
                                      <div className="flex items-center justify-center gap-1 mt-1">
                                        <AlertTriangle className="h-3 w-3 text-yellow-500" />
                                        <span className="text-xs text-yellow-600">لا توجد قاعدة ربح</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* إجمالي المبيعات */}
                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                                  <div className="text-center">
                                    <p className="text-sm font-medium">
                                      {profitData.netSales.toLocaleString()} د.ع
                                    </p>
                                    <p className="text-xs text-muted-foreground">إجمالي المبيعات</p>
                                  </div>
                                </div>

                                {/* ربح الإدارة (اختياري للشفافية) */}
                                {profitData.managerProfit > 0 && (
                                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2">
                                    <div className="text-center">
                                      <p className="text-sm font-medium text-purple-600">
                                        {profitData.managerProfit.toLocaleString()} د.ع
                                      </p>
                                      <p className="text-xs text-muted-foreground">ربح الإدارة</p>
                                    </div>
                                  </div>
                                )}
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
                                        {calculateProfit && (
                                        <span className="ml-2 text-xs font-medium">
                                            {(() => {
                                              const profit = calculateProfit(item, order.created_by) || 0;
                                              if (profit > 0) {
                                                return <span className="text-green-600">+{profit.toLocaleString()}</span>;
                                              } else {
                                                return <span className="text-muted-foreground">بلا ربح للموظف</span>;
                                              }
                                            })()}
                                          </span>
                                        )}
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