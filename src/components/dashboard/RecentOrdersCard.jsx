import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Eye, ShoppingCart } from 'lucide-react';
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
          <div className="space-y-4 flex-1">
            {recentOrders && recentOrders.length > 0 ? recentOrders.map((order, index) => (
              <motion.div 
                key={order.id} 
                className="flex items-center justify-between"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarFallback>{order.customerinfo?.name?.charAt(0) || '?'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-foreground">{order.customerinfo?.name || 'زبون غير معروف'}</p>
                    <p className="text-sm text-muted-foreground">{(order.total || 0).toLocaleString()} د.ع</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleViewOrder(order)}>
                  <Eye className="w-4 h-4 text-muted-foreground" />
                </Button>
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