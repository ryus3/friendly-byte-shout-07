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
  
  // تحديد لون وأيقونة الحالة بالألوان الجميلة المتدرجة
  const getStatusConfig = (status) => {
    const configs = {
      'pending': { 
        label: 'قيد التجهيز', 
        icon: Package,
        color: 'bg-gradient-to-r from-status-pending-start to-status-pending-end text-white border border-status-pending-border shadow-lg shadow-status-pending-shadow/40 backdrop-blur-sm font-bold rounded-lg px-3 py-1.5 text-xs'
      },
      'shipped': { 
        label: 'تم الشحن', 
        icon: Truck,
        color: 'bg-gradient-to-r from-status-shipped-start to-status-shipped-end text-white border border-status-shipped-border shadow-lg shadow-status-shipped-shadow/40 backdrop-blur-sm font-bold rounded-lg px-3 py-1.5 text-xs'
      },
      'delivery': { 
        label: 'قيد التوصيل', 
        icon: Truck,
        color: 'bg-gradient-to-r from-status-delivery-start to-status-delivery-end text-white border border-status-delivery-border shadow-lg shadow-status-delivery-shadow/40 backdrop-blur-sm font-bold rounded-lg px-3 py-1.5 text-xs animate-pulse'
      },
      'delivered': { 
        label: 'تم التسليم', 
        icon: CheckCircle,
        color: 'bg-gradient-to-r from-status-delivered-start to-status-delivered-end text-white border border-status-delivered-border shadow-lg shadow-status-delivered-shadow/40 backdrop-blur-sm font-bold rounded-lg px-3 py-1.5 text-xs'
      },
      'completed': { 
        label: 'مكتمل', 
        icon: CheckCircle,
        color: 'bg-gradient-to-r from-status-completed-start to-status-completed-end text-white border border-status-completed-border shadow-lg shadow-status-completed-shadow/40 backdrop-blur-sm font-bold rounded-lg px-3 py-1.5 text-xs'
      },
      'returned': { 
        label: 'راجعة', 
        icon: RotateCcw,
        color: 'bg-gradient-to-r from-status-returned-start to-status-returned-end text-white border border-status-returned-border shadow-lg shadow-status-returned-shadow/40 backdrop-blur-sm font-bold rounded-lg px-3 py-1.5 text-xs'
      },
      'returned_in_stock': { 
        label: 'راجع للمخزن', 
        icon: PackageCheck,
        color: 'bg-gradient-to-r from-status-returned-stock-start to-status-returned-stock-end text-white border border-status-returned-stock-border shadow-lg shadow-status-returned-stock-shadow/40 backdrop-blur-sm font-bold rounded-lg px-3 py-1.5 text-xs'
      },
      'cancelled': { 
        label: 'ملغي', 
        icon: XCircle,
        color: 'bg-gradient-to-r from-status-cancelled-start to-status-cancelled-end text-white border border-status-cancelled-border shadow-lg shadow-status-cancelled-shadow/40 backdrop-blur-sm font-bold rounded-lg px-3 py-1.5 text-xs'
      },
      // معالجة الحالات القديمة
      'return_received': { 
        label: 'راجع للمخزن', 
        icon: PackageCheck,
        color: 'bg-gradient-to-r from-status-returned-stock-start to-status-returned-stock-end text-white border border-status-returned-stock-border shadow-lg shadow-status-returned-stock-shadow/40 backdrop-blur-sm font-bold rounded-lg px-3 py-1.5 text-xs'
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

  // تحضير معلومات المنتجات المختصرة
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
      <Card className={`overflow-hidden bg-gradient-to-br from-card to-card/95 backdrop-blur-sm transition-all duration-300 border hover:shadow-lg hover:shadow-primary/15 ${isSelected ? 'border-primary shadow-lg shadow-primary/25 ring-1 ring-primary/30' : 'border-border/50 hover:border-primary/40'}`}>
        <CardContent className="p-4">
          <div className="space-y-3">
            
            {/* Header - Compact */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onSelect?.(order.id)}
                  className="shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-base text-foreground truncate">
                      {order.tracking_number}
                    </h3>
                    <Badge className={`${deliveryBadgeColor} px-2 py-1 text-xs rounded-full`}>
                      <Building className="h-3 w-3 mr-1" />
                      {order.delivery_partner}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">
                    #{order.order_number}
                  </p>
                </div>
              </div>
              
              {/* Status Badge */}
              <div className={`flex items-center gap-1.5 shrink-0 ${statusConfig.color}`}>
                <StatusIcon className="h-3 w-3" />
                <span className="whitespace-nowrap">{statusConfig.label}</span>
              </div>
            </div>

            {/* Customer & Product Info - Single Row */}
            <div className="bg-muted/20 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="h-3 w-3 text-primary shrink-0" />
                  <span className="font-semibold text-sm text-foreground truncate">{order.customer_name}</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span className="text-xs font-medium">{formatDate(order.created_at)}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-muted-foreground min-w-0">
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

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0 text-primary" />
                <span className="truncate">{order.customer_address}</span>
              </div>
            </div>

            {/* Price - Compact */}
            <div className="bg-primary/5 rounded-lg p-2.5 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {order.delivery_fee > 0 && (
                  <span>شامل التوصيل</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-primary" />
                <span className="font-bold text-lg text-primary">
                  {order.final_amount?.toLocaleString()}
                </span>
                <span className="text-xs text-primary/70 font-semibold">د.ع</span>
              </div>
            </div>

            {/* Actions - Compact Buttons */}
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/30">
              
              {/* View Details */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewOrder?.(order)}
                className="flex items-center gap-1.5 text-xs h-8 px-3 border-primary/30 text-primary hover:bg-primary/10"
              >
                <Eye className="h-3 w-3" />
                التفاصيل
              </Button>

              {/* Edit/Delete - Only for pending orders */}
              {canEdit && hasPermission('edit_orders') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditOrder?.(order)}
                  className="flex items-center gap-1.5 text-xs h-8 px-3"
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
                  className="flex items-center gap-1.5 text-xs h-8 px-3 border-red-300 text-red-600 hover:bg-red-50"
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
                      className="flex items-center gap-1.5 text-xs h-8 px-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
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
                      className="flex items-center gap-1.5 text-xs h-8 px-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
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
                        className="flex items-center gap-1.5 text-xs h-8 px-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                      >
                        <CheckCircle className="h-3 w-3" />
                        تسليم
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange('returned')}
                        className="flex items-center gap-1.5 text-xs h-8 px-3 border-red-300 text-red-600 hover:bg-red-50"
                      >
                        <RotateCcw className="h-3 w-3" />
                        راجعة
                      </Button>
                    </>
                  )}

                  {/* Receive to Stock */}
                  {(order.status === 'cancelled' || order.status === 'returned') && hasPermission('manage_inventory') && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleStatusChange('returned_in_stock')}
                      className="flex items-center gap-1.5 text-xs h-8 px-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700"
                    >
                      <PackageCheck className="h-3 w-3" />
                      للمخزن
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* Company Order Note */}
            {!isLocalOrder && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
                <div className="flex items-center justify-center gap-2 text-blue-700">
                  <Building className="h-3 w-3" />
                  <span className="text-xs font-medium">
                    طلب شركة - لا يمكن تغيير الحالة يدوياً
                  </span>
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