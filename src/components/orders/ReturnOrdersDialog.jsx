import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { Loader2, RotateCcw, AlertCircle, Package, TrendingDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

export const ReturnOrdersDialog = ({ open, onOpenChange }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [returnOrders, setReturnOrders] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      fetchReturnOrders();
    }
  }, [open, currentUser]);

  const fetchReturnOrders = async () => {
    if (!currentUser?.id) return;

    setLoading(true);
    setError(null);

    try {
      // جلب طلبات الإرجاع مع معلومات الطلب الأصلي
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(*),
          ai_orders!inner(original_order_id),
          original_order:ai_orders(
            original_order_id,
            order:orders!ai_orders_original_order_id_fkey(
              order_number,
              total_amount,
              created_at
            )
          )
        `)
        .eq('order_type', 'return')
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;

      setReturnOrders(data || []);
    } catch (err) {
      console.error('خطأ في جلب طلبات الإرجاع:', err);
      setError('فشل تحميل طلبات الإرجاع');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status, deliveryStatus) => {
    if (deliveryStatus === '17' || deliveryStatus === 'تم الإرجاع للمخزن') {
      return (
        <Badge className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          تم الإرجاع للمخزن
        </Badge>
      );
    }
    if (deliveryStatus === '21' || deliveryStatus === 'تم الإرجاع للزبون') {
      return (
        <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white">
          تم الإرجاع للزبون
        </Badge>
      );
    }
    if (status === 'pending') {
      return <Badge variant="secondary">قيد الانتظار</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-r from-red-500 to-red-600 rounded-lg">
              <RotateCcw className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">طلبات الإرجاع</DialogTitle>
              <DialogDescription>
                عرض جميع طلبات الإرجاع والمعلومات المالية
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">جارٍ تحميل طلبات الإرجاع...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : returnOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Package className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">لا توجد طلبات إرجاع</p>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {returnOrders.map((order) => {
                const originalOrderInfo = order.original_order?.[0]?.order;
                const refundAmount = Math.abs(order.refund_amount || 0);

                return (
                  <Card key={order.id} className="overflow-hidden border-l-4 border-l-red-500">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <TrendingDown className="h-5 w-5 text-red-500" />
                          <div>
                            <h3 className="font-bold text-lg">
                              #{order.order_number}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {order.created_at &&
                                format(parseISO(order.created_at), 'd/M/yyyy h:mm a', {
                                  locale: ar,
                                })}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(order.status, order.delivery_status)}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        {/* معلومات الزبون */}
                        <div className="space-y-2">
                          <p className="font-medium text-muted-foreground">معلومات الزبون:</p>
                          <p className="font-semibold">{order.customer_name}</p>
                          <p className="text-muted-foreground">{order.customer_phone}</p>
                          <p className="text-muted-foreground">
                            {order.customer_city} - {order.customer_province}
                          </p>
                        </div>

                        {/* المعلومات المالية */}
                        <div className="space-y-2">
                          <p className="font-medium text-muted-foreground">المعلومات المالية:</p>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white font-bold animate-pulse">
                              مبلغ الإرجاع: -{refundAmount.toLocaleString()} د.ع
                            </Badge>
                          </div>
                          {order.delivery_fee > 0 && (
                            <p className="text-xs text-muted-foreground">
                              رسوم التوصيل: {order.delivery_fee.toLocaleString()} د.ع
                            </p>
                          )}
                        </div>

                        {/* الطلب الأصلي */}
                        {originalOrderInfo && (
                          <div className="space-y-2 sm:col-span-2 p-3 bg-muted/50 rounded-lg">
                            <p className="font-medium text-muted-foreground">الطلب الأصلي:</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">
                                #{originalOrderInfo.order_number}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                المبلغ: {originalOrderInfo.total_amount?.toLocaleString()} د.ع
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {originalOrderInfo.created_at &&
                                  format(parseISO(originalOrderInfo.created_at), 'd/M/yyyy', {
                                    locale: ar,
                                  })}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* المنتجات */}
                        {order.order_items?.length > 0 && (
                          <div className="space-y-2 sm:col-span-2">
                            <p className="font-medium text-muted-foreground">المنتجات المرجعة:</p>
                            <div className="space-y-1">
                              {order.order_items.map((item, idx) => (
                                <p key={idx} className="text-xs text-muted-foreground">
                                  • {item.product_name || 'منتج'} (الكمية: {item.quantity})
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* الملاحظات */}
                        {order.notes && (
                          <div className="space-y-2 sm:col-span-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                            <p className="font-medium text-amber-800 dark:text-amber-200">
                              ملاحظات:
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-300 whitespace-pre-wrap">
                              {order.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
