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
  AlertCircle, 
  CheckCircle, 
  XCircle,
  RotateCcw,
  PackageCheck,
  User,
  Phone,
  MapPin,
  DollarSign
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
  
  // تحديد لون وأيقونة الحالة الموحدة مع ألوان الأدوار الجميلة
  const getStatusConfig = (status) => {
    const configs = {
      'pending': { 
        label: 'قيد التجهيز', 
        icon: Package,
        color: 'bg-[hsl(var(--status-pending)_/_0.2)] text-[hsl(var(--status-pending))] border-[hsl(var(--status-pending)_/_0.3)]'
      },
      'processing': { 
        label: 'قيد المعالجة', 
        icon: Package,
        color: 'bg-[hsl(var(--status-processing)_/_0.2)] text-[hsl(var(--status-processing))] border-[hsl(var(--status-processing)_/_0.3)]'
      },
      'shipped': { 
        label: 'تم الشحن', 
        icon: Truck,
        color: 'bg-[hsl(var(--status-shipped)_/_0.2)] text-[hsl(var(--status-shipped))] border-[hsl(var(--status-shipped)_/_0.3)]'
      },
      'delivery': { 
        label: 'قيد التوصيل', 
        icon: Truck,
        color: 'bg-[hsl(var(--status-delivery)_/_0.2)] text-[hsl(var(--status-delivery))] border-[hsl(var(--status-delivery)_/_0.3)]'
      },
      'needs_processing': { 
        label: 'تحتاج معالجة', 
        icon: AlertCircle,
        color: 'bg-[hsl(var(--status-processing)_/_0.2)] text-[hsl(var(--status-processing))] border-[hsl(var(--status-processing)_/_0.3)]'
      },
      'delivered': { 
        label: 'تم التوصيل', 
        icon: CheckCircle,
        color: 'bg-[hsl(var(--status-delivered)_/_0.2)] text-[hsl(var(--status-delivered))] border-[hsl(var(--status-delivered)_/_0.3)]'
      },
      'returned': { 
        label: 'راجع', 
        icon: RotateCcw,
        color: 'bg-[hsl(var(--status-returned)_/_0.2)] text-[hsl(var(--status-returned))] border-[hsl(var(--status-returned)_/_0.3)]'
      },
      'cancelled': { 
        label: 'ملغي', 
        icon: XCircle,
        color: 'bg-[hsl(var(--status-cancelled)_/_0.2)] text-[hsl(var(--status-cancelled))] border-[hsl(var(--status-cancelled)_/_0.3)]'
      },
      'return_received': { 
        label: 'تم الإرجاع للمخزن', 
        icon: PackageCheck,
        color: 'bg-red-900/20 text-red-100 border-red-800/30'
      },
      'returned_in_stock': { 
        label: 'تم الإرجاع للمخزن', 
        icon: PackageCheck,
        color: 'bg-red-900/20 text-red-100 border-red-800/30'
      }
    };
    return configs[status] || { 
      label: 'تم الإرجاع للمخزن', 
      icon: PackageCheck,
      color: 'bg-red-900/20 text-red-100 border-red-800/30'
    };
  };

  const statusConfig = getStatusConfig(order.status);
  const StatusIcon = statusConfig.icon;

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
      className="w-full"
    >
      <Card className="overflow-hidden hover:shadow-md transition-all duration-200 border-l-4 border-l-primary">
        <CardContent className="p-4">
          {/* العنوان والمعرف */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg">
                #{order.id || 'غير محدد'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {order.trackingnumber ? `رقم التتبع: ${order.trackingnumber}` : 'بدون رقم تتبع'}
              </p>
            </div>
            <div className="text-left">
              <p className="font-bold text-lg text-primary">
                {(order.final_amount || 0).toLocaleString()} د.ع
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(order.created_at).toLocaleDateString('ar-IQ')}
              </p>
            </div>
          </div>

          {/* معلومات العميل */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {order.customerinfo?.name || 'غير محدد'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm" dir="ltr">
                {order.customerinfo?.phone || 'غير محدد'}
              </span>
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {order.customerinfo?.address || 'غير محدد'}
              </span>
            </div>
          </div>

          {/* معلومات التوصيل والحالة */}
          <div className="space-y-4">
            {/* حالة الطلب */}
            <div className="flex items-center gap-3">
              <StatusIcon className="h-5 w-5" />
              <Badge className={`${statusConfig.color} border font-medium px-3 py-1.5`}>
                {statusConfig.label}
              </Badge>
            </div>

            {/* معلومات التوصيل */}
            <div className="flex items-center gap-4 text-sm">
              <div className="delivery-local flex items-center gap-2 px-3 py-2 rounded-lg">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                  <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z"/>
                </svg>
                <span className="font-semibold">محلي</span>
              </div>
              <div className="delivery-partner flex items-center gap-2 px-3 py-2 rounded-lg">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                  <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                </svg>
                <span className="font-semibold">{order.delivery_partner || 'شركة التوصيل'}</span>
              </div>
            </div>
          </div>

          {/* منتجات الطلب */}
          {order.orderItems && order.orderItems.length > 0 && (
            <div className="mt-4 p-3 bg-secondary/30 rounded-lg">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Package className="h-4 w-4" />
                المنتجات ({order.orderItems.length})
              </h4>
              <div className="space-y-1">
                {order.orderItems.slice(0, 3).map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>{item.product?.name || 'منتج غير محدد'}</span>
                    <span className="font-medium">{item.quantity}x</span>
                  </div>
                ))}
                {order.orderItems.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    + {order.orderItems.length - 3} منتجات أخرى
                  </p>
                )}
              </div>
            </div>
          )}

          {/* القسم السفلي - الإجراءات */}
          <div className="pt-4 border-t mt-4">
            <div className="flex items-center justify-between mb-4">
              {/* اختيار للحذف/الأرشفة */}
              {(hasPermission('delete_orders') || hasPermission('archive_orders')) && onSelect && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`order-${order.id}`}
                    checked={isSelected}
                    onCheckedChange={() => onSelect(order.id)}
                  />
                  <label htmlFor={`order-${order.id}`} className="text-sm font-medium">
                    تحديد
                  </label>
                </div>
              )}
              
              {/* أزرار الإجراءات الأساسية */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => onViewOrder?.(order)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all duration-200 hover:scale-105"
                  title="عرض التفاصيل"
                >
                  <Eye className="h-4 w-4" />
                  <span className="text-xs font-medium">معاينة</span>
                </button>
                <button 
                  onClick={() => onViewOrder?.(order)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-all duration-200 hover:scale-105"
                  title="تتبع الطلب"
                >
                  <Truck className="h-4 w-4" />
                  <span className="text-xs font-medium">تتبع</span>
                </button>
                {(order.status === 'pending' || order.status === 'processing') && (
                  <>
                    <button 
                      onClick={() => onEditOrder?.(order)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 transition-all duration-200 hover:scale-105"
                      title="تعديل الطلب"
                    >
                      <Edit2 className="h-4 w-4" />
                      <span className="text-xs font-medium">تعديل</span>
                    </button>
                    <button 
                      onClick={handleDelete}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all duration-200 hover:scale-105"
                      title="حذف الطلب"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="text-xs font-medium">حذف</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default OrderCard;