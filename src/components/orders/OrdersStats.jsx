import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Clock, Truck, CheckCircle, AlertTriangle, CornerDownLeft, Bot, Archive, Package } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import { filterOrdersByPeriod } from '@/lib/dashboard-helpers';

const OrdersStats = ({ orders, aiOrders, onAiOrdersClick, onStatCardClick }) => {
  const [periods, setPeriods] = useState({
    total: 'today',
    pending: 'today',
    shipped: 'today',
    delivered: 'today',
    processing: 'today',
    returned: 'today',
    archived: 'all',
  });

  const handlePeriodChange = (stat, period) => {
    setPeriods(prev => ({...prev, [stat]: period}));
    const statusMap = {
      total: 'all',
      pending: 'pending',
      shipped: 'shipped',
      delivered: 'delivered',
      processing: 'processing',
      returned: 'returned',
      archived: 'archived',
    };
    onStatCardClick(statusMap[stat], period);
  };
  
  const getStats = (status) => {
    const periodKey = Object.keys(periods).find(key => key === status || (status === 'all' && key === 'total')) || 'total';
    const safeOrders = Array.isArray(orders) ? orders : [];
    const filtered = filterOrdersByPeriod(safeOrders, periods[periodKey]);

    if (status === 'all') return filtered.filter(o => !o.isArchived).length;
    if (status === 'archived') return safeOrders.filter(o => o.isArchived).length;
    return filtered.filter(o => o.status === status && !o.isArchived).length;
  };

  const createClickHandler = (status) => () => {
    const periodKey = Object.keys(periods).find(key => key === status || (status === 'all' && key === 'total')) || 'total';
    onStatCardClick(status, periods[periodKey]);
  };
  
  const statsData = useMemo(() => [
    { key: 'ai-orders', title: 'طلبات AI', icon: Bot, colors: ['indigo-500', 'violet-500'], value: aiOrders.length, onClick: onAiOrdersClick, periods: {all: 'كل الوقت'} },
    { key: 'total', title: 'إجمالي الطلبات', icon: ShoppingCart, colors: ['blue-500', 'cyan-500'], value: getStats('all'), onPeriodChange: (p) => handlePeriodChange('total', p), onClick: createClickHandler('all'), periods: { today: 'اليوم', week: 'آخر أسبوع', month: 'آخر شهر', all: 'كل الوقت'} },
    { key: 'pending', title: 'قيد التجهيز', icon: Clock, colors: ['yellow-500', 'orange-500'], value: getStats('pending'), onPeriodChange: (p) => handlePeriodChange('pending', p), onClick: createClickHandler('pending'), periods: { today: 'اليوم', week: 'آخر أسبوع', month: 'آخر شهر', all: 'كل الوقت'} },
    { key: 'processing', title: 'قيد المعالجة', icon: Package, colors: ['orange-500', 'amber-500'], value: getStats('processing'), onPeriodChange: (p) => handlePeriodChange('processing', p), onClick: createClickHandler('processing'), periods: { today: 'اليوم', week: 'آخر أسبوع', month: 'آخر شهر', all: 'كل الوقت'} },
    { key: 'shipped', title: 'تم الشحن', icon: Truck, colors: ['purple-500', 'pink-500'], value: getStats('shipped'), onPeriodChange: (p) => handlePeriodChange('shipped', p), onClick: createClickHandler('shipped'), periods: { today: 'اليوم', week: 'آخر أسبوع', month: 'آخر شهر', all: 'كل الوقت'} },
    { key: 'delivery', title: 'قيد التوصيل', icon: Truck, colors: ['blue-500', 'sky-500'], value: getStats('delivery'), onPeriodChange: (p) => handlePeriodChange('delivery', p), onClick: createClickHandler('delivery'), periods: { today: 'اليوم', week: 'آخر أسبوع', month: 'آخر شهر', all: 'كل الوقت'} },
    { key: 'delivered', title: 'تم التسليم', icon: CheckCircle, colors: ['green-500', 'emerald-500'], value: getStats('delivered'), onPeriodChange: (p) => handlePeriodChange('delivered', p), onClick: createClickHandler('delivered'), periods: { today: 'اليوم', week: 'آخر أسبوع', month: 'آخر شهر', all: 'كل الوقت'} },
    { key: 'returned', title: 'الطلبات الراجعة', icon: CornerDownLeft, colors: ['slate-500', 'gray-600'], value: getStats('returned'), onPeriodChange: (p) => handlePeriodChange('returned', p), onClick: createClickHandler('returned'), periods: { today: 'اليوم', week: 'آخر أسبوع', month: 'آخر شهر', all: 'كل الوقت'} },
    { key: 'archived', title: 'الأرشيف', icon: Archive, colors: ['gray-500', 'slate-600'], value: getStats('archived'), onClick: createClickHandler('archived'), periods: {all: 'كل الوقت'}},
  ], [orders, aiOrders, periods]);

  return (
    <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
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
              currentPeriod={periods[stat.key]}
              onPeriodChange={stat.onPeriodChange}
              onClick={stat.onClick}
              periods={stat.periods}
            />
        </motion.div>
      ))}
    </div>
  );
};

export default OrdersStats;