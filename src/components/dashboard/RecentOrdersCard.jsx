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
        className: 'bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 border-amber-200 shadow-sm'
      },
      'processing': { 
        label: 'قيد التسليم', 
        icon: Package,
        className: 'bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 border-blue-200 shadow-sm'
      },
      'shipped': { 
        label: 'تم الشحن', 
        icon: Truck,
        className: 'bg-gradient-to-r from-purple-50 to-violet-50 text-purple-700 border-purple-200 shadow-sm'
      },
      'delivered': { 
        label: 'تم التوصيل', 
        icon: Package,
        className: 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200 shadow-sm'
      },
      'returned': { 
        label: 'راجع', 
        icon: Package,
        className: 'bg-gradient-to-r from-orange-50 to-red-50 text-orange-700 border-orange-200 shadow-sm'
      },
      'cancelled': { 
        label: 'ملغي', 
        icon: Package,
        className: 'bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border-red-200 shadow-sm'
      }
    };
    const statusInfo = statusMap[status] || { 
      label: status, 
      icon: Package,
      className: 'bg-gradient-to-r from-gray-50 to-slate-50 text-gray-700 border-gray-200 shadow-sm'
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

  const getOrderNumberIcon = (number) => {
    const iconMap = {
      1: '①', 2: '②', 3: '③', 4: '④', 5: '⑤',
      6: '⑥', 7: '⑦', 8: '⑧', 9: '⑨', 10: '⑩'
    };
    return iconMap[number] || `${number}`;
  };

  const getOrderProducts = (items) => {
    if (!items || items.length === 0) return 'لا توجد منتجات';
    if (items.length === 1) return items[0].name || 'منتج';
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
          <div className="space-y-0 flex-1 overflow-y-auto">
            {recentOrders && recentOrders.length > 0 ? recentOrders.map((order, index) => (
              <motion.div 
                key={order.id} 
                className={cn(
                  "relative p-3 border-b border-border/20 hover:bg-accent/50 transition-all cursor-pointer group",
                  "hover:shadow-sm hover:border-l-2 hover:border-l-primary"
                )}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleViewOrder(order)}
              >
                {/* Compact Order Card */}
                <div className="flex items-center gap-3">
                  {/* Order Number Icon */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-primary/30">
                    <span className="text-primary font-bold text-sm">
                      {getOrderNumberIcon(getOrderNumber(index))}
                    </span>
                  </div>

                  {/* Order Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground">{formatDate(order.created_at)}</span>
                      {getStatusBadge(order.status)}
                    </div>
                    
                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-medium text-foreground truncate max-w-[120px]">
                          {order.customerinfo?.province || 'غير محدد'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {getDeliveryType(order) === 'شركة توصيل' ? (
                          <>
                            <Truck className="w-3 h-3 text-blue-500" />
                            <span className="text-xs text-blue-600">شركة</span>
                          </>
                        ) : (
                          <>
                            <Home className="w-3 h-3 text-green-500" />
                            <span className="text-xs text-green-600">محلي</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">
                        {order.created_by_name || 'النظام'}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-sm text-foreground">
                          {(order.total || 0).toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">د.ع</span>
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