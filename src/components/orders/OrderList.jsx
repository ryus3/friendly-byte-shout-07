
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import OrderCard from '@/components/orders/OrderCard';
import OrderListItem from '@/components/orders/OrderListItem';
import Loader from '@/components/ui/loader';

const MemoizedOrderCard = React.memo(OrderCard);
const MemoizedOrderListItem = React.memo(OrderListItem);

const OrderList = ({
  orders,
  isLoading,
  onViewOrder,
  onEditOrder,
  onUpdateStatus,
  onReceiveReturn,
  selectedOrders = [],
  setSelectedOrders = () => {},
  onDeleteOrder,
  viewMode = 'grid', // 'grid' or 'list'
  calculateProfit,
  profits,
  showEmployeeName = false,
  additionalButtons, // دالة ترجع أزرار إضافية للطلب
}) => {
  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader /></div>;
  }

  if (!orders || orders.length === 0) {
    return <div className="text-center py-16 text-muted-foreground">لا توجد طلبات لعرضها.</div>;
  }

  const handleSelect = (orderId) => {
    if (setSelectedOrders) {
      setSelectedOrders(prev =>
        prev.includes(orderId)
          ? prev.filter(id => id !== orderId)
          : [...prev, orderId]
      );
    }
  };

  if (viewMode === 'list') {
    return (
      <div className="space-y-2">
        <AnimatePresence>
          {orders.map(order => (
            <MemoizedOrderListItem
              key={order.id}
              order={order}
              onViewOrder={() => onViewOrder(order)}
              onEditOrder={() => onEditOrder && onEditOrder(order)}
              onReceiveReturn={onReceiveReturn}
              isSelected={selectedOrders?.includes(order.id) ?? false}
              onSelect={() => handleSelect(order.id)}
              onUpdateStatus={onUpdateStatus}
              onDeleteOrder={onDeleteOrder}
              calculateProfit={calculateProfit}
              profits={profits}
              showEmployeeName={showEmployeeName}
            />
          ))}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <AnimatePresence>
        {orders.map(order => (
          <motion.div
            key={order.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <MemoizedOrderCard
              order={order}
              onViewOrder={() => onViewOrder(order)}
              onEditOrder={() => onEditOrder && onEditOrder(order)}
              onReceiveReturn={onReceiveReturn}
              isSelected={selectedOrders?.includes(order.id) ?? false}
              onSelect={() => handleSelect(order.id)}
              onUpdateStatus={onUpdateStatus}
              onDeleteOrder={onDeleteOrder}
              calculateProfit={calculateProfit}
              profits={profits}
              showEmployeeName={showEmployeeName}
              additionalButtons={additionalButtons ? additionalButtons(order) : null}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(OrderList);
