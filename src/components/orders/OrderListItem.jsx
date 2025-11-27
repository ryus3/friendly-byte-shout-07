import React, { useState } from 'react';
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
  ExternalLink,
  Phone,
  User,
  MapPin,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { MobileTableRow, MobileTableCell, MobileTableGrid } from '@/components/ui/mobile-table';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import DeleteConfirmationDialog from '@/components/ui/delete-confirmation-dialog';
import { getStatusForComponent } from '@/lib/order-status-translator';
import { canDeleteOrder } from '@/lib/order-deletion-utils';
import ScrollingText from '@/components/ui/scrolling-text';

const OrderListItem = ({ 
  order, 
  onViewOrder, 
  onSelect, 
  isSelected, 
  onUpdateStatus, 
  onDeleteOrder, 
  onEditOrder,
  calculateProfit,
  profits,
  showEmployeeName = false
}) => {
  const { hasPermission } = useAuth();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // حساب ربح الموظف وحالة التسوية
  const profitRecord = profits?.find(p => p.order_id === order.id);
  const employeeProfit = calculateProfit ? 
    (order.items || []).reduce((sum, item) => sum + calculateProfit(item, order.created_by), 0) : 0;
  const isSettled = profitRecord?.settled_at ? true : false;
  
  // دالة تحديد ما إذا كان الطلب قابل للتعديل/الحذف (قبل الاستلام من المندوب)
  const isBeforePickup = (order) => {
    // طلبات محلية: فقط pending
    if (isLocalOrder) {
      return order.status === 'pending';
    }
    
    // طلبات خارجية: فعال أو في انتظار استلام المندوب
    const deliveryStatus = order.delivery_status?.toLowerCase() || '';
    return deliveryStatus.includes('فعال') || 
           deliveryStatus.includes('في انتظار استلام المندوب') ||
           deliveryStatus.includes('active');
  };


  // تحديد نوع الطلب بناءً على tracking_number
  const isLocalOrder = !order.tracking_number || order.tracking_number.startsWith('RYUS-') || order.delivery_partner === 'محلي';
  
  // استخدام النظام الموحد للحالات
  const statusConfig = getStatusForComponent(order);
  const StatusIcon = statusConfig.icon;
  const deliveryBadgeColor = isLocalOrder ? 
    'bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 text-white border border-emerald-300/50 shadow-lg shadow-emerald-400/40 font-bold' : 
    'bg-gradient-to-r from-blue-400 via-blue-500 to-cyan-500 text-white border border-blue-300/50 shadow-lg shadow-blue-400/40 font-bold';

  // التحقق من الصلاحيات مع النظام الجديد
  const canEdit = React.useMemo(() => {
    if (isLocalOrder) {
      return order.status === 'pending';
    } else {
      // للطلبات الخارجية، استخدم النظام الجديد
      return order.status === 'pending';
    }
  }, [isLocalOrder, order.status]);

  const canDelete = React.useMemo(() => {
    return canDeleteOrder(order);
  }, [order]);

  const handleStatusChange = (newStatus) => {
    if (onUpdateStatus) {
      onUpdateStatus(order.id, newStatus);
    }
  };

  const handleDelete = () => {
    if (onDeleteOrder && canDelete) {
      onDeleteOrder([order.id]); // تمرير array كما هو متوقع
    }
    setShowDeleteDialog(false);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const isMobile = useMediaQuery('(max-width: 768px)');

  if (isMobile) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        <MobileTableRow 
          className={isSelected ? 'border-primary shadow-md shadow-primary/20 bg-primary/5' : ''}
          onClick={() => onViewOrder?.(order)}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect?.(order.id)}
                onClick={(e) => e.stopPropagation()}
                className="shrink-0"
              />
              <div className="text-right">
                <div className="font-bold text-base text-foreground tabular-nums" dir="ltr">
                  {order.tracking_number || order.order_number}
                </div>
              </div>
            </div>
            
            {/* Status Badge - يمين */}
            {isLocalOrder && order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'returned_in_stock' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  const nextStatus = {
                    'pending': 'shipped',
                    'shipped': 'delivery', 
                    'delivery': 'delivered',
                    'delivered': 'completed',
                    'returned': 'returned_in_stock'
                  }[order.status];
                  if (nextStatus) handleStatusChange(nextStatus);
                }}
                className={`${statusConfig.color} hover:shadow-md transition-all duration-300 h-auto p-2 max-w-[160px]`}
                title="انقر لتحديث الحالة"
              >
                <StatusIcon className="h-4 w-4" />
                <span className="ml-1 text-xs">{statusConfig.label}</span>
              </Button>
            ) : (
              <div className={`flex items-center gap-1 ${statusConfig.color} max-w-[160px]`}>
                <StatusIcon className="h-4 w-4 flex-shrink-0" />
                <ScrollingText text={statusConfig.label} className="text-xs min-w-0 flex-1" />
              </div>
            )}
          </div>

          {/* Customer Info */}
          <MobileTableCell primary>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span>{order.customer_name}</span>
            </div>
          </MobileTableCell>

          {/* Employee name */}
          {order.created_by_name && (
            <MobileTableCell secondary>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary bg-gradient-to-r from-primary/10 to-primary/20 px-2 py-1 rounded-full border border-primary/20">
                  <User className="h-3 w-3 inline-block ml-1" />
                  {order.created_by_name}
                </span>
              </div>
            </MobileTableCell>
          )}

          <MobileTableCell secondary>
            <div className="flex items-center gap-2">
              <Phone className="h-3 w-3" />
              <span>{order.customer_phone}</span>
            </div>
          </MobileTableCell>

          {/* Products Summary */}
          <MobileTableCell label="المنتجات">
            {(() => {
              const items = order.items || order.order_items || [];
              if (items.length === 0) return 'لا توجد منتجات';
              
              // تصفية العناصر null/undefined وحساب المجموع بأمان
              const validItems = (items || []).filter(item => item != null && typeof item === 'object');
              const totalItems = validItems.reduce((sum, item) => sum + (Number(item?.quantity) || 1), 0);
              
              if (validItems.length === 1) {
                const item = validItems[0];
                const productName = item.productname || item.product_name || item.producttype || item.product_type || 'منتج';
                return `${productName} (${item.quantity || 1})`;
              } else {
                const firstProductType = items[0]?.producttype || items[0]?.product_type || 'منتج';
                return `${totalItems} قطعة - ${firstProductType}`;
              }
            })()}
          </MobileTableCell>

          <MobileTableGrid>
            <MobileTableCell label="التاريخ">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span className="text-xs">{formatDate(order.created_at)}</span>
              </div>
            </MobileTableCell>

            <MobileTableCell label="المبلغ">
              <span className="font-bold text-primary">
                {`${Number(order.final_amount || 0).toLocaleString()} د.ع شامل التوصيل`}
              </span>
            </MobileTableCell>
          </MobileTableGrid>

          <MobileTableCell label="التوصيل">
            <Badge className={`${deliveryBadgeColor} px-2 py-1 text-xs rounded-full shadow-sm`}>
              <Building className="h-3 w-3 ml-1" />
              {order.delivery_partner}
            </Badge>
          </MobileTableCell>

          {/* Actions - ترتيب من اليمين لليسار: حذف، تتبع، تعديل، معاينة */}
          <MobileTableCell actions>
            <div className="flex gap-2">
              {/* Delete - أقصى اليمين */}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteDialog(true);
                  }}
                  className="h-8 w-8 p-0 rounded-lg bg-red-50 hover:bg-red-100 text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}

              {/* Track - ثاني من اليمين */}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewOrder?.(order);
                }}
                className="h-8 w-8 p-0 rounded-lg bg-green-50 hover:bg-green-100 text-green-600"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>

              {/* Edit - ثالث من اليمين */}
              {canEdit && hasPermission('edit_orders') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditOrder?.(order);
                  }}
                  className="h-8 w-8 p-0 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              )}

              {/* View - أقصى اليسار */}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewOrder?.(order);
                }}
                className="h-8 w-8 p-0 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary"
              >
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          </MobileTableCell>
        </MobileTableRow>
      </motion.div>
    );
  }

  // Desktop view - العرض الأصلي
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={`bg-card border rounded-lg p-3 hover:shadow-md transition-all duration-300 ${isSelected ? 'border-primary shadow-md shadow-primary/20 bg-primary/5' : 'border-border/50 hover:border-primary/30'}`}
    >
      <div className="flex items-center gap-4 overflow-x-auto min-w-fit">
        
        {/* Checkbox */}
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect?.(order.id)}
          className="shrink-0"
        />

        {/* Status */}
        <div className="min-w-[160px] flex-shrink-0">
          {isLocalOrder && order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'returned_in_stock' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                // تحديد الحالة التالية
                const nextStatus = {
                  'pending': 'shipped',
                  'shipped': 'delivery', 
                  'delivery': 'delivered',
                  'delivered': 'completed',
                  'returned': 'returned_in_stock'
                }[order.status];
                if (nextStatus) handleStatusChange(nextStatus);
              }}
              className={`${statusConfig.color} hover:shadow-md transition-all duration-300 h-auto p-2`}
              title="انقر لتحديث الحالة"
            >
              <StatusIcon className="h-4 w-4" />
              <span className="ml-1">{statusConfig.label}</span>
            </Button>
          ) : (
            <div className={`flex items-center gap-1 ${statusConfig.color} max-w-[160px]`}>
              <StatusIcon className="h-4 w-4 flex-shrink-0" />
              <ScrollingText text={statusConfig.label} className="min-w-0 flex-1" />
            </div>
          )}
        </div>

        {/* Customer Info & Products */}
        <div className="min-w-[200px] flex-shrink-0">
          <div className="font-medium text-sm text-foreground truncate">
            {order.customer_name}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {order.customer_phone}
          </div>
          {/* Employee name */}
          {order.created_by_name && (
            <div className="mt-1">
              <span className="text-xs font-bold text-primary bg-gradient-to-r from-primary/10 to-primary/20 px-2 py-1 rounded-full border border-primary/20">
                <User className="h-3 w-3 inline-block ml-1" />
                {order.created_by_name}
              </span>
            </div>
          )}
          {/* Product Summary */}
          <div className="text-xs text-primary font-medium mt-1">
            {(() => {
              const items = order.items || order.order_items || [];
              if (items.length === 0) return 'لا توجد منتجات';
              
              // تصفية العناصر null/undefined وحساب المجموع بأمان
              const validItems = (items || []).filter(item => item != null && typeof item === 'object');
              const totalItems = validItems.reduce((sum, item) => sum + (Number(item?.quantity) || 1), 0);
              
              if (validItems.length === 1) {
                const item = validItems[0];
                const productName = item.productname || item.product_name || item.producttype || item.product_type || 'منتج';
                return `${productName} (${item.quantity || 1})`;
              } else {
                const firstProductType = items[0]?.producttype || items[0]?.product_type || 'منتج';
                return `${totalItems} قطعة - ${firstProductType}`;
              }
            })()}
          </div>
        </div>

        {/* Date & Delivery */}
        <div className="min-w-[150px] flex-shrink-0">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatDate(order.created_at)}
          </div>
          <Badge className={`${deliveryBadgeColor} px-2 py-1 text-xs rounded-full mt-1 w-fit shadow-sm`}>
            <Building className="h-3 w-3 ml-1" />
            {order.delivery_partner}
          </Badge>
        </div>

        {/* Amount */}
        <div className="min-w-[120px] flex-shrink-0 text-left">
          <div className="font-bold text-sm text-primary">
            {`${Number(order.final_amount || 0).toLocaleString()} د.ع شامل التوصيل`}
          </div>
          {/* عرض ربح الموظف وحالة التسوية */}
          {employeeProfit > 0 && (
            <div className="text-xs text-emerald-600 font-medium">
              ربح: {employeeProfit.toLocaleString()} د.ع 
              <span className={`mr-1 px-1 rounded ${isSettled ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {isSettled ? 'مدفوع' : 'معلق'}
              </span>
            </div>
          )}
        </div>

        {/* QR ID */}
        <div className="min-w-[80px] flex-shrink-0 text-left" dir="ltr">
          <div className="font-bold text-sm text-foreground tabular-nums">
            {order.qr_id || order.order_number}
          </div>
        </div>

        {/* Actions - مضغوطة كما في الكارت */}
        <div className="flex items-center gap-1 shrink-0">
          {/* View */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewOrder?.(order)}
            className="h-6 w-6 p-0 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary hover:scale-110 transition-all duration-300 shadow-md"
            title="معاينة"
          >
            <Eye className="h-3 w-3" />
          </Button>

          {/* Edit */}
          {canEdit && hasPermission('edit_orders') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEditOrder?.(order)}
              className="h-6 w-6 p-0 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 hover:scale-110 transition-all duration-300 shadow-md"
              title="تعديل"
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          )}

          {/* Track */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewOrder?.(order)}
            className="h-6 w-6 p-0 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 hover:scale-110 transition-all duration-300 shadow-md"
            title="تتبع"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>

          {/* Delete */}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="h-6 w-6 p-0 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 hover:scale-110 transition-all duration-300 shadow-md"
              title="حذف"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <DeleteConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
        title="تأكيد حذف الطلب"
        description={`هل أنت متأكد من حذف الطلب رقم ${order.qr_id || order.order_number}؟ سيتم إرجاع المنتجات المحجوزة إلى المخزون تلقائياً. لا يمكن التراجع عن هذا الإجراء.`}
        type="danger"
      />
    </motion.div>
  );
};

export default OrderListItem;