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
  Building,
  Phone,
  User
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
  
  // تحديد لون وأيقونة الحالة بالألوان المتناسقة
  const getStatusConfig = (status) => {
    const configs = {
      'pending': { 
        label: 'قيد التجهيز', 
        icon: Package,
        color: 'bg-gradient-to-r from-status-pending-start to-status-pending-end text-white border border-status-pending-border shadow-md shadow-status-pending-shadow/30 font-semibold rounded-lg px-2.5 py-1 text-xs'
      },
      'shipped': { 
        label: 'تم الشحن', 
        icon: Truck,
        color: 'bg-gradient-to-r from-status-shipped-start to-status-shipped-end text-white border border-status-shipped-border shadow-md shadow-status-shipped-shadow/30 font-semibold rounded-lg px-2.5 py-1 text-xs'
      },
      'delivery': { 
        label: 'قيد التوصيل', 
        icon: Truck,
        color: 'bg-gradient-to-r from-status-delivery-start to-status-delivery-end text-white border border-status-delivery-border shadow-md shadow-status-delivery-shadow/30 font-semibold rounded-lg px-2.5 py-1 text-xs'
      },
      'delivered': { 
        label: 'تم التسليم', 
        icon: CheckCircle,
        color: 'bg-gradient-to-r from-status-delivered-start to-status-delivered-end text-white border border-status-delivered-border shadow-md shadow-status-delivered-shadow/30 font-semibold rounded-lg px-2.5 py-1 text-xs'
      },
      'completed': { 
        label: 'مكتمل', 
        icon: CheckCircle,
        color: 'bg-gradient-to-r from-status-completed-start to-status-completed-end text-white border border-status-completed-border shadow-md shadow-status-completed-shadow/30 font-semibold rounded-lg px-2.5 py-1 text-xs'
      },
      'returned': { 
        label: 'راجعة', 
        icon: RotateCcw,
        color: 'bg-gradient-to-r from-status-returned-start to-status-returned-end text-white border border-status-returned-border shadow-md shadow-status-returned-shadow/30 font-semibold rounded-lg px-2.5 py-1 text-xs'
      },
      'returned_in_stock': { 
        label: 'راجع للمخزن', 
        icon: PackageCheck,
        color: 'bg-gradient-to-r from-status-returned-stock-start to-status-returned-stock-end text-white border border-status-returned-stock-border shadow-md shadow-status-returned-stock-shadow/30 font-semibold rounded-lg px-2.5 py-1 text-xs'
      },
      'cancelled': { 
        label: 'ملغي', 
        icon: XCircle,
        color: 'bg-gradient-to-r from-status-cancelled-start to-status-cancelled-end text-white border border-status-cancelled-border shadow-md shadow-status-cancelled-shadow/30 font-semibold rounded-lg px-2.5 py-1 text-xs'
      },
      'return_received': { 
        label: 'راجع للمخزن', 
        icon: PackageCheck,
        color: 'bg-gradient-to-r from-status-returned-stock-start to-status-returned-stock-end text-white border border-status-returned-stock-border shadow-md shadow-status-returned-stock-shadow/30 font-semibold rounded-lg px-2.5 py-1 text-xs'
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

  const cardVariants = {
    rest: { scale: 1 },
    hover: { scale: 1.02 },
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

  // تحضير معلومات المنتجات
  const getProductSummary = () => {
    if (!order.items || order.items.length === 0) return null;
    
    const totalItems = order.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const firstProductType = order.items[0]?.producttype || order.items[0]?.product_type || 'منتج';
    
    return { totalItems, firstProductType };
  };

  const productSummary = getProductSummary();

  return (
    <motion.div 
      variants={cardVariants} 
      initial="rest" 
      whileHover="hover" 
      transition={{ duration: 0.2 }}
      className="w-full"
    >
      <Card className={`overflow-hidden bg-gradient-to-br from-card to-card/95 backdrop-blur-sm transition-all duration-300 border hover:shadow-md hover:shadow-primary/10 ${isSelected ? 'border-primary shadow-md shadow-primary/20 ring-1 ring-primary/20' : 'border-border/50 hover:border-primary/30'}`}>
        <CardContent className="p-3">
          <div className="space-y-2.5">
            
            {/* Header - Very Compact */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onSelect?.(order.id)}
                  className="shrink-0 scale-90"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-foreground truncate">
                      {order.tracking_number}
                    </h3>
                    <Badge className={`${deliveryBadgeColor} px-1.5 py-0.5 text-xs rounded-md`}>
                      {order.delivery_partner}
                    </Badge>
                  </div>
                </div>
              </div>
              
              {/* Status Badge */}
              <div className={`flex items-center gap-1 shrink-0 ${statusConfig.color}`}>
                <StatusIcon className="h-3 w-3" />
                <span className="whitespace-nowrap">{statusConfig.label}</span>
              </div>
            </div>

            {/* Customer Info - Single Compact Row */}
            <div className="bg-muted/15 rounded-md p-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <User className="h-3 w-3 text-primary shrink-0" />
                  <span className="font-medium text-xs text-foreground truncate">{order.customer_name}</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span className="text-xs">{formatDate(order.created_at)}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                  <Phone className="h-3 w-3 shrink-0" />
                  <span className="truncate">{order.customer_phone}</span>
                </div>
                {productSummary && (
                  <div className="flex items-center gap-1 text-primary font-medium">
                    <Package className="h-3 w-3" />
                    <span>{productSummary.totalItems} {productSummary.firstProductType}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Price - Under Product Info */}
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {order.delivery_fee > 0 ? 'شامل التوصيل' : 'بدون توصيل'}
              </div>
              <div className="flex items-center gap-1">
                <CreditCard className="h-3 w-3 text-primary" />
                <span className="font-bold text-base text-primary">
                  {order.final_amount?.toLocaleString()}
                </span>
                <span className="text-xs text-primary/70">د.ع</span>
              </div>
            </div>

            {/* Actions - Compact Icons */}
            <div className="flex flex-wrap gap-1 pt-1.5 border-t border-border/20">
              
              {/* View Details */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewOrder?.(order)}
                className="flex items-center gap-1 text-xs h-7 px-2 border-primary/30 text-primary hover:bg-primary/10"
              >
                <Eye className="h-3 w-3" />
                معاينة
              </Button>

              {/* Edit/Delete */}
              {canEdit && hasPermission('edit_orders') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditOrder?.(order)}
                  className="flex items-center gap-1 text-xs h-7 px-2"
                >
                  <Edit2 className="h-3 w-3" />
                  تعديل
                </Button>
              )}

              {canDelete && hasPermission('delete_orders') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  className="flex items-center gap-1 text-xs h-7 px-2 border-red-300 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                  حذف
                </Button>
              )}

              {/* Status Actions - Only for local orders */}
              {isLocalOrder && (
                <>
                  {order.status === 'pending' && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleStatusChange('shipped')}
                      className="flex items-center gap-1 text-xs h-7 px-2 bg-orange-500 hover:bg-orange-600"
                    >
                      <Truck className="h-3 w-3" />
                      شحن
                    </Button>
                  )}

                  {order.status === 'shipped' && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleStatusChange('delivery')}
                      className="flex items-center gap-1 text-xs h-7 px-2 bg-purple-500 hover:bg-purple-600"
                    >
                      <Truck className="h-3 w-3" />
                      توصيل
                    </Button>
                  )}

                  {order.status === 'delivery' && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleStatusChange('delivered')}
                        className="flex items-center gap-1 text-xs h-7 px-2 bg-green-500 hover:bg-green-600"
                      >
                        <CheckCircle className="h-3 w-3" />
                        تسليم
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange('returned')}
                        className="flex items-center gap-1 text-xs h-7 px-2 border-red-300 text-red-600 hover:bg-red-50"
                      >
                        <RotateCcw className="h-3 w-3" />
                        راجعة
                      </Button>
                    </>
                  )}

                  {(order.status === 'cancelled' || order.status === 'returned') && hasPermission('manage_inventory') && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleStatusChange('returned_in_stock')}
                      className="flex items-center gap-1 text-xs h-7 px-2 bg-blue-500 hover:bg-blue-600"
                    >
                      <PackageCheck className="h-3 w-3" />
                      للمخزن
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* Company Order Note - Very Compact */}
            {!isLocalOrder && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-1.5 text-center">
                <div className="flex items-center justify-center gap-1 text-blue-700">
                  <Building className="h-3 w-3" />
                  <span className="text-xs">طلب شركة - حالة ثابتة</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default OrderCard;