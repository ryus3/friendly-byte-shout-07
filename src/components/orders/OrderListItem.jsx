import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Edit2, 
  Trash2, 
  Eye, 
  Package, 
  Truck, 
  CheckCircle, 
  XCircle,
  RotateCcw,
  PackageCheck,
  Calendar,
  Building,
  ExternalLink
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/UnifiedAuthContext';

const OrderListItem = ({ 
  order, 
  onViewOrder, 
  onSelect, 
  isSelected, 
  onUpdateStatus, 
  onDeleteOrder, 
  onEditOrder
}) => {
  const { hasPermission } = useAuth();
  
  // تحديد لون وأيقونة الحالة
  const getStatusConfig = (status) => {
    const configs = {
      'pending': { 
        label: 'قيد التجهيز', 
        icon: Package,
        color: 'bg-gradient-to-r from-status-pending-start to-status-pending-end text-white border border-status-pending-border shadow-sm font-medium rounded px-2 py-0.5 text-xs'
      },
      'shipped': { 
        label: 'تم الشحن', 
        icon: Truck,
        color: 'bg-gradient-to-r from-status-shipped-start to-status-shipped-end text-white border border-status-shipped-border shadow-sm font-medium rounded px-2 py-0.5 text-xs'
      },
      'delivery': { 
        label: 'قيد التوصيل', 
        icon: Truck,
        color: 'bg-gradient-to-r from-status-delivery-start to-status-delivery-end text-white border border-status-delivery-border shadow-sm font-medium rounded px-2 py-0.5 text-xs'
      },
      'delivered': { 
        label: 'تم التسليم', 
        icon: CheckCircle,
        color: 'bg-gradient-to-r from-status-delivered-start to-status-delivered-end text-white border border-status-delivered-border shadow-sm font-medium rounded px-2 py-0.5 text-xs'
      },
      'completed': { 
        label: 'مكتمل', 
        icon: CheckCircle,
        color: 'bg-gradient-to-r from-status-completed-start to-status-completed-end text-white border border-status-completed-border shadow-sm font-medium rounded px-2 py-0.5 text-xs'
      },
      'returned': { 
        label: 'راجعة', 
        icon: RotateCcw,
        color: 'bg-gradient-to-r from-status-returned-start to-status-returned-end text-white border border-status-returned-border shadow-sm font-medium rounded px-2 py-0.5 text-xs'
      },
      'returned_in_stock': { 
        label: 'راجع للمخزن', 
        icon: PackageCheck,
        color: 'bg-gradient-to-r from-status-returned-stock-start to-status-returned-stock-end text-white border border-status-returned-stock-border shadow-sm font-medium rounded px-2 py-0.5 text-xs'
      },
      'cancelled': { 
        label: 'ملغي', 
        icon: XCircle,
        color: 'bg-gradient-to-r from-status-cancelled-start to-status-cancelled-end text-white border border-status-cancelled-border shadow-sm font-medium rounded px-2 py-0.5 text-xs'
      },
      'return_received': { 
        label: 'راجع للمخزن', 
        icon: PackageCheck,
        color: 'bg-gradient-to-r from-status-returned-stock-start to-status-returned-stock-end text-white border border-status-returned-stock-border shadow-sm font-medium rounded px-2 py-0.5 text-xs'
      }
    };
    return configs[status] || configs['pending'];
  };

  const statusConfig = getStatusConfig(order.status);
  const StatusIcon = statusConfig.icon;
  
  // تحديد نوع التوصيل - ألوان متناسقة
  const isLocalOrder = order.delivery_partner === 'محلي';
  const deliveryBadgeColor = isLocalOrder ? 
    'bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 text-white border border-emerald-300/50 shadow-lg shadow-emerald-400/40 font-bold' : 
    'bg-gradient-to-r from-blue-400 via-blue-500 to-cyan-500 text-white border border-blue-300/50 shadow-lg shadow-blue-400/40 font-bold';

  // التحقق من الصلاحيات
  const canEdit = order.status === 'pending';
  const canDelete = order.status === 'pending';

  const handleStatusChange = (newStatus) => {
    if (onUpdateStatus) {
      onUpdateStatus(order.id, newStatus);
    }
  };

  const handleDelete = () => {
    if (onDeleteOrder && canDelete) {
      onDeleteOrder([order.id]);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={`bg-card border rounded-lg p-3 hover:shadow-md transition-all duration-300 ${isSelected ? 'border-primary shadow-md shadow-primary/20 bg-primary/5' : 'border-border/50 hover:border-primary/30'}`}
    >
      <div className="flex items-center gap-4">
        
        {/* Checkbox */}
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect?.(order.id)}
          className="shrink-0"
        />

        {/* Order Number */}
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm text-foreground">
            #{order.order_number}
          </div>
        </div>

        {/* Customer Info & Products */}
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm text-foreground truncate">
            {order.customer_name}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {order.customer_phone}
          </div>
          {/* Product Summary */}
          <div className="text-xs text-primary font-medium mt-1">
            {(() => {
              const items = order.items || order.order_items || [];
              if (items.length === 0) return 'لا توجد منتجات';
              
              const totalItems = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
              
              if (items.length === 1) {
                const item = items[0];
                const productName = item.productname || item.product_name || item.producttype || item.product_type || 'منتج';
                return `${productName} (${item.quantity || 1})`;
              } else {
                const firstProductType = items[0]?.producttype || items[0]?.product_type || 'منتج';
                return `${totalItems} قطعة - ${firstProductType}`;
              }
            })()}
          </div>
        </div>

        {/* Date & Delivery */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatDate(order.created_at)}
          </div>
          <Badge className={`${deliveryBadgeColor} px-2 py-1 text-xs rounded-full mt-1 w-fit shadow-sm`}>
            <Building className="h-3 w-3 ml-1" />
            {order.delivery_partner}
          </Badge>
        </div>

        {/* Amount */}
        <div className="min-w-0 flex-1 text-left">
          <div className="font-bold text-sm text-primary">
            {order.final_amount?.toLocaleString()} د.ع
          </div>
          <div className="text-xs text-muted-foreground">
            {order.delivery_fee > 0 ? 'شامل التوصيل' : 'بدون توصيل'}
          </div>
        </div>

        {/* Status - قابل للنقر للطلبات المحلية */}
        <div className="min-w-0 flex-1">
          {isLocalOrder && order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'returned_in_stock' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                // تحديد الحالة التالية
                const nextStatus = {
                  'pending': 'shipped',
                  'shipped': 'delivery', 
                  'delivery': 'delivered',
                  'delivered': 'completed',
                  'returned': 'returned_in_stock'
                }[order.status];
                if (nextStatus) handleStatusChange(nextStatus);
              }}
              className={`${statusConfig.color} hover:shadow-md transition-all duration-300 h-auto p-2`}
              title="انقر لتحديث الحالة"
            >
              <StatusIcon className="h-3 w-3" />
              <span className="ml-1">{statusConfig.label}</span>
            </Button>
          ) : (
            <div className={`flex items-center gap-1 ${statusConfig.color}`}>
              <StatusIcon className="h-3 w-3" />
              <span>{statusConfig.label}</span>
            </div>
          )}
        </div>

        {/* Actions - مضغوطة كما في الكارت */}
        <div className="flex items-center gap-1 shrink-0">
          {/* View */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewOrder?.(order)}
            className="h-6 w-6 p-0 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary hover:scale-110 transition-all duration-300 shadow-md"
            title="معاينة"
          >
            <Eye className="h-3 w-3" />
          </Button>

          {/* Edit */}
          {canEdit && hasPermission('edit_orders') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEditOrder?.(order)}
              className="h-6 w-6 p-0 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 hover:scale-110 transition-all duration-300 shadow-md"
              title="تعديل"
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          )}

          {/* Track */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewOrder?.(order)}
            className="h-6 w-6 p-0 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 hover:scale-110 transition-all duration-300 shadow-md"
            title="تتبع"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>

          {/* Delete */}
          {canDelete && hasPermission('delete_orders') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="h-6 w-6 p-0 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 hover:scale-110 transition-all duration-300 shadow-md"
              title="حذف"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default OrderListItem;