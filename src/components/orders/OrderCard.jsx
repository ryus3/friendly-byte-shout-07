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
  User,
  Clock
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
  
  // تحديد لون وأيقونة الحالة بالألوان المتناسقة والمحدثة
  const getStatusConfig = (status) => {
    const configs = {
      'pending': { 
        label: 'قيد التجهيز', 
        icon: Package,
        color: 'bg-gradient-to-r from-status-pending-start to-status-pending-end text-white border border-status-pending-border shadow-lg shadow-status-pending-shadow/40 font-bold rounded-lg px-3 py-1.5 text-xs'
      },
      'shipped': { 
        label: 'تم الشحن', 
        icon: Truck,
        color: 'bg-gradient-to-r from-status-shipped-start to-status-shipped-end text-white border border-status-shipped-border shadow-lg shadow-status-shipped-shadow/40 font-bold rounded-lg px-3 py-1.5 text-xs'
      },
      'delivery': { 
        label: 'قيد التوصيل', 
        icon: Truck,
        color: 'bg-gradient-to-r from-status-delivery-start to-status-delivery-end text-white border border-status-delivery-border shadow-lg shadow-status-delivery-shadow/40 font-bold rounded-lg px-3 py-1.5 text-xs'
      },
      'delivered': { 
        label: 'تم التسليم', 
        icon: CheckCircle,
        color: 'bg-gradient-to-r from-status-delivered-start to-status-delivered-end text-white border border-status-delivered-border shadow-lg shadow-status-delivered-shadow/40 font-bold rounded-lg px-3 py-1.5 text-xs'
      },
      'completed': { 
        label: 'مكتمل', 
        icon: CheckCircle,
        color: 'bg-gradient-to-r from-status-completed-start to-status-completed-end text-white border border-status-completed-border shadow-lg shadow-status-completed-shadow/40 font-bold rounded-lg px-3 py-1.5 text-xs'
      },
      'returned': { 
        label: 'راجعة', 
        icon: RotateCcw,
        color: 'bg-gradient-to-r from-status-returned-start to-status-returned-end text-white border border-status-returned-border shadow-lg shadow-status-returned-shadow/40 font-bold rounded-lg px-3 py-1.5 text-xs'
      },
      'returned_in_stock': { 
        label: 'راجع للمخزن', 
        icon: PackageCheck,
        color: 'bg-gradient-to-r from-status-returned-stock-start to-status-returned-stock-end text-white border border-status-returned-stock-border shadow-lg shadow-status-returned-stock-shadow/40 font-bold rounded-lg px-3 py-1.5 text-xs'
      },
      'cancelled': { 
        label: 'ملغي', 
        icon: XCircle,
        color: 'bg-gradient-to-r from-status-cancelled-start to-status-cancelled-end text-white border border-status-cancelled-border shadow-lg shadow-status-cancelled-shadow/40 font-bold rounded-lg px-3 py-1.5 text-xs'
      },
      'return_received': { 
        label: 'راجع للمخزن', 
        icon: PackageCheck,
        color: 'bg-gradient-to-r from-status-returned-stock-start to-status-returned-stock-end text-white border border-status-returned-stock-border shadow-lg shadow-status-returned-stock-shadow/40 font-bold rounded-lg px-3 py-1.5 text-xs'
      }
    };
    return configs[status] || configs['pending'];
  };

  const statusConfig = getStatusConfig(order.status);
  const StatusIcon = statusConfig.icon;
  
  // تحديد نوع التوصيل
  const isLocalOrder = order.delivery_partner === 'محلي';
  const deliveryBadgeColor = isLocalOrder ? 
    'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm' : 
    'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm';

  // التحقق من الصلاحيات - قيد التجهيز فقط
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
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ar-IQ', {
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
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      <Card className={`group relative overflow-hidden rounded-xl bg-card 
                       shadow-lg shadow-black/10 
                       hover:shadow-xl hover:shadow-primary/20 
                       hover:border-primary/30 
                       transition-all duration-300 ease-out
                       dark:bg-card dark:shadow-white/5 dark:hover:shadow-primary/10
                       ${isSelected ? 'border-primary shadow-xl shadow-primary/25 ring-2 ring-primary/20' : 'border-border/50'}`}>
        
        {/* خلفية متدرجة جميلة */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <CardContent className="relative p-5">
          <div className="space-y-4">
            
            {/* Header - مثل فواتير المشتريات */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onSelect?.(order.id)}
                  className="shrink-0 scale-110"
                />
                <div>
                  <h3 className="font-bold text-lg text-foreground tracking-wide">
                    {order.tracking_number}
                  </h3>
                  <p className="text-sm text-muted-foreground font-medium">
                    طلب #{order.order_number}
                  </p>
                </div>
              </div>
              
              {/* Status Badge في الأعلى */}
              <div className={`flex items-center gap-2 ${statusConfig.color}`}>
                <StatusIcon className="h-4 w-4" />
                <span className="font-semibold">{statusConfig.label}</span>
              </div>
            </div>

            {/* Customer & Date Info */}
            <div className="bg-gradient-to-r from-muted/30 to-muted/10 rounded-xl p-4 border border-muted/20">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    <span className="font-bold text-foreground">{order.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{order.customer_phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3 text-primary" />
                    <span className="truncate">{order.customer_address}</span>
                  </div>
                </div>
                
                <div className="space-y-2 text-left">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-sm font-semibold text-foreground">{formatDate(order.created_at)}</span>
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-sm text-muted-foreground">{formatTime(order.created_at)}</span>
                    <Clock className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <Badge className={`${deliveryBadgeColor} px-3 py-1 text-xs rounded-full font-semibold w-fit ml-auto`}>
                    <Building className="h-3 w-3 ml-1" />
                    {order.delivery_partner}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Product & Price Summary */}
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  {productSummary && (
                    <div className="flex items-center gap-2 text-primary font-bold">
                      <Package className="h-4 w-4" />
                      <span>{productSummary.totalItems} قطعة - {productSummary.firstProductType}</span>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {order.delivery_fee > 0 ? `شامل التوصيل (+${order.delivery_fee?.toLocaleString()} د.ع)` : 'بدون رسوم توصيل'}
                  </div>
                </div>
                
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <span className="font-bold text-2xl text-primary">
                      {order.final_amount?.toLocaleString()}
                    </span>
                    <span className="text-sm text-primary/70 font-bold">د.ع</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons - منظمة بشكل احترافي */}
            <div className="flex flex-wrap gap-2 pt-3 border-t-2 border-border/20">
              
              {/* Primary Actions */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewOrder?.(order)}
                className="flex items-center gap-2 border-2 border-primary/30 text-primary hover:bg-primary/15 hover:border-primary/50 transition-all duration-300 font-semibold"
              >
                <Eye className="h-4 w-4" />
                معاينة
              </Button>

              {/* Edit/Delete - فقط في حالة قيد التجهيز */}
              {canEdit && hasPermission('edit_orders') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditOrder?.(order)}
                  className="flex items-center gap-2 border-2 border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-all duration-300 font-semibold"
                >
                  <Edit2 className="h-4 w-4" />
                  تعديل
                </Button>
              )}

              {canDelete && hasPermission('delete_orders') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  className="flex items-center gap-2 border-2 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 transition-all duration-300 font-semibold"
                >
                  <Trash2 className="h-4 w-4" />
                  حذف
                </Button>
              )}

              {/* Status Actions - للطلبات المحلية فقط */}
              {isLocalOrder && (
                <>
                  {order.status === 'pending' && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleStatusChange('shipped')}
                      className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 transition-all duration-300 font-semibold shadow-lg"
                    >
                      <Truck className="h-4 w-4" />
                      شحن
                    </Button>
                  )}

                  {order.status === 'shipped' && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleStatusChange('delivery')}
                      className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 transition-all duration-300 font-semibold shadow-lg"
                    >
                      <Truck className="h-4 w-4" />
                      قيد التوصيل
                    </Button>
                  )}

                  {order.status === 'delivery' && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleStatusChange('delivered')}
                        className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 transition-all duration-300 font-semibold shadow-lg"
                      >
                        <CheckCircle className="h-4 w-4" />
                        تم التسليم
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange('returned')}
                        className="flex items-center gap-2 border-2 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 transition-all duration-300 font-semibold"
                      >
                        <RotateCcw className="h-4 w-4" />
                        راجعة
                      </Button>
                    </>
                  )}

                  {/* استلام للمخزن */}
                  {(order.status === 'cancelled' || order.status === 'returned') && hasPermission('manage_inventory') && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleStatusChange('returned_in_stock')}
                      className="flex items-center gap-2 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 transition-all duration-300 font-semibold shadow-lg"
                    >
                      <PackageCheck className="h-4 w-4" />
                      استلام للمخزن
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* Company Order Note */}
            {!isLocalOrder && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-2 text-blue-700">
                  <Building className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    طلب شركة توصيل - لا يمكن تغيير الحالة يدوياً
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