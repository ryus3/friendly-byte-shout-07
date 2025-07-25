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
  
  // تحديد لون وأيقونة الحالة بالألوان الجميلة المتدرجة
  const getStatusConfig = (status) => {
    const configs = {
      'pending': { 
        label: 'قيد التجهيز', 
        icon: Package,
        color: 'bg-gradient-to-r from-status-pending-start to-status-pending-end text-white border border-status-pending-border shadow-lg shadow-status-pending-shadow/40 backdrop-blur-sm font-bold rounded-xl px-4 py-2 animate-pulse'
      },
      'shipped': { 
        label: 'تم الشحن', 
        icon: Truck,
        color: 'bg-gradient-to-r from-status-shipped-start to-status-shipped-end text-white border border-status-shipped-border shadow-lg shadow-status-shipped-shadow/40 backdrop-blur-sm font-bold rounded-xl px-4 py-2'
      },
      'delivery': { 
        label: 'قيد التوصيل', 
        icon: Truck,
        color: 'bg-gradient-to-r from-status-delivery-start to-status-delivery-end text-white border border-status-delivery-border shadow-lg shadow-status-delivery-shadow/40 backdrop-blur-sm font-bold rounded-xl px-4 py-2 animate-pulse'
      },
      'delivered': { 
        label: 'تم التسليم', 
        icon: CheckCircle,
        color: 'bg-gradient-to-r from-status-delivered-start to-status-delivered-end text-white border border-status-delivered-border shadow-lg shadow-status-delivered-shadow/40 backdrop-blur-sm font-bold rounded-xl px-4 py-2'
      },
      'completed': { 
        label: 'مكتمل', 
        icon: CheckCircle,
        color: 'bg-gradient-to-r from-status-completed-start to-status-completed-end text-white border border-status-completed-border shadow-lg shadow-status-completed-shadow/40 backdrop-blur-sm font-bold rounded-xl px-4 py-2'
      },
      'returned': { 
        label: 'راجعة', 
        icon: RotateCcw,
        color: 'bg-gradient-to-r from-status-returned-start to-status-returned-end text-white border border-status-returned-border shadow-lg shadow-status-returned-shadow/40 backdrop-blur-sm font-bold rounded-xl px-4 py-2'
      },
      'returned_in_stock': { 
        label: 'راجع للمخزن', 
        icon: PackageCheck,
        color: 'bg-gradient-to-r from-status-returned-stock-start to-status-returned-stock-end text-white border border-status-returned-stock-border shadow-lg shadow-status-returned-stock-shadow/40 backdrop-blur-sm font-bold rounded-xl px-4 py-2'
      },
      'cancelled': { 
        label: 'ملغي', 
        icon: XCircle,
        color: 'bg-gradient-to-r from-status-cancelled-start to-status-cancelled-end text-white border border-status-cancelled-border shadow-lg shadow-status-cancelled-shadow/40 backdrop-blur-sm font-bold rounded-xl px-4 py-2'
      },
      // معالجة الحالات القديمة
      'return_received': { 
        label: 'راجع للمخزن', 
        icon: PackageCheck,
        color: 'bg-gradient-to-r from-status-returned-stock-start to-status-returned-stock-end text-white border border-status-returned-stock-border shadow-lg shadow-status-returned-stock-shadow/40 backdrop-blur-sm font-bold rounded-xl px-4 py-2'
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

  // تحضير معلومات المنتجات
  const getProductSummary = () => {
    if (!order.items || order.items.length === 0) return null;
    
    const totalItems = order.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const productTypes = [...new Set(order.items.map(item => 
      item.producttype || item.product_type || 'غير محدد'
    ))];
    
    return {
      totalItems,
      productTypes: productTypes.slice(0, 2), // أول نوعين فقط
      hasMore: productTypes.length > 2
    };
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
      <Card className={`overflow-hidden bg-gradient-to-br from-card via-card to-card/95 backdrop-blur-sm transition-all duration-500 border-2 hover:shadow-xl hover:shadow-primary/15 transform hover:-translate-y-1 ${isSelected ? 'border-primary shadow-xl shadow-primary/25 ring-2 ring-primary/20' : 'border-border/40 hover:border-primary/50'}`}>
        <CardContent className="p-6">
          <div className="space-y-5">
            
            {/* Header Row - Enhanced Design */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onSelect?.(order.id)}
                  className="shrink-0 scale-110"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-xl text-foreground truncate tracking-wide">
                      {order.tracking_number}
                    </h3>
                    <Badge className={`${deliveryBadgeColor} px-3 py-1.5 text-xs font-semibold rounded-full shadow-sm`}>
                      {order.delivery_partner}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground font-medium">
                    #{order.order_number}
                  </p>
                </div>
              </div>
              
              <div className={`flex items-center gap-2 shrink-0 ${statusConfig.color}`}>
                <StatusIcon className="h-5 w-5" />
                <span className="text-sm font-semibold whitespace-nowrap">{statusConfig.label}</span>
              </div>
            </div>

            {/* Product Summary - NEW */}
            {productSummary && (
              <div className="bg-gradient-to-r from-accent/30 to-accent/20 rounded-xl p-4 border border-accent/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">
                      {productSummary.totalItems} قطعة
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {productSummary.productTypes.map((type, index) => (
                      <Badge key={index} variant="secondary" className="text-xs px-2 py-1">
                        {type}
                      </Badge>
                    ))}
                    {productSummary.hasMore && (
                      <Badge variant="outline" className="text-xs px-2 py-1">
                        +أكثر
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Customer Info - Enhanced */}
            <div className="bg-gradient-to-r from-muted/40 to-muted/20 rounded-xl p-4 space-y-3 border border-muted/30">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-foreground text-base">{order.customer_name}</h4>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm font-medium">{formatDate(order.created_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate font-medium">{order.customer_address}</span>
              </div>
              <div className="text-sm text-muted-foreground font-medium">
                {order.customer_phone}
              </div>
            </div>

            {/* Financial Summary - Enhanced */}
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="font-semibold">المجموع: {order.total_amount?.toLocaleString()} د.ع</div>
                  {order.delivery_fee > 0 && (
                    <div className="text-xs">توصيل: +{order.delivery_fee?.toLocaleString()}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <span className="font-bold text-2xl text-primary">
                      {order.final_amount?.toLocaleString()}
                    </span>
                    <span className="text-sm text-primary/70 font-semibold">د.ع</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons - Professional Layout */}
            <div className="space-y-3 pt-3 border-t-2 border-border/20">
              
              {/* Primary Actions Row */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewOrder?.(order)}
                  className="flex items-center gap-2 border-2 border-primary/30 text-primary hover:bg-primary/15 hover:border-primary/50 transition-all duration-300 font-semibold"
                >
                  <Eye className="h-4 w-4" />
                  <span>التفاصيل</span>
                </Button>

                {/* Edit/Delete - Only for pending orders and local delivery */}
                {canEdit && hasPermission('edit_orders') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEditOrder?.(order)}
                    className="flex items-center gap-2 border-2 border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-all duration-300 font-semibold"
                  >
                    <Edit2 className="h-4 w-4" />
                    <span>تعديل</span>
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
                    <span>حذف</span>
                  </Button>
                )}
              </div>

              {/* Status Change Actions - Smart buttons (only for local orders) */}
              {isLocalOrder && (
                <div className="flex flex-wrap gap-2">
                  {order.status === 'pending' && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleStatusChange('shipped')}
                      className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all duration-300 font-semibold shadow-lg"
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
                      className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 transition-all duration-300 font-semibold shadow-lg"
                    >
                      <Truck className="h-4 w-4" />
                      <span>قيد التوصيل</span>
                    </Button>
                  )}

                  {order.status === 'delivery' && (
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleStatusChange('delivered')}
                        className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 transition-all duration-300 font-semibold shadow-lg"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>تم التسليم</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange('returned')}
                        className="flex items-center gap-2 border-2 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 transition-all duration-300 font-semibold"
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span>راجعة</span>
                      </Button>
                    </div>
                  )}

                  {/* Receive to Stock - For cancelled/returned orders */}
                  {(order.status === 'cancelled' || order.status === 'returned') && hasPermission('manage_inventory') && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleStatusChange('returned_in_stock')}
                      className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-600 hover:to-cyan-700 transition-all duration-300 font-semibold shadow-lg"
                    >
                      <PackageCheck className="h-4 w-4" />
                      <span>استلام للمخزن</span>
                    </Button>
                  )}
                </div>
              )}

              {/* Note for company orders */}
              {!isLocalOrder && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Building className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      طلب شركة توصيل - لا يمكن تغيير الحالة يدوياً
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default OrderCard;