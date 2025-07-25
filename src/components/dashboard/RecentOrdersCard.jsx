import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, MapPin, Package, CreditCard, Truck, Home, Calendar, Clock } from 'lucide-react';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

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

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': { 
        label: 'قيد التجهيز', 
        icon: Clock,
        className: 'bg-status-pending-bg text-status-pending shadow-lg shadow-status-pending/30 border-2 border-status-pending/20 font-semibold'
      },
      'shipped': { 
        label: 'تم الشحن', 
        icon: Truck,
        className: 'bg-status-shipped-bg text-status-shipped shadow-lg shadow-status-shipped/30 border-2 border-status-shipped/20 font-semibold'
      },
      'delivery': { 
        label: 'قيد التوصيل', 
        icon: Truck,
        className: 'bg-status-delivery-bg text-status-delivery shadow-lg shadow-status-delivery/30 border-2 border-status-delivery/20 font-semibold'
      },
      'delivered': { 
        label: 'تم التسليم', 
        icon: Package,
        className: 'bg-status-delivered-bg text-status-delivered shadow-lg shadow-status-delivered/30 border-2 border-status-delivered/20 font-semibold'
      },
      'completed': { 
        label: 'مكتمل', 
        icon: Package,
        className: 'bg-status-completed-bg text-status-completed shadow-lg shadow-status-completed/30 border-2 border-status-completed/20 font-semibold'
      },
      'returned': { 
        label: 'راجعة', 
        icon: Package,
        className: 'bg-status-returned-bg text-status-returned shadow-lg shadow-status-returned/30 border-2 border-status-returned/20 font-semibold'
      },
      'returned_in_stock': { 
        label: 'راجع للمخزن', 
        icon: Package,
        className: 'bg-status-returned-stock-bg text-status-returned-stock shadow-lg shadow-status-returned-stock/30 border-2 border-status-returned-stock/20 font-semibold'
      },
      'cancelled': { 
        label: 'ملغي', 
        icon: Package,
        className: 'bg-status-cancelled-bg text-status-cancelled shadow-lg shadow-status-cancelled/30 border-2 border-status-cancelled/20 font-semibold'
      },
      // معالجة الحالات القديمة
      'return_received': { 
        label: 'راجع للمخزن', 
        icon: Package,
        className: 'bg-status-returned-stock-bg text-status-returned-stock shadow-lg shadow-status-returned-stock/30 border-2 border-status-returned-stock/20 font-semibold'
      }
    };
    const statusInfo = statusMap[status] || { 
      label: status, 
      icon: Package,
      className: 'bg-muted text-muted-foreground border-2 border-border shadow-sm font-medium'
    };
    const StatusIcon = statusInfo.icon;
    return (
      <Badge className={cn("text-xs px-3 py-2 flex items-center gap-2 rounded-lg backdrop-blur-sm", statusInfo.className)}>
        <StatusIcon className="w-3 h-3" />
        {statusInfo.label}
      </Badge>
    );
  };

  const getDeliveryType = (order) => {
    // تحديد نوع التوصيل بناءً على بيانات الطلب
    const isDeliveryCompany = order.customerinfo?.delivery_company || order.delivery_partner;
    return isDeliveryCompany ? 'شركة توصيل' : 'محلي';
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
    return date.toLocaleDateString('ar-SA');
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
                      {getStatusBadge(order.status)}
                    </div>
                    
                    {/* Location and Delivery Info */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground truncate max-w-[100px]">
                          {order.customer_city || order.customer_province || 'غير محدد'}
                        </span>
                      </div>
                      
                      <div className="h-3 w-px bg-border/50" />
                      
                      <div className="flex items-center gap-1.5">
                        {getDeliveryType(order) === 'شركة توصيل' ? (
                          <>
                            <Truck className="w-3 h-3 text-blue-500" />
                            <span className="text-xs text-blue-600 font-medium">شركة</span>
                          </>
                        ) : (
                          <>
                            <Home className="w-3 h-3 text-green-500" />
                            <span className="text-xs text-green-600 font-medium">محلي</span>
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
                          {(order.final_amount || order.total_amount || 0).toLocaleString()}
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