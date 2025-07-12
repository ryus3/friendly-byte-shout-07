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
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer border border-border/40"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleViewOrder(order)}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="relative">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {order.customerinfo?.name?.charAt(0) || '؟'}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-background ${
                      order.status === 'delivered' ? 'bg-green-500' :
                      order.status === 'shipped' ? 'bg-blue-500' :
                      order.status === 'processing' ? 'bg-yellow-500' : 'bg-orange-500'
                    }`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-foreground truncate">{order.customerinfo?.name || 'زبون غير معروف'}</p>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-mono">
                        #{order.tracking_number || String(order.id)?.slice(-4)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-primary">
                        {(order.total || 0).toLocaleString()} <span className="text-xs text-muted-foreground">د.ع</span>
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        order.status === 'delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        order.status === 'shipped' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        order.status === 'processing' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                      }`}>
                        {order.status === 'delivered' ? 'مسلم' :
                         order.status === 'shipped' ? 'مرسل' :
                         order.status === 'processing' ? 'قيد التحضير' : 'معلق'}
                      </span>
                    </div>
                  </div>
                </div>
                <Eye className="w-4 h-4 text-muted-foreground shrink-0 mr-2" />
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