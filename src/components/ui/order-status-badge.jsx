import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// خريطة الحالات مع الألوان والنصوص - النظام الموحد
const ORDER_STATUS_CONFIG = {
  pending: {
    label: 'قيد التجهيز',
    variant: 'pending',
    className: 'status-badge status-pending'
  },
  processing: {
    label: 'قيد المعالجة',
    variant: 'processing', 
    className: 'status-badge status-processing'
  },
  shipped: {
    label: 'تم الشحن',
    variant: 'shipped',
    className: 'status-badge status-shipped'
  },
  delivery: {
    label: 'قيد التوصيل',
    variant: 'delivery',
    className: 'status-badge status-delivery'
  },
  delivered: {
    label: 'تم التسليم',
    variant: 'delivered',
    className: 'status-badge status-delivered'
  },
  returned: {
    label: 'راجع',
    variant: 'returned',
    className: 'status-badge status-returned'
  },
  cancelled: {
    label: 'تم الإرجاع',
    variant: 'cancelled',
    className: 'status-badge status-cancelled'
  }
};

/**
 * مكون موحد لعرض حالة الطلب بألوان ثابتة ومتسقة
 */
const OrderStatusBadge = ({ 
  status, 
  showIcon = false, 
  size = 'default', 
  className = '',
  variant = 'default' 
}) => {
  const statusConfig = ORDER_STATUS_CONFIG[status];
  
  if (!statusConfig) {
    return (
      <Badge variant="secondary" className={cn('text-xs', className)}>
        غير محدد
      </Badge>
    );
  }

  return (
    <span
      className={cn(
        statusConfig.className,
        {
          'text-xs px-2 py-1': size === 'sm',
          'text-sm px-3 py-1.5': size === 'default',
          'text-base px-4 py-2': size === 'lg'
        },
        className
      )}
    >
      {statusConfig.label}
    </span>
  );
};

/**
 * Hook للحصول على معلومات حالة الطلب
 */
export const useOrderStatusConfig = () => {
  const getStatusConfig = (status) => ORDER_STATUS_CONFIG[status];
  const getStatusLabel = (status) => ORDER_STATUS_CONFIG[status]?.label || 'غير محدد';
  const getStatusClass = (status) => ORDER_STATUS_CONFIG[status]?.className || '';
  
  return {
    getStatusConfig,
    getStatusLabel,
    getStatusClass,
    ORDER_STATUS_CONFIG
  };
};

/**
 * مكون لعرض قائمة منسدلة بحالات الطلبات
 */
export const OrderStatusSelect = ({ value, onChange, placeholder = 'اختر الحالة' }) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
    >
      <option value="">{placeholder}</option>
      {Object.entries(ORDER_STATUS_CONFIG).map(([key, config]) => (
        <option key={key} value={key}>
          {config.label}
        </option>
      ))}
    </select>
  );
};

export default OrderStatusBadge;