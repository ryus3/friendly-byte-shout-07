import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSuper } from '@/contexts/SuperProvider';
import {
  Package,
  User,
  MapPin,
  Calendar,
  Receipt,
  Truck,
  Phone,
  CreditCard,
  Tag,
  CheckCircle,
  Clock,
  DollarSign,
  Hash,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import OrderStatusHistory from './OrderStatusHistory';

const OrderDetailsModal = ({ order, isOpen, onClose, formatCurrency, employee }) => {
  const { orderItems, products } = useSuper();

  const orderProducts = useMemo(() => {
    if (!order?.order_items) return [];
    
    return order.order_items.map(item => {
      // الحصول على بيانات المنتج والمتغير
      const productData = item.products || {};
      const variantData = item.product_variants || {};
      
      // بناء تفاصيل المتغير
      const variantDetails = [];
      if (variantData.colors?.name) variantDetails.push(variantData.colors.name);
      if (variantData.sizes?.name) variantDetails.push(variantData.sizes.name);
      
      // إضافة تفاصيل إضافية للمتغير
      const variant = variantDetails.length > 0 
        ? variantDetails.join(' - ') 
        : (item.color || '') + (item.size ? (item.color ? ' - ' : '') + item.size : '');
      
      return {
        productName: productData.name || item.product_name || item.productName || 'منتج غير محدد',
        variant: variant || '',
        quantity: item.quantity || 0,
        price: item.total_price || item.total || item.price || (item.unit_price || 0)
      };
    });
  }, [order]);

  if (!order) return null;

  const getStatusInfo = (order) => {
    if (order.status === 'completed') {
      return {
        badge: <Badge className="bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0"><CheckCircle className="w-3 h-3 mr-1" />مكتمل</Badge>,
        color: 'text-emerald-600'
      };
    }
    if (order.status === 'delivered') {
      return {
        badge: <Badge className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0"><Package className="w-3 h-3 mr-1" />مُسلم</Badge>,
        color: 'text-blue-600'
      };
    }
    return {
      badge: <Badge variant="outline">{order.status}</Badge>,
      color: 'text-gray-600'
    };
  };

  const getReceiptInfo = (received) => {
    if (received) {
      return <Badge className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white border-0"><Receipt className="w-3 h-3 mr-1" />مستلمة</Badge>;
    }
    return <Badge className="bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0"><Clock className="w-3 h-3 mr-1" />في الانتظار</Badge>;
  };

  const statusInfo = getStatusInfo(order);
  const primaryId = order.tracking_number || order.delivery_partner_order_id || order.order_number;
  const hasTrackingNumber = order.tracking_number || order.delivery_partner_order_id;

  const calculateTotal = () => {
    return orderProducts.reduce((sum, item) => {
      const itemTotal = (item.price || 0) * (item.quantity || 0);
      return sum + itemTotal;
    }, 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-background text-foreground border-border">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="flex items-center gap-3 text-xl text-foreground">
              <span>تفاصيل الطلب {order.tracking_number || order.delivery_partner_order_id ? `#${order.tracking_number || order.delivery_partner_order_id}` : `#${order.order_number}`}</span>
            </DialogTitle>
            <div className="flex items-center gap-2 mt-2">
              {statusInfo.badge}
              {getReceiptInfo(order.receipt_received)}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="space-y-6 p-1">

            {/* Customer Information */}
            <Card className="bg-card text-foreground border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <User className="w-5 h-5 text-blue-600" />
                  معلومات العميل
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg">
                      <User className="w-4 h-4 text-blue-600" />
                      <div>
                        <div className="font-medium text-foreground">{order.customer_name || 'عميل غير محدد'}</div>
                        <div className="text-sm text-muted-foreground">اسم العميل</div>
                      </div>
                    </div>
                    
                    {order.customer_phone && (
                      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg">
                        <Phone className="w-4 h-4 text-green-600" />
                        <div>
                          <div className="font-medium text-foreground" dir="ltr">{order.customer_phone}</div>
                          <div className="text-sm text-muted-foreground">رقم الهاتف</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {order.customer_city && (
                      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-lg">
                        <MapPin className="w-4 h-4 text-purple-600" />
                        <div>
                          <div className="font-medium text-foreground">{order.customer_city}</div>
                          <div className="text-sm text-muted-foreground">المدينة</div>
                        </div>
                      </div>
                    )}

                    {order.customer_address && (
                      <div className="p-3 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-950/30 dark:to-slate-950/30 rounded-lg">
                        <div className="flex items-start gap-3">
                          <MapPin className="w-4 h-4 text-gray-600 mt-0.5" />
                          <div>
                            <div className="font-medium text-sm text-foreground">{order.customer_address}</div>
                            <div className="text-xs text-muted-foreground">العنوان التفصيلي</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Products Details */}
            {orderProducts && orderProducts.length > 0 && (
              <Card className="bg-card text-foreground border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Package className="w-5 h-5 text-green-600" />
                    تفاصيل المنتجات ({orderProducts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                     {orderProducts.map((item, index) => (
                       <div key={index} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                         <div className="flex-1">
                           <h4 className="font-medium text-foreground">
                             {item.productName || 'منتج غير معروف'}
                           </h4>
                           {item.variant && (
                             <p className="text-sm text-muted-foreground">
                               {item.variant}
                             </p>
                           )}
                         </div>
                          <div className="text-right">
                            <div className="font-medium text-foreground" dir="ltr">
                              الكمية: {item.quantity.toLocaleString('en-US')}
                            </div>
                             <div className="text-sm text-muted-foreground" dir="ltr">
                               سعر الوحدة: {formatCurrency(item.price || 0).replace(/[٠-٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])}
                             </div>
                             <div className="text-xs text-muted-foreground" dir="ltr">
                               المجموع: {formatCurrency((item.price || 0) * (item.quantity || 0)).replace(/[٠-٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])}
                             </div>
                          </div>
                       </div>
                     ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Order Information */}
            <Card className="bg-card text-foreground border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Receipt className="w-5 h-5 text-purple-600" />
                  معلومات الطلب
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg">
                      <span className="text-sm font-medium text-foreground">رقم الطلب</span>
                      <span className="font-bold text-foreground">#{order.order_number}</span>
                    </div>
                    
                    {hasTrackingNumber && (
                      <div className="flex justify-between items-center p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg">
                        <span className="text-sm font-medium text-foreground">رقم التتبع</span>
                        <span className="font-bold text-foreground" dir="ltr">{order.tracking_number || order.delivery_partner_order_id}</span>
                      </div>
                    )}

                     <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-lg">
                       <span className="text-sm font-medium text-foreground">تاريخ الطلب</span>
                       <span className="font-bold text-foreground">
                         {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm')}
                       </span>
                     </div>
                  </div>

                  <div className="space-y-3">
                    {order.delivery_partner && (
                      <div className="flex justify-between items-center p-3 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 rounded-lg">
                        <span className="text-sm font-medium text-foreground">شريك التوصيل</span>
                        <span className="text-foreground font-medium">{order.delivery_partner}</span>
                      </div>
                    )}

                    {employee && (
                      <div className="flex justify-between items-center p-3 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30 rounded-lg">
                        <span className="text-sm font-medium text-foreground">الموظف المسؤول</span>
                        <span className="font-bold text-foreground">{employee.full_name || employee.email || 'غير محدد'}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">حالة الفاتورة:</span>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${order.receipt_received ? 'text-green-600' : 'text-amber-600'}`}>
                          {order.receipt_received ? 'مستلمة' : 'قيد الانتظار'}
                        </span>
                        {order.receipt_received && order.delivery_partner_invoice_id && (
                          <span className="text-xs text-muted-foreground">
                            (#{order.delivery_partner_invoice_id})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order Status History - سجل حركات الطلب */}
            <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border-purple-200 dark:border-purple-800">
              <CardContent className="pt-6">
                <OrderStatusHistory orderId={order.id} />
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <Card className="bg-card text-foreground border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                  الملخص المالي
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                   <div className="flex justify-between items-center">
                     <span className="text-muted-foreground">مجموع المنتجات:</span>
                     <span className="text-foreground font-medium" dir="ltr">{formatCurrency(calculateTotal()).replace(/[٠-٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])}</span>
                   </div>

                   <div className="flex justify-between items-center">
                     <span className="text-muted-foreground">رسوم التوصيل:</span>
                     <span className="text-foreground font-medium" dir="ltr">{formatCurrency(order.delivery_fee || 0).replace(/[٠-٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])}</span>
                   </div>

                   <div className="flex justify-between items-center">
                     <span className="text-muted-foreground">المجموع الفرعي:</span>
                     <span className="text-foreground font-medium" dir="ltr">{formatCurrency((calculateTotal() + (order.delivery_fee || 0))).replace(/[٠-٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])}</span>
                   </div>

                   <div className="border-t pt-3">
                     <div className="flex justify-between items-center">
                       <span className="text-lg font-bold text-foreground">الإجمالي النهائي:</span>
                       <span className="text-lg font-bold text-primary" dir="ltr">{formatCurrency(order.final_amount || order.total_amount || 0).replace(/[٠-٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])}</span>
                     </div>
                   </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailsModal;