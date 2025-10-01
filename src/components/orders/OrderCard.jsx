import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InvoiceCheckButton } from './InvoiceCheckButton';
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
import { getStatusForComponent } from '@/lib/order-status-translator';
import { canDeleteOrder, getDeleteConfirmationMessage } from '@/lib/order-deletion-utils';
import ScrollingText from '@/components/ui/scrolling-text';

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
    if (onDeleteOrder) {
      onDeleteOrder([order.id]); // تمرير مصفوفة تحتوي على ID الطلب
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
    
    // تصفية العناصر null/undefined وحساب المجموع بأمان
    const validItems = (order.items || []).filter(item => item != null && typeof item === 'object');
    const totalItems = validItems.reduce((sum, item) => sum + (Number(item?.quantity) || 1), 0);
    
    if (validItems.length === 1) {
      // منتج واحد - اعرض الاسم والعدد واللون والقياس
      const item = validItems[0];
      const productName = item?.productname || item?.product_name || item?.producttype || item?.product_type || 'منتج';
      
      // جمع معلومات اللون والقياس
      const colorInfo = item?.product_variants?.colors?.name || item?.color || '';
      const sizeInfo = item?.product_variants?.sizes?.name || item?.size || '';
      // عرض اللون والقياس معاً إذا كانوا موجودين
      const parts = [sizeInfo, colorInfo].filter(Boolean);
      const variantInfo = parts.length > 0 ? parts.join(' - ') : '';
      
      return { 
        totalItems, 
        displayText: productName,
        variantInfo: variantInfo || null,
        colorInfo: colorInfo,
        colorHex: item?.product_variants?.colors?.hex_code || item?.color_hex,
        quantity: item?.quantity || 1,
        isSingle: true
      };
    } else {
      // عدة منتجات - اعرض ملخص
      const firstProductName = validItems[0]?.productname || validItems[0]?.product_name || validItems[0]?.products?.name || 'منتج';
      return { 
        totalItems, 
        displayText: `${totalItems} قطعة - ${firstProductName}`,
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
    
    // حساب من items إذا لم يوجد في profits - مع تصفية العناصر null/undefined
    const validItems = order.items.filter(item => item != null);
    return validItems.reduce((sum, item) => {
      return sum + (calculateProfit(item, order.created_by) || 0);
    }, 0);
  }, [calculateProfit, order, profits]);

  // تحديد حالة الأرباح والدفع بدقة
  const paymentStatus = useMemo(() => {
    console.log(`🔄 [${order.order_number}] Payment Status Calculation:`, {
      orderId: order.id,
      orderNumber: order.order_number,
      status: order.status,
      deliveryStatus: order.delivery_status,
      receiptReceived: order.receipt_received,
      profitsLength: profits?.length || 0,
      allProfitsProvided: !!profits
    });
    
    // التأكد من وجود بيانات الأرباح وأن تكون مصفوفة
    if (!Array.isArray(profits)) {
      console.log(`❌ [${order.order_number}] Profits not array:`, profits);
      return null;
    }
    
    // البحث عن سجل الربح
    const profitRecord = profits.find(p => String(p.order_id) === String(order.id));
    console.log(`🔍 [${order.order_number}] Profit record found:`, profitRecord);
    
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
        console.log(`✅ [${order.order_number}] Completed local order - profit status:`, profitRecord.status);
        if (profitRecord.status === 'settled') {
          console.log(`💚 [${order.order_number}] Should show PAID status`);
          return { status: 'paid', label: 'مدفوع', color: 'bg-emerald-500' };
        } else {
          console.log(`⚠️ [${order.order_number}] Profit not settled:`, profitRecord.status);
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
            
            {/* Header العالمي - ترتيب موحد مع صفحة الطلبات */}
            <div className="flex items-start justify-between">
              {/* Status Badge عالمي - قابل للنقر للطلبات المحلية - يسار */}
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
                  <span className="font-bold mr-1">{statusConfig.label}</span>
                </Button>
              ) : (
                <div className={`flex items-center gap-2 ${statusConfig.color} transform group-hover:scale-105 transition-transform duration-300`}>
                  <StatusIcon className="h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <ScrollingText text={statusConfig.label} className="font-bold" maxWidth="140px" />
                  </div>
                </div>
              )}
              
               <div className="flex items-center gap-3">
                 {order.delivery_account_used && order.delivery_partner !== 'محلي' && (
                   <Badge variant="outline" className="text-xs font-bold bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-blue-300/50 shadow-sm px-2 py-0.5 rounded-full">
                     ({order.delivery_account_used.toUpperCase()})
                   </Badge>
                 )}
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
                  <CheckCircle className="w-3 h-3 mr-1" />
                  مدفوع المستحقات
                </Badge>
              )}
            </div>

            {/* Customer Info مع الأيقونات في المنتصف - تصميم موحد */}
            <div className="bg-gradient-to-r from-muted/20 via-muted/10 to-transparent rounded-xl p-3 border border-muted/30 relative">
              <div className="grid grid-cols-3 gap-3 items-center">
                
                {/* Date & Delivery Info - يسار (موحد مع OrdersPage) */}
                <div className="space-y-1 text-left">
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
                      <div className="flex items-center gap-2 justify-start">
                        <span className="text-xs font-bold text-primary bg-gradient-to-r from-primary/10 to-primary/20 px-3 py-1.5 rounded-full border border-primary/20 shadow-sm backdrop-blur-sm">
                          <User className="h-3 w-3 inline-block ml-1" />
                          {order.created_by_name}
                        </span>
                      </div>
                   )}
                   <div className="flex flex-col gap-1 items-start">
                       <div className="flex justify-start w-full">
                           <Badge className={`${deliveryBadgeColor} px-2 py-1 text-xs rounded-full font-bold min-w-[90px] shadow-sm flex items-center justify-center gap-1 h-6`}>
                             <Building className="h-3 w-3" />
                             <span className="truncate">{order.delivery_partner === 'alwaseet' ? 'AL WASEET' : order.delivery_partner}</span>
                           </Badge>
                       </div>

                       {/* شارة رقم فاتورة الوسيط - مصغرة */}
                       {order.delivery_partner_invoice_id && (
                         <div className="flex justify-start w-full">
                           <Badge variant="outline" className="text-xs font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white border-purple-300/50 shadow-lg shadow-purple-400/30 px-2 py-1 rounded-full min-w-[90px] flex items-center justify-center gap-1 h-6 whitespace-nowrap">
                             <CreditCard className="h-3 w-3" />
                             <span className="truncate">#{order.delivery_partner_invoice_id}</span>
                           </Badge>
                         </div>
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
                      <MapPin className="h-3 w-3" />
                      <span>{order.customer_address || `${order.customer_city}${order.customer_province ? ' - ' + order.customer_province : ''}`}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Product & Price مع توصيل في نفس السطر */}
            <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-3 border border-primary/20">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2 text-right">
                  <div className="space-y-1">
                    {/* عرض ربح الموظف */}
                    {employeeProfit > 0 && (
                      <div className="flex items-center gap-1 text-xs justify-end">
                        <span className="font-bold text-emerald-600">
                          {employeeProfit.toLocaleString()} د.ع
                        </span>
                        <span className="text-muted-foreground">:ربح الموظف</span>
                      </div>
                    )}
                    
                    {/* السعر (شامل التوصيل) */}
                    <div className="flex items-center gap-1 justify-end">
                      <span className="text-xs text-primary/70 font-bold">د.ع</span>
                      <span className="font-bold text-lg text-primary">
                        {(() => {
                          const finalAmount = Number(order.final_amount || order.total_amount || 0);
                          const salesAmount = Number(order.sales_amount || 0);
                          const deliveryFee = Number(order.delivery_fee || 0);
                          const total = salesAmount > 0 ? (salesAmount + deliveryFee) : (finalAmount + deliveryFee);
                          return total.toLocaleString();
                        })()}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">
                        شامل التوصيل
                      </span>
                    </div>
                    
                    {/* حالة الدفع - فقط للطلبات المكتملة */}
                    {paymentStatus && (
                      <div className="flex items-center gap-1 justify-end">
                        <span className="text-xs font-medium">{paymentStatus.label}</span>
                        <div className={`w-2 h-2 rounded-full ${paymentStatus.color}`}></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* معلومات المنتج */}
                {productSummary && (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="min-w-0 flex-1">
                      {/* الصف الأول: أيقونة (أقصى يمين) + اسم المنتج + العدد */}
                      <div className="flex items-center gap-2 text-primary font-bold flex-row-reverse">
                        <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 flex-shrink-0">
                          <Package className="h-4 w-4" />
                        </div>
                        <span className="text-sm">{productSummary.displayText}</span>
                        {productSummary.isSingle && (
                          <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                            X{productSummary.quantity}
                          </span>
                        )}
                      </div>
                      
                      {/* الصف الثاني: اللون - القياس (أسفل اسم المنتج) */}
                      {productSummary.variantInfo && (
                        <div className="flex items-center gap-2 mt-1 justify-end mr-2">
                          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-md font-medium">
                            {productSummary.variantInfo}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>



            {/* Additional Buttons */}
            <div className="flex justify-center pt-2 gap-2">
              {additionalButtons}
              
            </div>
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