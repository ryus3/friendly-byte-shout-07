import React from 'react';
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
import {
  Package,
  User,
  MapPin,
  Calendar,
  Receipt,
  Truck,
  Phone,
  Mail,
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

const OrderDetailsModal = ({ order, isOpen, onClose, formatCurrency, employee }) => {
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
    const itemsTotal = order.order_items?.reduce((sum, item) => 
      sum + (item.unit_price * item.quantity), 0) || 0;
    const deliveryFee = order.delivery_fee || 0;
    return itemsTotal + deliveryFee;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-blue-600 flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {hasTrackingNumber ? (
                  <>
                    <Tag className="w-4 h-4 text-primary" />
                    <span>تفاصيل الطلب #{primaryId}</span>
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </>
                ) : (
                  <>
                    <Hash className="w-4 h-4 text-muted-foreground" />
                    <span>تفاصيل الطلب #{order.order_number}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {statusInfo.badge}
                {getReceiptInfo(order.receipt_received)}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="space-y-6 p-1">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-700">
                        {formatCurrency(order.final_amount || order.total_amount || 0)}
                      </div>
                      <div className="text-sm text-blue-600">إجمالي المبلغ</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                      <Package className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-700">
                        {order.order_items?.length || 0}
                      </div>
                      <div className="text-sm text-green-600">منتجات</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-600 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-purple-700">
                        {format(new Date(order.created_at), 'dd MMM', { locale: ar })}
                      </div>
                      <div className="text-sm text-purple-600">تاريخ الطلب</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  معلومات العميل
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                      <User className="w-4 h-4 text-blue-600" />
                      <div>
                        <div className="font-medium">{order.customer_name || 'عميل غير محدد'}</div>
                        <div className="text-sm text-muted-foreground">اسم العميل</div>
                      </div>
                    </div>
                    
                    {order.customer_phone && (
                      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                        <Phone className="w-4 h-4 text-green-600" />
                        <div>
                          <div className="font-medium" dir="ltr">{order.customer_phone}</div>
                          <div className="text-sm text-muted-foreground">رقم الهاتف</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {order.customer_city && (
                      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                        <MapPin className="w-4 h-4 text-purple-600" />
                        <div>
                          <div className="font-medium">{order.customer_city}</div>
                          <div className="text-sm text-muted-foreground">المدينة</div>
                        </div>
                      </div>
                    )}

                    {order.customer_address && (
                      <div className="p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg">
                        <div className="flex items-start gap-3">
                          <MapPin className="w-4 h-4 text-gray-600 mt-0.5" />
                          <div>
                            <div className="font-medium text-sm">{order.customer_address}</div>
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
            {order.order_items && order.order_items.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-green-600" />
                    تفاصيل المنتجات ({order.order_items.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {order.order_items.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-100 to-indigo-100 flex items-center justify-center">
                            <Package className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium">{item.product_name || 'منتج غير محدد'}</div>
                            {item.variant_details && (
                              <div className="text-sm text-muted-foreground">
                                {item.variant_details}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-left space-y-1">
                          <div className="font-bold text-lg">
                            {formatCurrency(item.unit_price * item.quantity)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {item.quantity} × {formatCurrency(item.unit_price)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Order Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-purple-600" />
                  معلومات الطلب
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                      <span className="text-sm font-medium">رقم الطلب</span>
                      <span className="font-bold">#{order.order_number}</span>
                    </div>
                    
                    {hasTrackingNumber && (
                      <div className="flex justify-between items-center p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                        <span className="text-sm font-medium">رقم التتبع</span>
                        <span className="font-bold" dir="ltr">{order.tracking_number || order.delivery_partner_order_id}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                      <span className="text-sm font-medium">تاريخ الطلب</span>
                      <span className="font-bold">
                        {format(new Date(order.created_at), 'dd MMM yyyy HH:mm', { locale: ar })}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {order.delivery_partner && (
                      <div className="flex justify-between items-center p-3 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg">
                        <span className="text-sm font-medium">شركة التوصيل</span>
                        <Badge className="bg-gradient-to-r from-orange-500 to-red-600 text-white">
                          <Truck className="w-3 h-3 mr-1" />
                          {order.delivery_partner}
                        </Badge>
                      </div>
                    )}

                    {employee && (
                      <div className="flex justify-between items-center p-3 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg">
                        <span className="text-sm font-medium">الموظف المسؤول</span>
                        <span className="font-bold">{employee.full_name || employee.email || 'غير محدد'}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg">
                      <span className="text-sm font-medium">حالة الفاتورة</span>
                      {getReceiptInfo(order.receipt_received)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                  الملخص المالي
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {order.order_items && (
                    <div className="flex justify-between items-center p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                      <span className="font-medium">مجموع المنتجات</span>
                      <span className="font-bold">
                        {formatCurrency(order.order_items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0))}
                      </span>
                    </div>
                  )}
                  
                  {order.delivery_fee > 0 && (
                    <div className="flex justify-between items-center p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                      <span className="font-medium">رسوم التوصيل</span>
                      <span className="font-bold">{formatCurrency(order.delivery_fee)}</span>
                    </div>
                  )}

                  <Separator />
                  
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-primary/10 to-blue-600/10 rounded-lg border-2 border-primary/20">
                    <span className="text-lg font-bold">الإجمالي النهائي</span>
                    <span className="text-2xl font-bold text-primary">
                      {formatCurrency(order.final_amount || order.total_amount || 0)}
                    </span>
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