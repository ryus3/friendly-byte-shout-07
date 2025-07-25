import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
  MapPin,
  Calendar,
  CreditCard,
  Building
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/UnifiedAuthContext';

const OrderCard = ({ 
  order, 
  onViewOrder, 
  onSelect, 
  isSelected, 
  onUpdateStatus, 
  onDeleteOrder, 
  onEditOrder,
  onReceiveReturn 
}) => {
  const { hasPermission } = useAuth();
  
  // تحديد لون وأيقونة الحالة الموحدة مع الألوان المضيئة
  const getStatusConfig = (status) => {
    const configs = {
      'pending': { 
        label: 'قيد التجهيز', 
        icon: Package,
        color: 'bg-status-pending-bg text-status-pending border border-status-pending/30 shadow-lg shadow-status-pending/20 backdrop-blur-sm font-medium'
      },
      'shipped': { 
        label: 'تم الشحن', 
        icon: Truck,
        color: 'bg-status-shipped-bg text-status-shipped border border-status-shipped/30 shadow-lg shadow-status-shipped/20 backdrop-blur-sm font-medium'
      },
      'delivery': { 
        label: 'قيد التوصيل', 
        icon: Truck,
        color: 'bg-status-delivery-bg text-status-delivery border border-status-delivery/30 shadow-lg shadow-status-delivery/20 backdrop-blur-sm font-medium'
      },
      'delivered': { 
        label: 'تم التسليم', 
        icon: CheckCircle,
        color: 'bg-status-delivered-bg text-status-delivered border border-status-delivered/30 shadow-lg shadow-status-delivered/20 backdrop-blur-sm font-medium'
      },
      'completed': { 
        label: 'مكتمل', 
        icon: CheckCircle,
        color: 'bg-status-completed-bg text-status-completed border border-status-completed/30 shadow-lg shadow-status-completed/20 backdrop-blur-sm font-medium'
      },
      'returned': { 
        label: 'راجعة', 
        icon: RotateCcw,
        color: 'bg-status-returned-bg text-status-returned border border-status-returned/30 shadow-lg shadow-status-returned/20 backdrop-blur-sm font-medium'
      },
      'returned_in_stock': { 
        label: 'راجع للمخزن', 
        icon: PackageCheck,
        color: 'bg-status-returned-stock-bg text-status-returned-stock border border-status-returned-stock/30 shadow-lg shadow-status-returned-stock/20 backdrop-blur-sm font-medium'
      },
      'cancelled': { 
        label: 'ملغي', 
        icon: XCircle,
        color: 'bg-status-cancelled-bg text-status-cancelled border border-status-cancelled/30 shadow-lg shadow-status-cancelled/20 backdrop-blur-sm font-medium'
      }
    };
    return configs[status] || configs['pending'];
  };

  const statusConfig = getStatusConfig(order.status);
  const StatusIcon = statusConfig.icon;
  
  // تحديد نوع التوصيل
  const isLocalOrder = order.delivery_partner === 'محلي';
  const deliveryBadgeColor = isLocalOrder ? 
    'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm font-medium' : 
    'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm font-medium';

  // التحقق من الصلاحيات - يمكن التعديل/الحذف فقط في حالة "قيد التجهيز"
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

  const cardVariants = {
    rest: { scale: 1 },
    hover: { scale: 1.01 },
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-IQ', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <motion.div 
      variants={cardVariants} 
      initial="rest" 
      whileHover="hover" 
      transition={{ duration: 0.2 }}
      className="w-full"
    >
      <Card className={`overflow-hidden bg-card/95 backdrop-blur-sm transition-all duration-300 border hover:shadow-lg hover:shadow-primary/10 ${isSelected ? 'border-primary shadow-lg shadow-primary/20' : 'border-border/50 hover:border-primary/30'}`}>
        <CardContent className="p-5">
          <div className="space-y-4">
            
            {/* Header Row - Compact Design */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onSelect?.(order.id)}
                  className="shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg text-foreground truncate">
                      {order.tracking_number}
                    </h3>
                    <Badge className={`${deliveryBadgeColor} px-2.5 py-1 text-xs shrink-0`}>
                      {order.delivery_partner}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    #{order.order_number}
                  </p>
                </div>
              </div>
              
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg shrink-0 ${statusConfig.color}`}>
                <StatusIcon className="h-4 w-4" />
                <span className="text-sm whitespace-nowrap">{statusConfig.label}</span>
              </div>
            </div>

            {/* Customer Info - Minimal but Complete */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-foreground text-sm">{order.customer_name}</h4>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span className="text-xs">{formatDate(order.created_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{order.customer_address}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {order.customer_phone}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="flex items-center justify-between bg-primary/5 rounded-lg p-3">
              <div className="text-sm text-muted-foreground">
                <div>المجموع: {order.total_amount?.toLocaleString()} د.ع</div>
                {order.delivery_fee > 0 && (
                  <div className="text-xs">توصيل: +{order.delivery_fee?.toLocaleString()}</div>
                )}
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <span className="font-bold text-lg text-primary">
                    {order.final_amount?.toLocaleString()}
                  </span>
                  <span className="text-sm text-primary/70">د.ع</span>
                </div>
              </div>
            </div>

            {/* Action Buttons - Organized and Clean */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border/30">
              
              {/* Primary Actions */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewOrder?.(order)}
                className="flex items-center gap-2 border-primary/20 text-primary hover:bg-primary/10"
              >
                <Eye className="h-4 w-4" />
                <span>التفاصيل</span>
              </Button>

              {/* Edit/Delete - Only for pending orders */}
              {canEdit && hasPermission('edit_orders') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditOrder?.(order)}
                  className="flex items-center gap-2"
                >
                  <Edit2 className="h-4 w-4" />
                  <span>تعديل</span>
                </Button>
              )}

              {canDelete && hasPermission('delete_orders') && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>حذف</span>
                </Button>
              )}

              {/* Status Change Actions - Smart buttons based on current status */}
              {order.status === 'pending' && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleStatusChange('shipped')}
                  className="flex items-center gap-2 bg-status-shipped text-white hover:opacity-90"
                >
                  <Truck className="h-4 w-4" />
                  <span>شحن</span>
                </Button>
              )}

              {order.status === 'shipped' && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleStatusChange('delivery')}
                  className="flex items-center gap-2 bg-status-delivery text-white hover:opacity-90"
                >
                  <Truck className="h-4 w-4" />
                  <span>قيد التوصيل</span>
                </Button>
              )}

              {order.status === 'delivery' && (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleStatusChange('delivered')}
                    className="flex items-center gap-2 bg-status-delivered text-white hover:opacity-90"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>تم التسليم</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange('returned')}
                    className="flex items-center gap-2 border-status-returned text-status-returned hover:bg-status-returned-bg"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>راجعة</span>
                  </Button>
                </>
              )}

              {/* Receive to Stock - For cancelled/returned orders */}
              {(order.status === 'cancelled' || order.status === 'returned') && hasPermission('manage_inventory') && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleStatusChange('returned_in_stock')}
                  className="flex items-center gap-2 bg-status-returned-stock text-white hover:opacity-90"
                >
                  <PackageCheck className="h-4 w-4" />
                  <span>استلام للمخزن</span>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default OrderCard;