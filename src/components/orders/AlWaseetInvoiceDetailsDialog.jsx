import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  Package, 
  DollarSign, 
  Phone, 
  MapPin,
  ExternalLink,
  Database,
  Wifi,
  Building,
  TrendingUp,
} from 'lucide-react';
import { useAlWaseetInvoices } from '@/hooks/useAlWaseetInvoices';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import InvoiceProfitsTab from './InvoiceProfitsTab';

const AlWaseetInvoiceDetailsDialog = ({ 
  isOpen, 
  onClose, 
  invoice
}) => {
  const { 
    invoiceOrders, 
    loading, 
    fetchInvoiceOrders,
    linkInvoiceWithLocalOrders,
  } = useAlWaseetInvoices();
  
  const [linkedOrders, setLinkedOrders] = useState([]);
  const [loadingLinked, setLoadingLinked] = useState(false);
  const [dataSource, setDataSource] = useState('database');
  const [fetchNotice, setFetchNotice] = useState(null);

  const isReceived = !!invoice && (
    invoice.received === true ||
    invoice.received_flag === true ||
    invoice.status === 'تم الاستلام من قبل التاجر' ||
    invoice.status_normalized?.toLowerCase() === 'received'
  );

  useEffect(() => {
    if (isOpen && invoice) {
      const invoiceId = invoice.external_id || invoice.id;
      
      if (invoiceId) {
        setFetchNotice(null);
        // ✅ نعتمد على قاعدة البيانات حصراً عند فتح الفاتورة (cache-only).
        //   لا نستدعي API شركة التوصيل من واجهة الفتح، ولا نُظهر "فشل جلب".
        //   الـ self-heal الخلفي يكفي لتعبئة النواقص.
        fetchInvoiceOrders(invoiceId, { preferCache: true }).then(result => {
          if (result?.dataSource) {
            setDataSource(result.dataSource);
          }
        }).catch(() => {/* صامت — لا نُظهر رسائل خطأ */});
        loadLinkedOrders();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, invoice?.id, invoice?.external_id, isReceived]);

  const loadLinkedOrders = async () => {
    const invoiceId = invoice?.external_id || invoice?.id;
    if (!invoiceId) return;
    
    setLoadingLinked(true);
    try {
      const linked = await linkInvoiceWithLocalOrders(invoiceId);
      setLinkedOrders(linked);
    } catch (error) {
      console.error('Error loading linked orders:', error);
    } finally {
      setLoadingLinked(false);
    }
  };

  if (!invoice) return null;

  const amount = parseFloat(invoice.amount || invoice.merchant_price) || 0;
  const ordersCount = parseInt(invoice.linked_orders_count || invoice.orders_count || invoice.delivered_orders_count) || 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] sm:w-full h-[90vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader dir="rtl" className="p-4 sm:p-6 pb-2 flex-shrink-0 border-b">
          <DialogTitle className="flex items-center justify-end gap-2 text-right">
            تفاصيل فاتورة شركة التوصيل #{invoice.external_id || invoice.id}
            <Package className="h-5 w-5" />
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" dir="rtl" className="flex-1 min-h-0 flex flex-col">
          <div className="px-4 sm:px-6 pt-3 flex-shrink-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details" className="gap-2">
                <Package className="w-4 h-4" />
                تفاصيل الفاتورة
              </TabsTrigger>
              <TabsTrigger value="profits" className="gap-2">
                <TrendingUp className="w-4 h-4" />
                الأرباح والمستحقات
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="details"
            className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 mt-0"
          >
            <div className="space-y-6">
              {/* Invoice Summary */}
              <Card>
                <CardHeader dir="rtl">
                  <CardTitle className="flex flex-col items-end gap-2">
                    <div className="flex items-center justify-between w-full">
                      <Badge variant={isReceived ? 'success' : 'secondary'}>
                        {isReceived ? 'مُستلمة' : 'معلقة'}
                      </Badge>
                      <span className="text-right">معلومات الفاتورة</span>
                    </div>
                    {(invoice.account_username || invoice.partner_name_ar) && (
                      <div className="flex items-center gap-2 w-full justify-end">
                        <span className="text-sm font-medium text-primary">
                          {invoice.partner_name_ar || 'الوسيط'} - {invoice.account_username || 'حساب رئيسي'}
                        </span>
                        <Building className="h-4 w-4 text-primary" />
                      </div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent dir="rtl">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center justify-end gap-2">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">إجمالي المبلغ</p>
                        <p className="font-semibold">{amount.toLocaleString()} د.ع</p>
                      </div>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">عدد الطلبات</p>
                        <p className="font-semibold">{invoiceOrders.length || ordersCount}</p>
                      </div>
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">مصدر البيانات</p>
                        <Badge variant="secondary" className="text-xs">
                          {dataSource === 'api' && !isReceived ? 'مباشر' : 'محفوظ'}
                        </Badge>
                      </div>
                      <Database className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Linked Local Orders */}
              <Card dir="rtl">
                <CardHeader>
                  <CardTitle className="text-right">الطلبات المحلية المرتبطة</CardTitle>
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

              {/* Al-Waseet Orders */}
              <Card dir="rtl">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-right">
                    <Badge variant="secondary" className="gap-1">
                      {isReceived || dataSource !== 'api' ? (
                        <>
                          <Database className="h-3 w-3" />
                          من قاعدة البيانات
                        </>
                      ) : (
                        <>
                          <Wifi className="h-3 w-3" />
                          مباشر من الوسيط
                        </>
                      )}
                    </Badge>
                    <span>طلبات شركة التوصيل في هذه الفاتورة</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
                      ))}
                    </div>
                  ) : invoiceOrders.length === 0 ? (
                    <div className="text-center py-4 space-y-1">
                      <p className="text-muted-foreground">
                        {fetchNotice || 'لا توجد طلبات في هذه الفاتورة'}
                      </p>
                      {fetchNotice && (
                        <p className="text-xs text-muted-foreground/70">
                          عدد الطلبات المتوقع: {ordersCount}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {invoiceOrders.map((order) => (
                        <WaseetOrderCard key={order.id} order={order} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent
            value="profits"
            className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 mt-0"
          >
            <InvoiceProfitsTab invoice={invoice} linkedOrders={linkedOrders} />
          </TabsContent>
        </Tabs>
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
            {(order.account_username || order.partner_name_ar) && (
              <div className="flex items-center gap-1 text-sm">
                <Building className="h-3 w-3 text-primary" />
                <span className="font-medium text-primary">
                  {order.account_username || 'حساب رئيسي'}
                </span>
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="font-semibold">{(order.final_amount || 0).toLocaleString()} د.ع</p>
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
