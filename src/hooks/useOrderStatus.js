/**
 * مكون React Hook للحصول على معلومات حالة الطلب المتسقة
 */
import { useMemo } from 'react';
import { ORDER_STATUS_CONFIG, getOrderStatusInfo } from '@/lib/order-status-utils';

export const useOrderStatus = () => {
  return useMemo(() => ({
    // الثوابت
    ORDER_STATUS_CONFIG,
    
    // دوال مساعدة
    getStatusInfo: getOrderStatusInfo,
    getStatusLabel: (status) => getOrderStatusInfo(status).label,
    getStatusClass: (status) => getOrderStatusInfo(status).cssClass,
    getStatusColor: (status) => getOrderStatusInfo(status).color,
    
    // فلترة وترتيب
    filterByStatus: (orders, status) => {
      if (!orders || !Array.isArray(orders)) return [];
      if (status === 'all') return orders;
      return orders.filter(order => order.status === status);
    },
    
    // إحصائيات
    getStatusStats: (orders) => {
      if (!orders || !Array.isArray(orders)) return {};
      
      const stats = {};
      Object.keys(ORDER_STATUS_CONFIG).forEach(status => {
        stats[status] = orders.filter(order => order.status === status).length;
      });
      
      stats.total = orders.length;
      return stats;
    }
  }), []);
};

export default useOrderStatus;