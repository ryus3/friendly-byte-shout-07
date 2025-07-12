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

  const getOrderId = (order) => {
    return String(order.id).slice(-3).padStart(3, '0');
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
                  "relative p-4 border-b border-border/30 hover:bg-muted/30 transition-all cursor-pointer group",
                  "hover:shadow-md hover:border-l-4 hover:border-l-primary/50"
                )}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleViewOrder(order)}
              >
                {/* Header Row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-primary">#{getOrderId(order)}</span>
                      <div className="h-4 w-px bg-border/50" />
                      <span className="text-xs text-muted-foreground">{formatDate(order.created_at)}</span>
                    </div>
                  </div>
                  {getStatusBadge(order.status)}
                </div>

                {/* Customer & Location */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">
                      {order.customerinfo?.address || 'عنوان غير محدد'}
                    </span>
                  </div>
                  <div className="h-3 w-px bg-border/50" />
                  <span className="text-xs text-muted-foreground">
                    {order.customerinfo?.province || 'محافظة غير محددة'}
                  </span>
                </div>

                {/* Products & Delivery */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Package className="w-4 h-4" />
                    <span>{getOrderProducts(order.items)}</span>
                  </div>
                  <div className="h-3 w-px bg-border/50" />
                  <div className="flex items-center gap-1.5 text-xs">
                    {getDeliveryType(order) === 'شركة توصيل' ? (
                      <>
                        <Truck className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-blue-600 font-medium">شركة توصيل</span>
                      </>
                    ) : (
                      <>
                        <Home className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-green-600 font-medium">توصيل محلي</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Total & Created By */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">بواسطة:</span>
                    <span className="text-sm font-medium text-foreground">
                      {order.created_by_name || 'موظف النظام'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-gradient-to-r from-primary/10 to-accent/10 px-3 py-1 rounded-full border border-primary/20">
                    <CreditCard className="w-4 h-4 text-primary" />
                    <span className="font-bold text-primary">
                      {(order.total || 0).toLocaleString()}
                    </span>
                    <span className="text-xs text-primary/70">د.ع</span>
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