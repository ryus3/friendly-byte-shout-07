import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Eye, ShoppingCart, User, Truck } from 'lucide-react';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import { toast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

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
      'pending': { label: 'معلق', variant: 'secondary' },
      'processing': { label: 'قيد المعالجة', variant: 'default' },
      'shipped': { label: 'مرسل', variant: 'outline' },
      'delivered': { label: 'مستلم', variant: 'default' },
      'cancelled': { label: 'ملغي', variant: 'destructive' }
    };
    const statusInfo = statusMap[status] || { label: status, variant: 'secondary' };
    return <Badge variant={statusInfo.variant} className="text-xs">{statusInfo.label}</Badge>;
  };

  const getDeliveryType = (order) => {
    // تحديد نوع التوصيل بناءً على بيانات الطلب
    const isDeliveryCompany = order.customerinfo?.delivery_company || order.delivery_partner;
    return isDeliveryCompany ? 'شركة توصيل' : 'محلي';
  };

  const getOrderId = (order) => {
    return `#${String(order.id).slice(-3).padStart(3, '0')}`;
  };

  return (
    <>
      <Card className="glass-effect h-full border-border/60 flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl text-foreground">
            <ShoppingCart className="w-6 h-6 text-primary" />
            الطلبات الأخيرة
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-4 pt-0">
          <div className="space-y-3 flex-1">
            {recentOrders && recentOrders.length > 0 ? recentOrders.map((order, index) => (
              <motion.div 
                key={order.id} 
                className="bg-card/50 rounded-lg p-3 border border-border/40 hover:border-border/80 transition-all cursor-pointer"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleViewOrder(order)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-muted-foreground text-sm">{getOrderId(order)}</span>
                    {getStatusBadge(order.status)}
                  </div>
                  <Eye className="w-4 h-4 text-muted-foreground" />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs">
                        {order.customerinfo?.name?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground text-sm">
                        {order.customerinfo?.name || 'زبون غير معروف'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>منذ {order.customerinfo?.province || 'غير محدد'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-left">
                    <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
                      <span>{(order.total || 0).toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground">د.ع</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      {getDeliveryType(order) === 'شركة توصيل' ? (
                        <><Truck className="w-3 h-3" /><span>{getDeliveryType(order)}</span></>
                      ) : (
                        <><User className="w-3 h-3" /><span>{getDeliveryType(order)}</span></>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>لا توجد طلبات حديثة.</p>
              </div>
            )}
          </div>
          <Button variant="link" className="mt-4 w-full text-primary" onClick={handleViewAll}>
            عرض كل الطلبات
          </Button>
        </CardContent>
      </Card>
      <OrderDetailsDialog order={selectedOrder} open={isDetailsOpen} onOpenChange={setIsDetailsOpen} />
    </>
  );
};

export default RecentOrdersCard;