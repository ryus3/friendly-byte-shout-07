import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  ExternalLink,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/UnifiedAuthContext';

const OrderCard = ({ 
  order, 
  onSelect, 
  onView, 
  selected, 
  onUpdateStatus, 
  onDeleteOrder, 
  onEdit, 
  onReceiveReturn 
}) => {
  const { hasPermission } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Status configuration
  const getStatusConfig = (status) => {
    const configs = {
      pending: { label: 'قيد التجهيز', icon: Clock, class: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      processing: { label: 'قيد التسليم', icon: Package, class: 'bg-blue-100 text-blue-800 border-blue-200' },
      shipped: { label: 'تم الشحن', icon: Truck, class: 'bg-purple-100 text-purple-800 border-purple-200' },
      delivered: { label: 'تم التسليم', icon: CheckCircle, class: 'bg-green-100 text-green-800 border-green-200' },
      completed: { label: 'مكتمل', icon: PackageCheck, class: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
      cancelled: { label: 'ملغي', icon: XCircle, class: 'bg-red-100 text-red-800 border-red-200' },
      returned: { label: 'راجع', icon: RotateCcw, class: 'bg-orange-100 text-orange-800 border-orange-200' },
      returned_in_stock: { label: 'راجع للمخزن', icon: Package, class: 'bg-gray-100 text-gray-800 border-gray-200' }
    };
    return configs[status] || { label: status, icon: Package, class: 'bg-gray-100 text-gray-800 border-gray-200' };
  };

  const statusConfig = getStatusConfig(order.status);
  const StatusIcon = statusConfig.icon;
  
  // Delivery badge color
  const getDeliveryBadgeColor = () => {
    if (!order.delivery_partner) return 'bg-green-100 text-green-800';
    return 'bg-blue-100 text-blue-800';
  };

  // Animation variants
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    hover: { scale: 1.02, transition: { duration: 0.2 } }
  };

  // Format date and time
  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'غير محدد';
    }
  };

  const formatTime = (dateString) => {
    try {
      return new Date(dateString).toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'غير محدد';
    }
  };

  // Get product summary
  const getProductSummary = () => {
    if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
      return 'لا توجد منتجات';
    }

    const totalItems = order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    
    if (order.items.length === 1) {
      const item = order.items[0];
      const productName = item.product_name || item.name || 'منتج غير محدد';
      const variants = [];
      if (item.color_name) variants.push(item.color_name);
      if (item.size_name) variants.push(item.size_name);
      
      return `${productName}${variants.length > 0 ? ` (${variants.join(', ')})` : ''} × ${item.quantity}`;
    }

    return `${order.items.length} منتج (${totalItems} قطعة)`;
  };

  // Event handlers
  const handleStatusChange = (newStatus) => {
    if (onUpdateStatus) {
      onUpdateStatus(order.id, newStatus);
    }
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    onDeleteOrder?.(order);
    setDeleteDialogOpen(false);
  };

  const handleDelete = () => {
    if (onDeleteOrder && canDelete) {
      onDeleteOrder([order.id]);
    }
  };

  // Permission checks
  const canEdit = hasPermission('edit_orders');
  const canDelete = hasPermission('cancel_orders') || canEdit;
  const canTrack = true; // Everyone can view orders

  return (
    <>
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        whileHover="hover"
        className="w-full"
      >
        <Card className="relative overflow-hidden border-2 border-border/40 hover:border-primary/30 transition-all duration-300 shadow-sm hover:shadow-lg bg-gradient-to-br from-card to-card/90">
          {/* Selection checkbox */}
          {onSelect && (
            <div className="absolute top-3 left-3 z-10">
              <Checkbox
                checked={selected}
                onCheckedChange={(checked) => onSelect(order.id, checked)}
                className="bg-background border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
            </div>
          )}

          <CardContent className="p-4">
            <div className="grid gap-4">
              {/* Header row */}
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg text-foreground">{order.order_number}</h3>
                    <Badge className={`text-xs font-medium border ${statusConfig.class}`}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {statusConfig.label}
                    </Badge>
                  </div>
                  
                  {/* Date and time */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(order.created_at)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(order.created_at)}
                    </div>
                  </div>
                </div>

                {/* Total amount */}
                <div className="text-right">
                  <div className="text-lg font-bold text-foreground">
                    {(order.final_amount || order.total_amount || 0).toLocaleString()} د.ع
                  </div>
                  {order.discount > 0 && (
                    <div className="text-xs text-muted-foreground line-through">
                      {(order.total_amount || 0).toLocaleString()} د.ع
                    </div>
                  )}
                </div>
              </div>

              {/* Customer info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-primary" />
                    <span className="font-medium text-foreground">{order.customer_name || 'غير محدد'}</span>
                  </div>
                  
                  {order.customer_phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <span dir="ltr">{order.customer_phone}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {(order.customer_city || order.customer_province) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{[order.customer_city, order.customer_province].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  
                  {order.customer_address && (
                    <div className="text-xs text-muted-foreground truncate" title={order.customer_address}>
                      {order.customer_address}
                    </div>
                  )}
                </div>
              </div>

              {/* Products summary */}
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-primary" />
                  <span className="font-medium text-foreground">{getProductSummary()}</span>
                </div>
              </div>

              {/* Delivery info */}
              <div className="flex justify-between items-center">
                <Badge className={`text-xs ${getDeliveryBadgeColor()}`}>
                  {order.delivery_partner ? (
                    <div className="flex items-center gap-1">
                      <Building className="w-3 h-3" />
                      {order.delivery_partner}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Truck className="w-3 h-3" />
                      توصيل محلي
                    </div>
                  )}
                </Badge>

                {order.tracking_number && (
                  <div className="text-xs text-muted-foreground font-mono">
                    #{order.tracking_number}
                  </div>
                )}
              </div>

              {/* Company order notes */}
              {order.qr_id && order.status !== 'pending' && (
                <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                  طلب شركة • {order.qr_id}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                <div className="flex gap-2">
                  {/* View */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onView?.(order)}
                    className="h-8 w-8 p-0 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 hover:scale-110 transition-all duration-300 shadow-md"
                    title="عرض التفاصيل"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>

                  {/* Edit - فقط للطلبات قيد التجهيز */}
                  {order.status === 'pending' && canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit?.(order)}
                      className="h-8 w-8 p-0 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 hover:scale-110 transition-all duration-300 shadow-md"
                      title="تعديل"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {/* Delete - للطلبات قيد التجهيز فقط */}
                  {order.status === 'pending' && (hasPermission('cancel_orders') || canEdit) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDeleteClick}
                      className="h-8 w-8 p-0 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 hover:scale-110 transition-all duration-300 shadow-md"
                      title="حذف الطلب"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {/* Track */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onView?.(order)}
                    className="h-8 w-8 p-0 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-600 hover:scale-110 transition-all duration-300 shadow-md"
                    title="تتبع"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* رسالة تأكيد الحذف */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              تأكيد حذف الطلب
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>هل أنت متأكد من حذف الطلب <strong>{order.order_number}</strong>؟</p>
              <p className="text-sm text-muted-foreground">
                سيتم إرجاع المخزون المحجوز إلى المخزون المتاح فوراً ولا يمكن التراجع عن هذا الإجراء.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                <div className="flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">تنبيه:</span>
                </div>
                <p className="text-sm text-amber-700 mt-1">
                  العميل: {order.customer_name} • القيمة: {(order.final_amount || order.total_amount || 0).toLocaleString()} د.ع
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary">إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              حذف الطلب نهائياً
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default OrderCard;