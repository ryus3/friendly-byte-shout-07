/**
 * نظام الألوان الموحد لحالات الطلبات
 * يوفر API موحد للحصول على معلومات وألوان حالات الطلبات
 */

export const ORDER_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing', 
  SHIPPED: 'shipped',
  DELIVERY: 'delivery',
  DELIVERED: 'delivered',
  RETURNED: 'returned',
  CANCELLED: 'cancelled'
};

export const ORDER_STATUS_CONFIG = {
  [ORDER_STATUSES.PENDING]: {
    label: 'قيد التجهيز',
    color: 'hsl(var(--status-pending))',
    bgColor: 'hsl(var(--status-pending) / 0.15)',
    borderColor: 'hsl(var(--status-pending) / 0.25)',
    cssClass: 'status-pending',
    priority: 1
  },
  [ORDER_STATUSES.PROCESSING]: {
    label: 'قيد المعالجة', 
    color: 'hsl(var(--status-processing))',
    bgColor: 'hsl(var(--status-processing) / 0.15)',
    borderColor: 'hsl(var(--status-processing) / 0.25)',
    cssClass: 'status-processing',
    priority: 2
  },
  [ORDER_STATUSES.SHIPPED]: {
    label: 'تم الشحن',
    color: 'hsl(var(--status-shipped))',
    bgColor: 'hsl(var(--status-shipped) / 0.15)',
    borderColor: 'hsl(var(--status-shipped) / 0.25)',
    cssClass: 'status-shipped',
    priority: 3
  },
  [ORDER_STATUSES.DELIVERY]: {
    label: 'قيد التوصيل',
    color: 'hsl(var(--status-delivery))',
    bgColor: 'hsl(var(--status-delivery) / 0.15)',
    borderColor: 'hsl(var(--status-delivery) / 0.25)',
    cssClass: 'status-delivery',
    priority: 4
  },
  [ORDER_STATUSES.DELIVERED]: {
    label: 'تم التسليم',
    color: 'hsl(var(--status-delivered))',
    bgColor: 'hsl(var(--status-delivered) / 0.15)',
    borderColor: 'hsl(var(--status-delivered) / 0.25)',
    cssClass: 'status-delivered',
    priority: 5
  },
  [ORDER_STATUSES.RETURNED]: {
    label: 'راجع',
    color: 'hsl(var(--status-returned))',
    bgColor: 'hsl(var(--status-returned) / 0.15)',
    borderColor: 'hsl(var(--status-returned) / 0.25)',
    cssClass: 'status-returned',
    priority: 6
  },
  [ORDER_STATUSES.CANCELLED]: {
    label: 'تم الإرجاع',
    color: 'hsl(var(--status-cancelled))',
    bgColor: 'hsl(var(--status-cancelled) / 0.15)',
    borderColor: 'hsl(var(--status-cancelled) / 0.25)',
    cssClass: 'status-cancelled',
    priority: 7
  }
};

/**
 * الحصول على معلومات حالة الطلب
 */
export const getOrderStatusInfo = (status) => {
  return ORDER_STATUS_CONFIG[status] || {
    label: 'غير محدد',
    color: 'hsl(var(--muted-foreground))',
    bgColor: 'hsl(var(--muted) / 0.5)',
    borderColor: 'hsl(var(--border))',
    cssClass: 'status-unknown',
    priority: 0
  };
};

/**
 * الحصول على تسمية الحالة
 */
export const getOrderStatusLabel = (status) => {
  return getOrderStatusInfo(status).label;
};

/**
 * الحصول على CSS class للحالة
 */
export const getOrderStatusClass = (status) => {
  return getOrderStatusInfo(status).cssClass;
};

/**
 * فلترة الطلبات حسب الحالة
 */
export const filterOrdersByStatus = (orders, status) => {
  if (!orders || !Array.isArray(orders)) return [];
  if (status === 'all') return orders;
  return orders.filter(order => order.status === status);
};

/**
 * ترتيب الطلبات حسب أولوية الحالة
 */
export const sortOrdersByStatusPriority = (orders) => {
  if (!orders || !Array.isArray(orders)) return [];
  return [...orders].sort((a, b) => {
    const priorityA = getOrderStatusInfo(a.status).priority;
    const priorityB = getOrderStatusInfo(b.status).priority;
    return priorityA - priorityB;
  });
};

/**
 * الحصول على إحصائيات الطلبات حسب الحالة
 */
export const getOrderStatusStats = (orders) => {
  if (!orders || !Array.isArray(orders)) return {};
  
  const stats = {};
  Object.keys(ORDER_STATUS_CONFIG).forEach(status => {
    stats[status] = orders.filter(order => order.status === status).length;
  });
  
  stats.total = orders.length;
  return stats;
};

export default {
  ORDER_STATUSES,
  ORDER_STATUS_CONFIG,
  getOrderStatusInfo,
  getOrderStatusLabel,
  getOrderStatusClass,
  filterOrdersByStatus,
  sortOrdersByStatusPriority,
  getOrderStatusStats
};