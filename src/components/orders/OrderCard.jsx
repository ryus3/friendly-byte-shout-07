import React, { useMemo, useState } from 'react';
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
  ExternalLink,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';
import DeleteConfirmationDialog from '@/components/ui/delete-confirmation-dialog';
import { useAuth } from '@/contexts/UnifiedAuthContext';

const OrderCard = ({ 
  order, 
  onViewOrder, 
  onSelect, 
  isSelected, 
  onUpdateStatus, 
  onDeleteOrder, 
  onEditOrder,
  onReceiveReturn,
  calculateProfit,
  profits,
  showEmployeeName = false,
  additionalButtons // أزرار إضافية
}) => {
  const { hasPermission } = useAuth();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
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

  // تحديد لون وأيقونة الحالة مع دعم شامل لحالات شركة التوصيل
  const getStatusConfig = (status, deliveryStatus = null, isLocalOrder = true) => {
    // للطلبات المحلية - استخدم status المحلي
    if (isLocalOrder) {
      const displayStatus = status;
    } else {
      // للطلبات الخارجية - استخدم delivery_status مع مطابقة محددة
      const deliveryStatusLower = deliveryStatus?.toLowerCase() || '';
      
      // عرض "قيد التجهيز" فقط لحالة "فعال"
      if (deliveryStatusLower.includes('فعال')) {
        return { 
          label: 'قيد التجهيز', 
          icon: Package,
          color: 'bg-gradient-to-r from-status-pending-start to-status-pending-end text-white border border-status-pending-border shadow-lg shadow-status-pending-shadow/40 font-bold rounded-lg px-3 py-1.5 text-xs'
        };
      }
      
      // عرض "تم الشحن" لحالة "تم الاستلام من قبل المندوب"
      if (deliveryStatusLower.includes('تم الاستلام من قبل المندوب')) {
        return { 
          label: 'تم الشحن', 
          icon: Truck,
          color: 'bg-gradient-to-r from-status-shipped-start to-status-shipped-end text-white border border-status-shipped-border shadow-lg shadow-status-shipped-shadow/40 font-bold rounded-lg px-3 py-1.5 text-xs'
        };
      }
      
      // لباقي الحالات الخارجية - اعرضها كما هي من شركة التوصيل
      return getDeliveryStatusConfig(deliveryStatus);
    }
    
    const displayStatus = isLocalOrder ? status : deliveryStatus;
    
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
      },
      'unknown': { 
        label: 'غير معروف', 
        icon: AlertTriangle,
        color: 'bg-gradient-to-r from-gray-500 to-slate-500 text-white border border-gray-300/50 shadow-lg shadow-gray-400/40 font-bold rounded-lg px-3 py-1.5 text-xs'
      }
    };
    
    // إذا كان في المعرفات المحلية، استخدمها
    if (configs[displayStatus]) {
      return configs[displayStatus];
    }
    
    return configs[displayStatus] || configs['pending'];
  };

  // دالة منفصلة للحالات الخارجية من شركة التوصيل
  const getDeliveryStatusConfig = (deliveryStatus) => {
    if (!deliveryStatus || typeof deliveryStatus !== 'string') {
      return { 
        label: 'غير محدد', 
        icon: Package, 
        color: 'bg-gradient-to-r from-gray-500 to-slate-500 text-white border border-gray-300/50 shadow-lg shadow-gray-400/40 font-bold rounded-lg px-3 py-1.5 text-xs' 
      };
    }

    const statusLower = deliveryStatus.toLowerCase();
    
    // حالات التسليم
    if (statusLower.includes('تسليم') || statusLower.includes('مسلم') || statusLower.includes('deliver')) {
      return { 
        label: deliveryStatus, 
        icon: CheckCircle, 
        color: 'bg-gradient-to-r from-status-delivered-start to-status-delivered-end text-white border border-status-delivered-border shadow-lg shadow-status-delivered-shadow/40 font-bold rounded-lg px-3 py-1.5 text-xs' 
      };
    } 
    // حالات الرفض والإلغاء
    else if (statusLower.includes('رفض') || statusLower.includes('ملغي') || statusLower.includes('إلغاء') || statusLower.includes('reject') || statusLower.includes('cancel')) {
      return { 
        label: deliveryStatus, 
        icon: XCircle, 
        color: 'bg-gradient-to-r from-red-500 to-red-600 text-white border border-red-300/50 shadow-lg shadow-red-400/40 font-bold rounded-lg px-3 py-1.5 text-xs' 
      };
    } 
    // حالات قيد التوصيل أو في الطريق
    else if (statusLower.includes('في الطريق') || statusLower.includes('طريق') || statusLower.includes('جاري التوصيل') || statusLower.includes('shipping')) {
      return { 
        label: deliveryStatus, 
        icon: MapPin, 
        color: 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border border-orange-300/50 shadow-lg shadow-orange-400/40 font-bold rounded-lg px-3 py-1.5 text-xs' 
      };
    } 
    // حالات التأجيل - عرضها كما هي
    else if (statusLower.includes('تأجيل') || statusLower.includes('مؤجل') || statusLower.includes('postpone') || statusLower.includes('delay')) {
      return { 
        label: deliveryStatus, 
        icon: Clock, 
        color: 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white border border-yellow-300/50 shadow-lg shadow-yellow-400/40 font-bold rounded-lg px-3 py-1.5 text-xs' 
      };
    } 
    // حالات عدم وجود العميل - عرضها كما هي
    else if (statusLower.includes('عدم وجود') || statusLower.includes('لا يمكن الوصول') || statusLower.includes('غائب') || statusLower.includes('absent')) {
      return { 
        label: deliveryStatus, 
        icon: AlertTriangle, 
        color: 'bg-gradient-to-r from-gray-500 to-slate-500 text-white border border-gray-300/50 shadow-lg shadow-gray-400/40 font-bold rounded-lg px-3 py-1.5 text-xs' 
      };
    } 
    // حالات الإرجاع
    else if (statusLower.includes('راجع') || statusLower.includes('مرجع') || statusLower.includes('إرجاع') || statusLower.includes('return')) {
      return { 
        label: deliveryStatus, 
        icon: RotateCcw, 
        color: 'bg-gradient-to-r from-status-returned-start to-status-returned-end text-white border border-status-returned-border shadow-lg shadow-status-returned-shadow/40 font-bold rounded-lg px-3 py-1.5 text-xs' 
      };
    } 
    // حالة افتراضية - عرض النص كما هو
    else {
      return { 
        label: deliveryStatus, 
        icon: Package, 
        color: 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white border border-purple-300/50 shadow-lg shadow-purple-400/40 font-bold rounded-lg px-3 py-1.5 text-xs' 
      };
    }
  };

  // تحديد نوع الطلب بناءً على tracking_number
  const isLocalOrder = !order.tracking_number || order.tracking_number.startsWith('RYUS-') || order.delivery_partner === 'محلي';
  
  // استخدام delivery_status للطلبات الخارجية أو status للمحلية  
  const displayStatus = !isLocalOrder && order.delivery_status ? order.delivery_status : order.status;
  const statusConfig = getStatusConfig(order.status, order.delivery_status, isLocalOrder);
  const StatusIcon = statusConfig.icon;
  const deliveryBadgeColor = isLocalOrder ? 
    'bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 text-white border border-emerald-300/50 shadow-lg shadow-emerald-400/40 font-bold' : 
    'bg-gradient-to-r from-blue-400 via-blue-500 to-cyan-500 text-white border border-blue-300/50 shadow-lg shadow-blue-400/40 font-bold';

  // التحقق من الصلاحيات - يمكن تعديل وحذف الطلبات قبل استلام المندوب فقط
  const canEdit = isBeforePickup(order);
  const canDelete = isBeforePickup(order);

  const handleStatusChange = (newStatus) => {
    if (onUpdateStatus) {
      onUpdateStatus(order.id, newStatus);
    }
  };

  const handleDelete = () => {
    if (onDeleteOrder) {
      onDeleteOrder(order); // تمرير الطلب كاملاً بدلاً من الـ ID فقط
    }
    setShowDeleteDialog(false);
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

  // تحضير معلومات المنتجات مع اسم المنتج واللون والقياس
  const getProductSummary = () => {
    if (!order.items || order.items.length === 0) return null;
    
    const totalItems = order.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    
    if (order.items.length === 1) {
      // منتج واحد - اعرض الاسم والعدد واللون والقياس
      const item = order.items[0];
      const productName = item.productname || item.product_name || item.producttype || item.product_type || 'منتج';
      
      // جمع معلومات اللون والقياس
      const colorInfo = item.product_variants?.colors?.name || item.color || '';
      const sizeInfo = item.product_variants?.sizes?.name || item.size || '';
      const variantInfo = [colorInfo, sizeInfo].filter(Boolean).join(' - ');
      
      return { 
        totalItems, 
        displayText: productName,
        variantInfo: variantInfo || null,
        quantity: item.quantity || 1,
        isSingle: true
      };
    } else {
      // عدة منتجات - اعرض ملخص
      const firstProductType = order.items[0]?.producttype || order.items[0]?.product_type || 'منتج';
      return { 
        totalItems, 
        displayText: `${totalItems} قطعة - ${firstProductType}`,
        variantInfo: null,
        quantity: totalItems,
        isSingle: false
      };
    }
  };

  const productSummary = getProductSummary();

  // حساب ربح الموظف من الطلب
  const employeeProfit = useMemo(() => {
    if (!calculateProfit || !order.items) return 0;
    
    // التأكد من وجود بيانات الأرباح وأن تكون مصفوفة
    if (!Array.isArray(profits)) return 0;
    
    // البحث في profits أولاً
    const profitRecord = profits.find(p => p.order_id === order.id);
    if (profitRecord && profitRecord.employee_profit) {
      return profitRecord.employee_profit;
    }
    
    // حساب من items إذا لم يوجد في profits
    return order.items.reduce((sum, item) => {
      return sum + (calculateProfit(item, order.created_by) || 0);
    }, 0);
  }, [calculateProfit, order, profits]);

  // تحديد حالة الأرباح والدفع بدقة
  const paymentStatus = useMemo(() => {
    // التأكد من وجود بيانات الأرباح وأن تكون مصفوفة
    if (!Array.isArray(profits)) return null;
    
    // البحث عن سجل الربح
    const profitRecord = profits.find(p => String(p.order_id) === String(order.id));
    
    // تحديد نوع الطلب
    const isLocalOrder = !order.tracking_number || order.tracking_number.startsWith('RYUS-') || order.delivery_partner === 'محلي';
    const isExternalOrder = !isLocalOrder;
    
    // استبعاد طلبات المدير الرئيسي من وسوم التحاسب
    if (order.created_by === '91484496-b887-44f7-9e5d-be9db5567604') {
      return null;
    }
    
    // إخفاء وسم التحاسب إذا لم يوجد سجل ربح أو إذا كان ربح الموظف صفر
    if (!profitRecord || !profitRecord.employee_profit || profitRecord.employee_profit <= 0) {
      return null;
    }
    
    // للطلبات المحلية: عرض حالة التحاسب فقط للطلبات المُسلّمة مع فاتورة
    if (isLocalOrder) {
      if (order.status === 'delivered' && order.receipt_received === true) {
        if (profitRecord.status === 'settled') {
          return { status: 'paid', label: 'مدفوع', color: 'bg-emerald-500' };
        } else {
          return { status: 'pending_settlement', label: 'قابل للتحاسب', color: 'bg-blue-500' };
        }
      }
      // للطلبات المكتملة المؤرشفة: إظهار "مدفوع" فقط
      else if (order.status === 'completed') {
        if (profitRecord.status === 'settled') {
          return { status: 'paid', label: 'مدفوع', color: 'bg-emerald-500' };
        }
      }
    }
    
    // للطلبات الخارجية: عرض حالة التحاسب فقط عند التسليم مع فاتورة
    else if (isExternalOrder) {
      const isDelivered = order.delivery_status?.toLowerCase().includes('تسليم') || 
                         order.delivery_status?.toLowerCase().includes('مسلم') ||
                         order.delivery_status?.toLowerCase().includes('deliver');
      
      if (isDelivered && order.receipt_received === true) {
        if (profitRecord.status === 'settled') {
          return { status: 'paid', label: 'مدفوع', color: 'bg-emerald-500' };
        } else {
          return { status: 'pending_settlement', label: 'قابل للتحاسب', color: 'bg-blue-500' };
        }
      }
      // للطلبات المكتملة المؤرشفة: إظهار "مدفوع" فقط
      else if (order.status === 'completed') {
        if (profitRecord.status === 'settled') {
          return { status: 'paid', label: 'مدفوع', color: 'bg-emerald-500' };
        }
      }
    }
    
    // لا تظهر حالة دفع في باقي الحالات
    return null;
  }, [order, profits]);


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
        
        <CardContent className="relative p-4">
          <div className="space-y-3">
            
            {/* Header العالمي */}
            <div className="flex items-start justify-between">
              {/* Status Badge عالمي - قابل للنقر للطلبات المحلية - يمين */}
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
                  className={`${statusConfig.color} transform group-hover:scale-105 transition-all duration-300 hover:shadow-lg p-2 h-auto`}
                  title="انقر لتحديث الحالة"
                >
                  <StatusIcon className="h-4 w-4" />
                  <span className="font-bold ml-1">{statusConfig.label}</span>
                </Button>
              ) : (
                <div className={`flex items-center gap-2 ${statusConfig.color} transform group-hover:scale-105 transition-transform duration-300`}>
                  <StatusIcon className="h-4 w-4" />
                  <span className="font-bold">{statusConfig.label}</span>
                </div>
              )}
              
               <div className="flex items-center gap-3">
                <div className="text-right" dir="ltr">
                   <h3 className="font-black text-lg text-foreground tracking-wide bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text tabular-nums">
                     {order.tracking_number || order.order_number}
                   </h3>
                </div>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onSelect?.(order.id)}
                  className="shrink-0 scale-125 border-2"
                />
              </div>
              
              {/* مؤشر دفع المستحقات */}
              {order.status === 'completed' && order.isArchived && (
                <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-green-300/50 shadow-lg shadow-green-400/40 font-bold">
                  <CheckCircle className="w-3 h-3 ml-1" />
                  مدفوع المستحقات
                </Badge>
              )}
            </div>

            {/* Customer Info مع الأيقونات في المنتصف */}
            <div className="bg-gradient-to-r from-muted/20 via-muted/10 to-transparent rounded-xl p-3 border border-muted/30 relative">
              <div className="grid grid-cols-3 gap-3 items-center">
                
                {/* Date & Delivery Info - يمين */}
                <div className="space-y-1 text-right">
                  <div className="flex items-center gap-2 justify-start">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold text-foreground">{formatDate(order.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 justify-start">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{formatTime(order.created_at)}</span>
                  </div>
                   {/* اسم الموظف صاحب الطلب */}
                   {order.created_by_name && (
                     <div className="flex items-center gap-2 justify-end">
                       <span className="text-xs font-bold text-primary bg-gradient-to-r from-primary/10 to-primary/20 px-3 py-1.5 rounded-full border border-primary/20 shadow-sm backdrop-blur-sm">
                         <User className="h-3 w-3 inline-block mr-1" />
                         {order.created_by_name}
                       </span>
                     </div>
                   )}
                   <div className="flex flex-col gap-1 items-end">
                     <Badge className={`${deliveryBadgeColor} px-2 py-1 text-xs rounded-full font-bold w-fit shadow-sm flex items-center gap-1`}>
                       <Building className="h-3 w-3" />
                       {order.delivery_partner}
                     </Badge>

                     {/* شارة استلام الفاتورة للطلبات الخارجية */}
                     {!isLocalOrder && order.delivery_partner === 'alwaseet' && order.receipt_received && (
                       <Badge variant="default" className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                         مستلم الفاتورة ✓
                       </Badge>
                     )}

                     {/* شارة رقم فاتورة الوسيط */}
                     {order.delivery_partner_invoice_id && (
                       <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 px-2 py-0.5 rounded-full">
                         فاتورة: {order.delivery_partner_invoice_id}
                       </Badge>
                     )}
                   </div>
                </div>
                
                {/* Action Icons - منتصف */}
                <div className="flex items-center justify-center gap-1">
                  
                  {/* Delete - أقصى اليمين */}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                      className="h-8 w-8 p-0 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 hover:scale-110 transition-all duration-300 shadow-md"
                      title="حذف"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {/* Track - ثاني من اليمين */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewOrder?.(order)}
                    className="h-8 w-8 p-0 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 hover:scale-110 transition-all duration-300 shadow-md"
                    title="تتبع"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>

                   {/* Edit - ثالث من اليمين */}
                   {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditOrder?.(order)}
                      className="h-8 w-8 p-0 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 hover:scale-110 transition-all duration-300 shadow-md"
                      title="تعديل"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {/* View - أقصى اليسار */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewOrder?.(order)}
                    className="h-8 w-8 p-0 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary hover:scale-110 transition-all duration-300 shadow-md"
                    title="معاينة"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </div>
                
                {/* Customer Info - يسار */}
                <div className="space-y-1 text-left">
                  <div className="flex items-center gap-2 flex-row-reverse">
                    <User className="h-4 w-4 text-primary" />
                    <span className="font-bold text-foreground text-sm">{order.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-row-reverse">
                    <Phone className="h-3 w-3" />
                    <span>{order.customer_phone}</span>
                  </div>
                  {order.customer_city && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-row-reverse">
                      <Building className="h-3 w-3" />
                      <span>{order.customer_city}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Product & Price مع توصيل في نفس السطر */}
            <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-3 border border-primary/20">
              <div className="flex items-center justify-between">
                {productSummary && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-primary font-bold">
                      <Package className="h-4 w-4" />
                      <span className="text-sm">{productSummary.displayText}</span>
                      {productSummary.isSingle && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                          × {productSummary.quantity}
                        </span>
                      )}
                    </div>
                    {productSummary.variantInfo && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mr-6">
                        <span className="bg-secondary px-2 py-1 rounded-md font-medium">
                          {productSummary.variantInfo}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-left">
                  <div className="space-y-1">
                    {/* عرض ربح الموظف */}
                    {employeeProfit > 0 && (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-muted-foreground">ربح الموظف:</span>
                        <span className="font-bold text-emerald-600">
                          {employeeProfit.toLocaleString()} د.ع
                        </span>
                      </div>
                    )}
                    
                    {/* السعر الإجمالي */}
                    <div className="flex items-center gap-1">
                      {order.delivery_fee > 0 && (
                        <span className="text-xs text-muted-foreground font-medium">
                          شامل التوصيل
                        </span>
                      )}
                      <span className="font-bold text-lg text-primary">
                        {order.final_amount?.toLocaleString()}
                      </span>
                      <span className="text-xs text-primary/70 font-bold">د.ع</span>
                    </div>
                    
                    {/* حالة الدفع - فقط للطلبات المكتملة */}
                    {paymentStatus && (
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${paymentStatus.color}`}></div>
                        <span className="text-xs font-medium">{paymentStatus.label}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>


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

            {/* Additional Buttons */}
            {additionalButtons && (
              <div className="flex justify-center pt-2">
                {additionalButtons}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <DeleteConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
        title={`حذف الطلب ${order.qr_id || order.order_number}`}
        description="سيتم تحرير المخزون المحجوز تلقائياً."
        confirmText="حذف"
        cancelText="إلغاء"
      />
    </motion.div>
  );
};

export default OrderCard;