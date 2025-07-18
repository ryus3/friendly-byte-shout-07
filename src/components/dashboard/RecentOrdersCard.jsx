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
        className: 'bg-[hsl(var(--status-pending)_/_0.2)] text-[hsl(var(--status-pending))] border-[hsl(var(--status-pending)_/_0.3)] shadow-sm backdrop-blur-sm'
      },
      'processing': { 
        label: 'قيد المعالجة', 
        icon: Package,
        className: 'bg-[hsl(var(--status-processing)_/_0.2)] text-[hsl(var(--status-processing))] border-[hsl(var(--status-processing)_/_0.3)] shadow-sm backdrop-blur-sm'
      },
      'shipped': { 
        label: 'تم الشحن', 
        icon: Truck,
        className: 'bg-[hsl(var(--status-shipped)_/_0.2)] text-[hsl(var(--status-shipped))] border-[hsl(var(--status-shipped)_/_0.3)] shadow-sm backdrop-blur-sm'
      },
      'delivery': { 
        label: 'قيد التوصيل', 
        icon: Truck,
        className: 'bg-[hsl(var(--status-delivery)_/_0.2)] text-[hsl(var(--status-delivery))] border-[hsl(var(--status-delivery)_/_0.3)] shadow-sm backdrop-blur-sm'
      },
      'delivered': { 
        label: 'تم التوصيل', 
        icon: Package,
        className: 'bg-[hsl(var(--status-delivered)_/_0.2)] text-[hsl(var(--status-delivered))] border-[hsl(var(--status-delivered)_/_0.3)] shadow-sm backdrop-blur-sm'
      },
      'returned': { 
        label: 'راجع', 
        icon: Package,
        className: 'bg-[hsl(var(--status-returned)_/_0.2)] text-[hsl(var(--status-returned))] border-[hsl(var(--status-returned)_/_0.3)] shadow-sm backdrop-blur-sm'
      },
      'cancelled': { 
        label: 'ملغي', 
        icon: Package,
        className: 'bg-[hsl(var(--status-cancelled)_/_0.2)] text-[hsl(var(--status-cancelled))] border-[hsl(var(--status-cancelled)_/_0.3)] shadow-sm backdrop-blur-sm'
      },
      'return_received': { 
        label: 'تم الإرجاع للمخزن', 
        icon: Package,
        className: 'bg-[hsl(var(--status-warehouse-return)_/_0.2)] text-[hsl(var(--status-warehouse-return))] border-[hsl(var(--status-warehouse-return)_/_0.3)] shadow-sm backdrop-blur-sm'
      },
      'returned_in_stock': { 
        label: 'تم الإرجاع للمخزن', 
        icon: Package,
        className: 'bg-[hsl(var(--status-warehouse-return)_/_0.2)] text-[hsl(var(--status-warehouse-return))] border-[hsl(var(--status-warehouse-return)_/_0.3)] shadow-sm backdrop-blur-sm'
      }
    };
    const statusInfo = statusMap[status] || { 
      label: 'تم الإرجاع للمخزن', 
      icon: Package,
      className: 'bg-[hsl(var(--status-warehouse-return)_/_0.2)] text-[hsl(var(--status-warehouse-return))] border-[hsl(var(--status-warehouse-return)_/_0.3)] shadow-sm backdrop-blur-sm'
    };
    const StatusIcon = statusInfo.icon;
    return (
      <Badge className={cn("text-xs px-2 py-1 flex items-center gap-1.5 font-medium", statusInfo.className)}>
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
                        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium transition-all ${
                          order.delivery_partner === 'محلي' || !order.delivery_partner 
                            ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200' 
                            : 'bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 border-blue-200'
                        }`}>
                          {order.delivery_partner === 'محلي' || !order.delivery_partner ? (
                            <>
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                              <span>محلي</span>
                            </>
                          ) : (
                            <>
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                              <span>{order.delivery_partner.length > 8 ? order.delivery_partner.substring(0, 8) + '...' : order.delivery_partner}</span>
                            </>
                          )}
                        </div>
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