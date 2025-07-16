import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PackageCheck, DollarSign, Calendar, User, MapPin, Phone } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

const PendingProfitsDialog = ({ 
  open, 
  onClose, 
  pendingProfitOrders = [], 
  onReceiveInvoices 
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

  const handleReceiveInvoices = () => {
    if (selectedOrders.length > 0) {
      onReceiveInvoices(selectedOrders);
      onClose();
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md sm:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col mx-auto">
        <DialogHeader className="flex-shrink-0 pb-3 border-b">
          <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />
            <span className="text-sm sm:text-base">الأرباح المعلقة</span>
          </DialogTitle>
          <div className="text-xs sm:text-sm text-muted-foreground mt-1">
            طلبات مُوصلة بانتظار استلام الفواتير
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* إحصائيات سريعة */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-3 sm:mb-4 flex-shrink-0">
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <PackageCheck className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">الطلبات</p>
                    <p className="text-sm sm:text-lg font-semibold">{pendingProfitOrders.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">إجمالي الأرباح</p>
                    <p className="text-sm sm:text-lg font-semibold">{totalPendingProfit.toLocaleString()} د.ع</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">المحدد</p>
                    <p className="text-sm sm:text-lg font-semibold">{selectedOrdersProfit.toLocaleString()} د.ع</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* أزرار التحكم */}
          <div className="flex flex-col gap-2 mb-3 sm:mb-4 flex-shrink-0">
            <div className="flex gap-2">
              <Button 
                onClick={selectAllOrders}
                variant="outline"
                className="flex-1 text-xs sm:text-sm h-8 sm:h-9"
              >
                {selectedOrders.length === pendingProfitOrders.length ? 'إلغاء الكل' : 'تحديد الكل'}
              </Button>
              
              <Button 
                onClick={handleReceiveInvoices}
                disabled={selectedOrders.length === 0}
                className="flex-1 bg-green-600 hover:bg-green-700 text-xs sm:text-sm h-8 sm:h-9"
              >
                استلام ({selectedOrders.length})
              </Button>
            </div>
          </div>

          {/* قائمة الطلبات */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-2 pr-1">
              {pendingProfitOrders.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <PackageCheck className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-4 opacity-50" />
                  <p className="text-xs sm:text-sm">لا توجد طلبات معلقة</p>
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
                          {/* الصف الأول - معلومات الطلب */}
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline" className="w-fit text-xs">
                                {order.order_number}
                              </Badge>
                              <Badge variant="secondary" className="w-fit text-xs">
                                مُوصل
                              </Badge>
                            </div>
                            <div className="text-right">
                              <p className="text-sm sm:text-lg font-bold text-green-600">
                                {orderProfit.toLocaleString()} د.ع
                              </p>
                              <p className="text-xs text-muted-foreground">ربح متوقع</p>
                            </div>
                          </div>

                          {/* الصف الثاني - معلومات العميل */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                              <span className="text-xs sm:text-sm font-medium">{order.customer_name}</span>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2 text-xs">
                              {order.customer_phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="h-3 w-3 text-muted-foreground" />
                                  <span className="font-mono text-xs">{order.customer_phone}</span>
                                </div>
                              )}
                              {order.customer_province && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs">{order.customer_province}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs">
                                  {format(parseISO(order.created_at), 'dd MMM yyyy', { locale: ar })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs">
                                  {(order.total_amount || 0).toLocaleString()} د.ع إجمالي
                                </span>
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

        {/* تذييل النافذة */}
        <div className="flex-shrink-0 pt-3 border-t">
          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={onClose} className="text-xs sm:text-sm h-8 sm:h-9">
              إغلاق
            </Button>
            <div className="text-xs sm:text-sm text-muted-foreground">
              {selectedOrders.length} من {pendingProfitOrders.length} محدد
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PendingProfitsDialog;