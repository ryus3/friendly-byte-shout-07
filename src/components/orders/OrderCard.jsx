import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Edit2, 
  Trash2, 
  Eye, 
  Package, 
  Truck, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  RotateCcw,
  PackageCheck
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import OrderStatusBadge from '@/components/ui/order-status-badge';

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
  
  // تحديد لون وأيقونة الحالة الموحدة
  const getStatusConfig = (status) => {
    const configs = {
      'pending': { 
        label: 'قيد التجهيز', 
        icon: Package,
        color: 'bg-blue-50 text-blue-700 border-blue-200'
      },
      'shipped': { 
        label: 'تم الشحن', 
        icon: Truck,
        color: 'bg-orange-50 text-orange-700 border-orange-200'
      },
      'needs_processing': { 
        label: 'تحتاج معالجة', 
        icon: AlertCircle,
        color: 'bg-red-50 text-red-700 border-red-200'
      },
      'delivered': { 
        label: 'تم التوصيل', 
        icon: CheckCircle,
        color: 'bg-green-50 text-green-700 border-green-200'
      },
      'returned': { 
        label: 'راجع', 
        icon: RotateCcw,
        color: 'bg-orange-50 text-orange-700 border-orange-200'
      },
      'cancelled': { 
        label: 'ملغي', 
        icon: XCircle,
        color: 'bg-red-50 text-red-700 border-red-200'
      },
      'return_received': { 
        label: 'مستلم الراجع', 
        icon: PackageCheck,
        color: 'bg-purple-50 text-purple-700 border-purple-200'
      }
    };
    return configs[status] || configs['pending'];
  };

  const statusConfig = getStatusConfig(order.status);
  const StatusIcon = statusConfig.icon;
  
  // تحديد نوع التوصيل
  const isLocalOrder = order.delivery_partner === 'محلي';
  const deliveryBadgeColor = isLocalOrder ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700';

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

  return (
    <motion.div 
      variants={cardVariants} 
      initial="rest" 
      whileHover="hover" 
      transition={{ duration: 0.2 }}
      className="w-full"
    >
      <Card className={`overflow-hidden bg-card/90 backdrop-blur-sm transition-all duration-300 border-2 hover:bg-card/95 hover:shadow-lg ${isSelected ? 'border-primary' : 'border-transparent hover:border-primary/20'}`}>
        <CardContent className="p-4">
          <div className="flex flex-col space-y-3">
            
            {/* رأس الطلب مع التحديد */}
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onSelect?.(order.id)}
                  className="mt-1"
                />
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <h3 className="font-semibold text-lg">{order.tracking_number}</h3>
                    <Badge className="bg-green-100 text-green-800 border-green-200" variant="outline">
                      {order.delivery_partner}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    رقم الطلب: {order.order_number}
                  </p>
                </div>
              </div>
              
              <OrderStatusBadge status={order.status} size="sm" />
            </div>

            {/* معلومات الزبون */}
            <div className="space-y-1">
              <p className="font-medium">{order.customer_name}</p>
              <p className="text-sm text-muted-foreground">{order.customer_phone}</p>
              <p className="text-sm text-muted-foreground">{order.customer_address}</p>
            </div>

            {/* المبالغ */}
            <div className="flex justify-between items-center pt-2 border-t">
              <div className="text-sm text-muted-foreground">
                المجموع: {order.total_amount?.toLocaleString()} د.ع
                {order.delivery_fee > 0 && (
                  <span className="mx-1">+ توصيل: {order.delivery_fee?.toLocaleString()}</span>
                )}
              </div>
              <div className="font-semibold text-lg">
                {order.final_amount?.toLocaleString()} د.ع
              </div>
            </div>

            {/* أزرار الإجراءات */}
            <div className="flex flex-wrap gap-2 pt-2">
              
              {/* عرض التفاصيل */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewOrder?.(order)}
                className="flex items-center space-x-1 rtl:space-x-reverse"
              >
                <Eye className="h-4 w-4" />
                <span>التفاصيل</span>
              </Button>

              {/* تعديل (فقط في حالة قيد التجهيز) */}
              {canEdit && hasPermission('edit_orders') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditOrder?.(order)}
                  className="flex items-center space-x-1 rtl:space-x-reverse"
                >
                  <Edit2 className="h-4 w-4" />
                  <span>تعديل</span>
                </Button>
              )}

              {/* حذف (فقط في حالة قيد التجهيز) */}
              {canDelete && hasPermission('delete_orders') && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  className="flex items-center space-x-1 rtl:space-x-reverse"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>حذف</span>
                </Button>
              )}

              {/* تغيير الحالة - أزرار سريعة */}
              {order.status === 'pending' && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleStatusChange('shipped')}
                  className="flex items-center space-x-1 rtl:space-x-reverse bg-orange-600 hover:bg-orange-700"
                >
                  <Truck className="h-4 w-4" />
                  <span>شحن</span>
                </Button>
              )}

              {order.status === 'shipped' && (
                <>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleStatusChange('needs_processing')}
                    className="flex items-center space-x-1 rtl:space-x-reverse"
                  >
                    <AlertCircle className="h-4 w-4" />
                    <span>يحتاج معالجة</span>
                  </Button>
                  
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleStatusChange('delivered')}
                    className="flex items-center space-x-1 rtl:space-x-reverse bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>تم التوصيل</span>
                  </Button>
                </>
              )}

              {order.status === 'needs_processing' && (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleStatusChange('shipped')}
                    className="flex items-center space-x-1 rtl:space-x-reverse bg-orange-600 hover:bg-orange-700"
                  >
                    <Truck className="h-4 w-4" />
                    <span>إعادة الشحن</span>
                  </Button>
                  
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleStatusChange('delivered')}
                    className="flex items-center space-x-1 rtl:space-x-reverse bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>تم التوصيل</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange('returned')}
                    className="flex items-center space-x-1 rtl:space-x-reverse"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>راجع</span>
                  </Button>
                  </>
              )}

              {/* استلام الراجع */}
              {order.status === 'returned' && hasPermission('manage_inventory') && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onReceiveReturn?.(order)}
                  className="flex items-center space-x-1 rtl:space-x-reverse bg-purple-600 hover:bg-purple-700"
                >
                  <PackageCheck className="h-4 w-4" />
                  <span>استلام الراجع</span>
                </Button>
              )}
            </div>

            {/* تاريخ الإنشاء */}
            <div className="text-xs text-muted-foreground pt-1 border-t">
              تم الإنشاء: {new Date(order.created_at).toLocaleDateString('ar-IQ', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default OrderCard;