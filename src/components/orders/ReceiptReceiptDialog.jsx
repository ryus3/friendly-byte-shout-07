import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Receipt, Loader2, Package } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const ReceiptReceiptDialog = ({ open, onClose, orders, onSuccess, user }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState([]);

  useEffect(() => {
    if (open && orders) {
      setSelectedOrders(orders.map(o => o.id));
    }
  }, [open, orders]);

  const toggleOrderSelection = (orderId) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleSelectAll = () => {
    setSelectedOrders(prev => 
      prev.length === orders.length ? [] : orders.map(o => o.id)
    );
  };

  const handleReceiveReceipts = async () => {
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

      if (onSuccess) onSuccess();
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

  const calculateOrderProfit = (order) => {
    return (order.items || []).reduce((sum, item) => {
      const profit = (item.unit_price - (item.cost_price || item.costPrice || 0)) * item.quantity;
      return sum + profit;
    }, 0);
  };

  const totalSelectedProfit = orders
    ?.filter(o => selectedOrders.includes(o.id))
    .reduce((sum, o) => sum + calculateOrderProfit(o), 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-green-500" />
            استلام الفواتير ({orders?.length || 0})
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 py-2">
          <div className="space-y-4">
            {/* معلومات الأرباح */}
            <Card>
              <CardContent className="p-4">
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold">إجمالي الأرباح المختارة</h3>
                  <p className="text-2xl font-bold text-green-600">
                    {totalSelectedProfit.toLocaleString()} د.ع
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrders.length} من {orders?.length || 0} طلبات
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* أزرار التحكم */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
                className="flex-1"
              >
                {selectedOrders.length === orders?.length ? 'إلغاء الكل' : 'تحديد الكل'}
              </Button>
            </div>

            {/* قائمة الطلبات */}
            <div className="space-y-2">
              {(orders || []).map((order, index) => {
                const isSelected = selectedOrders.includes(order.id);
                const orderProfit = calculateOrderProfit(order);
                
                return (
                  <Card 
                    key={order.id} 
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary/10 border-primary' : ''
                    }`}
                    onClick={() => toggleOrderSelection(order.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isSelected ? 'bg-primary border-primary' : 'border-gray-300'
                          }`}>
                            {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                          </div>
                          <div>
                            <div className="font-medium">{order.tracking_number}</div>
                            <div className="text-sm text-muted-foreground">
                              {order.customer_name}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-green-600">
                            {orderProfit.toLocaleString()} د.ع
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {(order.items || []).length} منتجات
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 mt-4 flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            إلغاء
          </Button>
          <Button
            onClick={handleReceiveReceipts}
            disabled={isProcessing || selectedOrders.length === 0}
            className="w-full sm:w-auto flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري الاستلام...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                استلام الفواتير ({selectedOrders.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReceiptReceiptDialog;