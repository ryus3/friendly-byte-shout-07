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
  Clock,
  ExternalLink
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
  
  // تحديد لون وأيقونة الحالة
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
    'bg-emerald-500/10 text-emerald-700 border border-emerald-300/50' : 
    'bg-blue-500/10 text-blue-700 border border-blue-300/50';

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
    rest: { scale: 1, y: 0 },
    hover: { scale: 1.02, y: -4 },
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
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
      transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
      className="w-full"
    >
      <Card className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card/95 to-card/90
                       border-2 transition-all duration-500 ease-out
                       shadow-xl shadow-black/10 hover:shadow-2xl hover:shadow-primary/25
                       dark:shadow-white/5 dark:hover:shadow-primary/15
                       ${isSelected ? 'border-primary ring-4 ring-primary/20 shadow-2xl shadow-primary/30' : 'border-border/30 hover:border-primary/50'}`}>
        
        {/* خلفية متدرجة عالمية */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-all duration-500" />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-purple-500 to-blue-500 opacity-60" />
        
        <CardContent className="relative p-6">
          <div className="space-y-5">
            
            {/* Header العالمي */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onSelect?.(order.id)}
                  className="shrink-0 scale-125 border-2"
                />
                <div className="space-y-1">
                  <h3 className="font-black text-xl text-foreground tracking-wide bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                    {order.tracking_number}
                  </h3>
                  <p className="text-sm text-muted-foreground font-semibold">
                    طلب #{order.order_number}
                  </p>
                </div>
              </div>
              
              {/* Status Badge عالمي */}
              <div className={`flex items-center gap-2 ${statusConfig.color} transform group-hover:scale-105 transition-transform duration-300`}>
                <StatusIcon className="h-4 w-4" />
                <span className="font-bold">{statusConfig.label}</span>
              </div>
            </div>

            {/* Customer Info مع الأيقونات في المنتصف */}
            <div className="bg-gradient-to-r from-muted/20 via-muted/10 to-transparent rounded-2xl p-5 border border-muted/30 relative">
              <div className="grid grid-cols-3 gap-4 items-center">
                
                {/* Customer Info - يسار */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    <span className="font-bold text-foreground text-sm">{order.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{order.customer_phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 text-primary" />
                    <span className="truncate">{order.customer_address}</span>
                  </div>
                </div>
                
                {/* Action Icons - منتصف */}
                <div className="flex items-center justify-center gap-2">
                  
                  {/* View */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewOrder?.(order)}
                    className="h-10 w-10 p-0 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary hover:scale-110 transition-all duration-300 shadow-lg"
                    title="معاينة"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>

                  {/* Edit */}
                  {canEdit && hasPermission('edit_orders') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditOrder?.(order)}
                      className="h-10 w-10 p-0 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 hover:scale-110 transition-all duration-300 shadow-lg"
                      title="تعديل"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}

                  {/* Track */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewOrder?.(order)}
                    className="h-10 w-10 p-0 rounded-xl bg-green-50 hover:bg-green-100 text-green-600 hover:scale-110 transition-all duration-300 shadow-lg"
                    title="تتبع"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>

                  {/* Delete */}
                  {canDelete && hasPermission('delete_orders') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDelete}
                      className="h-10 w-10 p-0 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 hover:scale-110 transition-all duration-300 shadow-lg"
                      title="حذف"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                {/* Date & Delivery Info - يمين */}
                <div className="space-y-2 text-left">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-sm font-bold text-foreground">{formatDate(order.created_at)}</span>
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-xs text-muted-foreground">{formatTime(order.created_at)}</span>
                    <Clock className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <Badge className={`${deliveryBadgeColor} px-3 py-1 text-xs rounded-full font-bold w-fit ml-auto shadow-sm`}>
                    <Building className="h-3 w-3 ml-1" />
                    {order.delivery_partner}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Product & Price مضغوط */}
            <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-4 border border-primary/20">
              <div className="flex items-center justify-between">
                {productSummary && (
                  <div className="flex items-center gap-2 text-primary font-bold">
                    <Package className="h-4 w-4" />
                    <span className="text-sm">{productSummary.totalItems} {productSummary.firstProductType}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <span className="font-bold text-lg text-primary">
                    {order.final_amount?.toLocaleString()}
                  </span>
                  <span className="text-xs text-primary/70 font-bold">د.ع</span>
                </div>
              </div>
              {order.delivery_fee > 0 && (
                <div className="text-xs text-muted-foreground mt-1 text-center">
                  شامل التوصيل (+{order.delivery_fee?.toLocaleString()} د.ع)
                </div>
              )}
            </div>

            {/* Status Actions للطلبات المحلية فقط */}
            {isLocalOrder && (
              <div className="flex flex-wrap gap-2 pt-3 border-t border-border/30">
                {order.status === 'pending' && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleStatusChange('shipped')}
                    className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 transition-all duration-300 font-bold shadow-lg hover:shadow-xl"
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
                    className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 transition-all duration-300 font-bold shadow-lg hover:shadow-xl"
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
                      className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 transition-all duration-300 font-bold shadow-lg hover:shadow-xl"
                    >
                      <CheckCircle className="h-4 w-4" />
                      تم التسليم
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange('returned')}
                      className="flex items-center gap-2 border-2 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 transition-all duration-300 font-bold"
                    >
                      <RotateCcw className="h-4 w-4" />
                      راجعة
                    </Button>
                  </>
                )}

                {(order.status === 'cancelled' || order.status === 'returned') && hasPermission('manage_inventory') && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleStatusChange('returned_in_stock')}
                    className="flex items-center gap-2 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 transition-all duration-300 font-bold shadow-lg hover:shadow-xl"
                  >
                    <PackageCheck className="h-4 w-4" />
                    استلام للمخزن
                  </Button>
                )}
              </div>
            )}

            {/* Company Order Note */}
            {!isLocalOrder && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300/50 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-2 text-blue-700">
                  <Building className="h-4 w-4" />
                  <span className="text-sm font-bold">
                    طلب شركة توصيل - حالة ثابتة
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