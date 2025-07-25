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
  
  // تحديد نوع التوصيل
  const isLocalOrder = order.delivery_partner === 'محلي';
  const deliveryBadgeColor = isLocalOrder ? 
    'bg-emerald-100 text-emerald-700 border border-emerald-300' : 
    'bg-blue-100 text-blue-700 border border-blue-300';

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
            {order.tracking_number}
          </div>
          <div className="text-xs text-muted-foreground">
            #{order.order_number}
          </div>
        </div>

        {/* Customer Name */}
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm text-foreground truncate">
            {order.customer_name}
          </div>
          <Badge className={`${deliveryBadgeColor} px-1.5 py-0.5 text-xs rounded mt-1`}>
            <Building className="h-3 w-3 ml-1" />
            {order.delivery_partner}
          </Badge>
        </div>

        {/* Phone */}
        <div className="min-w-0 flex-1">
          <div className="text-sm text-foreground font-medium">
            {order.customer_phone}
          </div>
        </div>

        {/* Date */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatDate(order.created_at)}
          </div>
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

        {/* Status */}
        <div className="min-w-0 flex-1">
          {isLocalOrder ? (
            <select
              value={order.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full text-xs border border-border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={!hasPermission('manage_orders')}
            >
              <option value="pending">قيد التجهيز</option>
              <option value="shipped">تم الشحن</option>
              <option value="delivery">قيد التوصيل</option>
              <option value="delivered">تم التسليم</option>
              <option value="returned">راجعة</option>
              <option value="cancelled">ملغي</option>
              {hasPermission('manage_inventory') && (
                <option value="returned_in_stock">راجع للمخزن</option>
              )}
            </select>
          ) : (
            <div className={`flex items-center gap-1 ${statusConfig.color}`}>
              <StatusIcon className="h-3 w-3" />
              <span>{statusConfig.label}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* View */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewOrder?.(order)}
            className="h-8 w-8 p-0 hover:bg-primary/10"
            title="معاينة"
          >
            <Eye className="h-4 w-4 text-primary" />
          </Button>

          {/* Edit */}
          {canEdit && hasPermission('edit_orders') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEditOrder?.(order)}
              className="h-8 w-8 p-0 hover:bg-blue-50"
              title="تعديل"
            >
              <Edit2 className="h-4 w-4 text-blue-600" />
            </Button>
          )}

          {/* Delete */}
          {canDelete && hasPermission('delete_orders') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="h-8 w-8 p-0 hover:bg-red-50"
              title="حذف"
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
          )}

          {/* Track */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewOrder?.(order)}
            className="h-8 w-8 p-0 hover:bg-green-50"
            title="تتبع"
          >
            <ExternalLink className="h-4 w-4 text-green-600" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default OrderListItem;