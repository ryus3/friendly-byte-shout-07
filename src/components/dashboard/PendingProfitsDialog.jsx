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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4 border-b">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-orange-500" />
            الأرباح المعلقة - طلبات محلية
          </DialogTitle>
          <div className="text-sm text-muted-foreground mt-2">
            الطلبات المُوصلة والمنتظرة لاستلام الفواتير لاحتساب الأرباح الفعلية
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* إحصائيات سريعة */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 flex-shrink-0">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <PackageCheck className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي الطلبات</p>
                    <p className="text-lg font-semibold">{pendingProfitOrders.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي الأرباح المعلقة</p>
                    <p className="text-lg font-semibold">{totalPendingProfit.toLocaleString()} د.ع</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">الأرباح المحددة</p>
                    <p className="text-lg font-semibold">{selectedOrdersProfit.toLocaleString()} د.ع</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* أزرار التحكم */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4 flex-shrink-0">
            <Button 
              onClick={selectAllOrders}
              variant="outline"
              className="flex-1 sm:flex-none"
            >
              {selectedOrders.length === pendingProfitOrders.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
            </Button>
            
            <Button 
              onClick={handleReceiveInvoices}
              disabled={selectedOrders.length === 0}
              className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700"
            >
              استلام فواتير ({selectedOrders.length})
            </Button>
          </div>

          {/* قائمة الطلبات */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-3 pr-2">
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
                      <CardContent className="p-4">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            {/* معلومات الطلب الأساسية */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <Badge variant="outline" className="w-fit">
                                {order.order_number}
                              </Badge>
                              <Badge variant="secondary" className="w-fit">
                                مُوصل
                              </Badge>
                            </div>

                            {/* معلومات العميل */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span>{order.customer_name}</span>
                              </div>
                              {order.customer_phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-mono">{order.customer_phone}</span>
                                </div>
                              )}
                              {order.customer_province && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-muted-foreground" />
                                  <span>{order.customer_province}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span>
                                  {format(parseISO(order.created_at), 'dd MMM yyyy', { locale: ar })}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* الأرباح والمعلومات المالية */}
                          <div className="flex flex-col items-end gap-2 min-w-fit">
                            <div className="text-left">
                              <p className="text-lg font-bold text-green-600">
                                {orderProfit.toLocaleString()} د.ع
                              </p>
                              <p className="text-xs text-muted-foreground">ربح متوقع</p>
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-medium">
                                {(order.total_amount || 0).toLocaleString()} د.ع
                              </p>
                              <p className="text-xs text-muted-foreground">إجمالي المبيعات</p>
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
        <div className="flex-shrink-0 pt-4 border-t">
          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={onClose}>
              إغلاق
            </Button>
            <div className="text-sm text-muted-foreground">
              {selectedOrders.length} من {pendingProfitOrders.length} طلب محدد
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PendingProfitsDialog;