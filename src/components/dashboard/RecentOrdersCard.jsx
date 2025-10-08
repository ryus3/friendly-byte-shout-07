import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart, MapPin, Package, CreditCard, Truck, Home, Calendar, Clock, CheckCircle, XCircle, RotateCcw, PackageCheck } from 'lucide-react';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getStatusForComponent } from '@/lib/order-status-translator';
import ScrollingText from '@/components/ui/scrolling-text';

const RecentOrdersCard = ({ recentOrders }) => {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const navigate = useNavigate();

  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    setIsDetailsOpen(true);
  };
  
  const handleViewAll = () => {
    navigate('/my-orders');
  };

  const getStatusBadge = (order) => {
    const statusConfig = getStatusForComponent(order, 'recentOrders');
    const StatusIcon = statusConfig.icon;
    return (
      <div className={`flex items-center gap-2 ${statusConfig.color} hover:scale-105 transition-transform duration-300`}>
        <StatusIcon className="w-3 h-3 flex-shrink-0" />
        <ScrollingText text={statusConfig.label} className="font-bold min-w-0 flex-1" />
      </div>
    );
  };

  const getDeliveryType = (order) => {
    // تحديد نوع التوصيل بناءً على بيانات الطلب الفعلية
    const deliveryPartner = order.delivery_partner;
    
    // إذا كان delivery_partner موجود وليس "محلي"، فهو شركة توصيل
    if (deliveryPartner && deliveryPartner !== 'محلي') {
      return deliveryPartner; // عرض اسم شركة التوصيل الفعلي
    }
    
    // وإلا فهو توصيل محلي
    return 'محلي';
  };

  const getOrderNumber = (index) => {
    return index + 1;
  };

  const getOrderIcon = (number) => {
    const icons = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
    return icons[number - 1] || `${number}`;
  };

  const getOrderId = (order) => {
    return order.order_number || String(order.id || 0).padStart(4, '0');
  };

  const getOrderProducts = (order) => {
    const items = order.order_items || [];
    if (!items || items.length === 0) return 'لا توجد منتجات';
    if (items.length === 1) {
      const item = items[0];
      return item.products?.name || item.productName || 'منتج';
    }
    return `${items.length} منتجات متنوعة`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'منذ قليل';
    if (diffInHours < 24) return `منذ ${diffInHours} ساعة`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'منذ يوم واحد';
    if (diffInDays < 7) return `منذ ${diffInDays} أيام`;
    // تاريخ ميلادي بدلاً من هجري
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  return (
    <>
      <Card className="glass-effect h-full border-border/60 flex flex-col overflow-hidden">
        <CardHeader className="bg-gradient-to-l from-primary/5 to-accent/5 border-b border-border/50">
          <CardTitle className="flex items-center gap-3 text-xl text-foreground">
            <div className="p-2 rounded-lg bg-primary/10">
              <ShoppingCart className="w-6 h-6 text-primary" />
            </div>
            الطلبات الأخيرة
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0">
          <div className="space-y-0 flex-1">
            {recentOrders && recentOrders.length > 0 ? recentOrders.slice(0, 3).map((order, index) => (
              <motion.div 
                key={order.id} 
                className={cn(
                  "relative p-3 border-b border-border/20 cursor-pointer group transition-all duration-300",
                  "hover:bg-gradient-to-r hover:from-primary/5 hover:to-accent/5",
                  "hover:shadow-lg hover:shadow-primary/10 hover:border-l-4 hover:border-l-primary",
                  "hover:scale-[1.01] hover:-translate-y-0.5"
                )}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleViewOrder(order)}
              >
                {/* Compact Order Card */}
                <div className="flex items-center gap-3">
                  {/* Order Number Icon */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-primary/30">
                    <span className="text-primary font-bold text-lg">
                      {getOrderIcon(getOrderNumber(index))}
                    </span>
                  </div>

                  {/* Order Info */}
                  <div className="flex-1 min-w-0">
                    {/* Header Row with Date and Status */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-primary">#{getOrderId(order)}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(order.created_at)}</span>
                      </div>
                      {getStatusBadge(order)}
                    </div>
                    
                    {/* Location and Delivery Info */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground truncate max-w-[120px]">
                          {order.customer_city}
                          {order.customer_province && ` - ${order.customer_province}`}
                        </span>
                      </div>
                      
                      <div className="h-3 w-px bg-border/50" />
                      
                      <div className="flex items-center gap-1.5">
                        {getDeliveryType(order) === 'محلي' ? (
                          <>
                            <Home className="w-3 h-3 text-green-500" />
                            <span className="text-xs text-green-600 font-medium">محلي</span>
                          </>
                        ) : (
                          <>
                            <Truck className="w-3 h-3 text-blue-500" />
                            <span className="text-xs text-blue-600 font-medium">{getDeliveryType(order)}</span>
                          </>
                        )}
                      </div>
                      
                      <div className="h-3 w-px bg-border/50" />
                      
                      <div className="flex items-center gap-1">
                        <Package className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                          {getOrderProducts(order)}
                        </span>
                      </div>
                    </div>

                    {/* Total Amount */}
                    <div className="flex items-center justify-end">
                      <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-md">
                        <span className="font-bold text-sm text-primary">
                          {(
                            (order.sales_amount != null)
                              ? (Number(order.sales_amount) || 0)
                              : (Number(order.final_amount || order.total_amount || 0) - Number(order.delivery_fee || 0))
                          ).toLocaleString()}
                        </span>
                        <span className="text-xs text-primary/70">د.ع</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hover Effect Indicator */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r opacity-0 group-hover:opacity-100 transition-all duration-300" />
              </motion.div>
            )) : (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm font-medium">لا توجد طلبات حديثة</p>
                <p className="text-xs">ستظهر الطلبات الجديدة هنا</p>
              </div>
            )}
          </div>
          {recentOrders && recentOrders.length > 0 && (
            <div className="p-4 border-t border-border/50 bg-muted/20">
              <Button 
                variant="outline" 
                className="w-full text-primary border-primary/20 hover:bg-primary/10 hover:border-primary/40 transition-all" 
                onClick={handleViewAll}
              >
                <ShoppingCart className="w-4 h-4 ml-2" />
                عرض جميع الطلبات
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <OrderDetailsDialog order={selectedOrder} open={isDetailsOpen} onOpenChange={setIsDetailsOpen} />
    </>
  );
};

export default RecentOrdersCard;