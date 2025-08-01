import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Clock, Truck, CheckCircle, AlertTriangle, CornerDownLeft, Bot, Archive, Package, RotateCcw, FolderArchive } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import { usePermissions } from '@/hooks/usePermissions';
import { filterOrdersByPeriod } from '@/lib/dashboard-helpers';

const OrdersStats = ({ orders, aiOrders, onAiOrdersClick, onStatCardClick, globalPeriod }) => {
  const { canViewAllData, isSalesEmployee } = usePermissions();

  const handlePeriodChange = (stat, period) => {
    const statusMap = {
      total: 'all',
      pending: 'pending',
      shipped: 'shipped',
      delivered: 'delivered',
      returned: 'returned',
      archived: 'archived',
    };
    onStatCardClick(statusMap[stat], period);
  };
  
  const getStats = (status) => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    const filtered = globalPeriod !== 'all' ? filterOrdersByPeriod(safeOrders, globalPeriod) : safeOrders;

    if (status === 'all') {
      return filtered.filter(o => !o.isArchived && o.status !== 'completed' && o.status !== 'returned_in_stock').length;
    }
    if (status === 'archived') {
      return filtered.filter(o => o.isArchived || o.status === 'completed' || o.status === 'returned_in_stock').length;
    }
    return filtered.filter(o => o.status === status && !o.isArchived && o.status !== 'completed' && o.status !== 'returned_in_stock').length;
  };

  const createClickHandler = (status) => () => {
    onStatCardClick(status, globalPeriod);
  };
  
  const statsData = useMemo(() => [
    { key: 'ai-orders', title: 'طلبات الذكاء الاصطناعي', icon: Bot, colors: ['indigo-500', 'violet-500'], value: aiOrders.length, onClick: onAiOrdersClick, periods: {all: 'كل الوقت'} },
    { key: 'total', title: 'إجمالي الطلبات', icon: ShoppingCart, colors: ['blue-500', 'cyan-500'], value: getStats('all'), onClick: createClickHandler('all'), periods: { today: 'اليوم', week: 'آخر أسبوع', month: 'آخر شهر', all: 'كل الوقت'} },
    { key: 'pending', title: 'قيد التجهيز', icon: Clock, colors: ['yellow-500', 'orange-500'], value: getStats('pending'), onClick: createClickHandler('pending'), periods: { today: 'اليوم', week: 'آخر أسبوع', month: 'آخر شهر', all: 'كل الوقت'} },
    { key: 'shipped', title: 'تم الشحن', icon: Truck, colors: ['purple-500', 'pink-500'], value: getStats('shipped'), onClick: createClickHandler('shipped'), periods: { today: 'اليوم', week: 'آخر أسبوع', month: 'آخر شهر', all: 'كل الوقت'} },
    { key: 'delivery', title: 'قيد التوصيل', icon: Truck, colors: ['blue-500', 'sky-500'], value: getStats('delivery'), onClick: createClickHandler('delivery'), periods: { today: 'اليوم', week: 'آخر أسبوع', month: 'آخر شهر', all: 'كل الوقت'} },
    { key: 'delivered', title: 'تم التسليم', icon: CheckCircle, colors: ['green-500', 'emerald-500'], value: getStats('delivered'), onClick: createClickHandler('delivered'), periods: { today: 'اليوم', week: 'آخر أسبوع', month: 'آخر شهر', all: 'كل الوقت'} },
    { key: 'returned', title: 'راجع للمخزن', icon: RotateCcw, colors: ['orange-500', 'red-500'], value: getStats('returned_in_stock'), onClick: createClickHandler('returned_in_stock'), periods: { today: 'اليوم', week: 'آخر أسبوع', month: 'آخر شهر', all: 'كل الوقت'} },
    { key: 'archived', title: 'الأرشيف', icon: FolderArchive, colors: ['indigo-500', 'purple-500'], value: getStats('archived'), onClick: createClickHandler('archived'), periods: {all: 'كل الوقت'}},
  ], [orders, aiOrders, globalPeriod]);

  return (
    <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 sm:gap-4">
      {statsData.map((stat, index) => (
         <motion.div
            key={stat.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <StatCard 
              icon={stat.icon}
              value={stat.value}
              title={stat.title}
              colors={stat.colors}
              currentPeriod={globalPeriod}
              onClick={stat.onClick}
              periods={stat.periods}
            />
        </motion.div>
      ))}
    </div>
  );
};

export default OrdersStats;