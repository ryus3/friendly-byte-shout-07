import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Clock, Truck, CheckCircle, AlertCircle, CornerDownLeft, Bot, Archive, Package, FolderArchive } from 'lucide-react';
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
  
  // حالات قيد التوصيل (17 حالة) - delivery
  const IN_DELIVERY_STATUSES = [
    '3','18','22','24','25','26','27','28','29','30','33',
    '34','35','36','37','38','39','40','41','42','43','44'
  ];
  
  // حالات تحتاج معالجة (11 حالة من ضمن delivery)
  const NEEDS_PROCESSING_STATUSES = [
    '24','25','26','27','28','30','33','34','35','36','37','38','39','40','41'
  ];
  
  // حالات تم التسليم (1 حالة فقط)
  const DELIVERED_STATUSES = ['4'];
  
  // حالات تم الشحن (9 حالات)
  const SHIPPED_STATUSES = ['2','5','6','7','8','9','10','11','14'];

  const getStats = (status) => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    const filtered = globalPeriod !== 'all' ? filterOrdersByPeriod(safeOrders, globalPeriod) : safeOrders;

    if (status === 'all') {
      return filtered.filter(o => !o.isarchived && o.status !== 'completed' && o.status !== 'returned_in_stock').length;
    }
    if (status === 'archived') {
      return filtered.filter(o => o.isarchived || o.status === 'completed' || o.status === 'returned_in_stock').length;
    }
    if (status === 'shipped') {
      return filtered.filter(o => SHIPPED_STATUSES.includes(o.delivery_status) && !o.isarchived).length;
    }
    if (status === 'in_delivery') {
      return filtered.filter(o => IN_DELIVERY_STATUSES.includes(o.delivery_status) && !o.isarchived).length;
    }
    if (status === 'delivered') {
      return filtered.filter(o => DELIVERED_STATUSES.includes(o.delivery_status) && !o.isarchived).length;
    }
    if (status === 'needs_processing') {
      return filtered.filter(o => NEEDS_PROCESSING_STATUSES.includes(o.delivery_status) && !o.isarchived).length;
    }
    return filtered.filter(o => o.status === status && !o.isarchived && o.status !== 'completed' && o.status !== 'returned_in_stock').length;
  };

  const createClickHandler = (status) => () => {
    onStatCardClick(status, globalPeriod);
  };
  
  const aiOrdersCount = useMemo(() => {
    const list = Array.isArray(aiOrders) ? aiOrders : [];
    const ids = new Set();
    for (const o of list) {
      const key = o?.id ?? o?.order_id ?? o?.uuid ?? `${o?.source || 'src'}-${o?.created_at || ''}`;
      ids.add(String(key));
    }
    return ids.size;
  }, [aiOrders]);
  
  const statsData = useMemo(() => [
    { key: 'ai-orders', title: 'طلبات الذكاء الاصطناعي', icon: Bot, colors: ['indigo-500', 'violet-500'], value: aiOrdersCount, onClick: onAiOrdersClick, periods: {all: 'كل الوقت'} },
    { key: 'total', title: 'إجمالي الطلبات', icon: ShoppingCart, colors: ['blue-500', 'cyan-500'], value: getStats('all'), onClick: createClickHandler('all'), periods: { today: 'اليوم', week: 'آخر أسبوع', month: 'آخر شهر', all: 'كل الوقت'} },
    { key: 'pending', title: 'قيد التجهيز', icon: Clock, colors: ['yellow-500', 'orange-500'], value: getStats('pending'), onClick: createClickHandler('pending'), periods: { today: 'اليوم', week: 'آخر أسبوع', month: 'آخر شهر', all: 'كل الوقت'} },
    { key: 'shipped', title: 'تم الشحن', icon: Truck, colors: ['purple-500', 'pink-500'], value: getStats('shipped'), onClick: createClickHandler('shipped'), periods: { today: 'اليوم', week: 'آخر أسبوع', month: 'آخر شهر', all: 'كل الوقت'} },
    { key: 'delivery', title: 'قيد التوصيل', icon: Truck, colors: ['blue-500', 'sky-500'], value: getStats('delivery'), onClick: createClickHandler('delivery'), periods: { today: 'اليوم', week: 'آخر أسبوع', month: 'آخر شهر', all: 'كل الوقت'} },
    { key: 'delivered', title: 'تم التسليم', icon: CheckCircle, colors: ['green-500', 'emerald-500'], value: getStats('delivered'), onClick: createClickHandler('delivered'), periods: { today: 'اليوم', week: 'آخر أسبوع', month: 'آخر شهر', all: 'كل الوقت'} },
    { key: 'needs_processing', title: 'تحتاج معالجة', icon: AlertCircle, colors: ['red-500', 'orange-600'], value: getStats('needs_processing'), onClick: createClickHandler('needs_processing'), periods: { today: 'اليوم', week: 'آخر أسبوع', month: 'آخر شهر', all: 'كل الوقت'} },
    { key: 'archived', title: 'الأرشيف', icon: FolderArchive, colors: ['indigo-500', 'purple-500'], value: getStats('archived'), onClick: createClickHandler('archived'), periods: {all: 'كل الوقت'}},
  ], [orders, aiOrdersCount, globalPeriod]);

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