import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Package, 
  DollarSign, 
  Calendar, 
  User, 
  Phone, 
  MapPin,
  CheckCircle,
  Eye,
  ExternalLink
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAlWaseetInvoices } from '@/hooks/useAlWaseetInvoices';

const AlWaseetInvoiceDetailsDialog = ({ 
  isOpen, 
  onClose, 
  invoice,
  onReceiveInvoice 
}) => {
  const { 
    invoiceOrders, 
    loading, 
    fetchInvoiceOrders,
    linkInvoiceWithLocalOrders 
  } = useAlWaseetInvoices();
  
  const [linkedOrders, setLinkedOrders] = useState([]);
  const [loadingLinked, setLoadingLinked] = useState(false);

  useEffect(() => {
    if (isOpen && invoice?.id) {
      fetchInvoiceOrders(invoice.id);
      loadLinkedOrders();
    }
  }, [isOpen, invoice?.id, fetchInvoiceOrders]);

  const loadLinkedOrders = async () => {
    if (!invoice?.id) return;
    
    setLoadingLinked(true);
    try {
      const linked = await linkInvoiceWithLocalOrders(invoice.id);
      setLinkedOrders(linked);
    } catch (error) {
      console.error('Error loading linked orders:', error);
    } finally {
      setLoadingLinked(false);
    }
  };

  if (!invoice) return null;

  const isReceived = invoice.status === 'تم الاستلام من قبل التاجر';
  const amount = parseFloat(invoice.merchant_price) || 0;
  const ordersCount = parseInt(invoice.delivered_orders_count) || 0;

  const handleReceive = async () => {
    const success = await onReceiveInvoice(invoice.id);
    if (success) {
      // Update local state
      invoice.status = 'تم الاستلام من قبل التاجر';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            تفاصيل فاتورة شركة التوصيل #{invoice.id}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="space-y-6">
            {/* Invoice Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  معلومات الفاتورة
                  <Badge variant={isReceived ? 'success' : 'secondary'}>
                    {isReceived ? 'مُستلمة' : 'معلقة'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">إجمالي المبلغ</p>
                      <p className="font-semibold">{amount.toLocaleString()} د.ع</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">عدد الطلبات</p>
                      <p className="font-semibold">{ordersCount}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">آخر تحديث</p>
                      <p className="font-semibold text-sm">
                        {invoice.updated_at && format(
                          new Date(invoice.updated_at), 
                          'dd/MM/yyyy HH:mm'
                        )}
                      </p>
                    </div>
                  </div>

                  <div>
                    {!isReceived && (
                      <Button 
                        onClick={handleReceive}
                        className="w-full"
                        disabled={loading}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        تأكيد الاستلام
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Al-Waseet Orders */}
            <Card>
              <CardHeader>
                <CardTitle>طلبات شركة التوصيل في هذه الفاتورة</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
                    ))}
                  </div>
                ) : invoiceOrders.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    لا توجد طلبات في هذه الفاتورة
                  </p>
                ) : (
                  <div className="space-y-3">
                    {invoiceOrders.map((order) => (
                      <WaseetOrderCard key={order.id} order={order} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Linked Local Orders */}
            <Card>
              <CardHeader>
                <CardTitle>الطلبات المحلية المرتبطة</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingLinked ? (
                  <div className="space-y-2">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
                    ))}
                  </div>
                ) : linkedOrders.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    لا توجد طلبات محلية مرتبطة بهذه الفاتورة
                  </p>
                ) : (
                  <div className="space-y-3">
                    {linkedOrders.map((order) => (
                      <LocalOrderCard key={order.id} order={order} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

const WaseetOrderCard = ({ order }) => {
  const amount = parseFloat(order.price) || 0;
  const deliveryFee = parseFloat(order.delivery_price) || 0;

  return (
    <Card className="bg-muted/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline">#{order.id}</Badge>
              <span className="font-medium">{order.client_name}</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {order.client_mobile}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {order.city_name}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="font-semibold">{amount.toLocaleString()} د.ع</p>
            <p className="text-sm text-muted-foreground">
              شحن: {deliveryFee.toLocaleString()} د.ع
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const LocalOrderCard = ({ order }) => {
  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="default">#{order.order_number}</Badge>
              <span className="font-medium">{order.customer_name}</span>
              <ExternalLink className="h-3 w-3 text-primary" />
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{order.customer_phone}</span>
              <span>الحالة: {order.status}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="font-semibold">{order.final_amount?.toLocaleString()} د.ع</p>
            <p className="text-sm text-muted-foreground">
              محلي: {order.tracking_number}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AlWaseetInvoiceDetailsDialog;