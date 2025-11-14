import React, { useMemo, useState, memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InvoiceCheckButton } from './InvoiceCheckButton';
import { PartialDeliveryDialog } from './PartialDeliveryDialog';
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
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCcw
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';
import DeleteConfirmationDialog from '@/components/ui/delete-confirmation-dialog';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { getStatusForComponent } from '@/lib/order-status-translator';
import { canDeleteOrder, getDeleteConfirmationMessage } from '@/lib/order-deletion-utils';
import ScrollingText from '@/components/ui/scrolling-text';

const OrderCard = React.memo(({ 
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
  additionalButtons
}) => {
  const { hasPermission } = useAuth();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPartialDelivery, setShowPartialDelivery] = useState(false);
  
  const isBeforePickup = (order) => {
    if (isLocalOrder) {
      return order.status === 'pending';
    }
    
    const deliveryStatus = order.delivery_status?.toLowerCase() || '';
    return deliveryStatus.includes('فعال') || 
           deliveryStatus.includes('في انتظار استلام المندوب') ||
           deliveryStatus.includes('active');
  };

  const isLocalOrder = !order.tracking_number || order.tracking_number.startsWith('RYUS-') || order.delivery_partner === 'محلي';
  
  const statusConfig = getStatusForComponent(order);
  
  const StatusIcon = statusConfig.icon;
  const deliveryBadgeColor = isLocalOrder ? 
    'bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 text-white border border-emerald-300/50 shadow-lg shadow-emerald-400/40 font-bold' : 
    'bg-gradient-to-r from-blue-400 via-blue-500 to-cyan-500 text-white border border-blue-300/50 shadow-lg shadow-blue-400/40 font-bold';

  const canEdit = React.useMemo(() => {
    if (isLocalOrder) {
      return order.status === 'pending';
    } else {
      return order.status === 'pending';
    }
  }, [isLocalOrder, order.status]);

  const canDelete = React.useMemo(() => {
    return canDeleteOrder(order);
  }, [order]);

  const handleStatusChange = React.useCallback((newStatus) => {
    if (onUpdateStatus) {
      onUpdateStatus(order.id, newStatus);
    }
  }, [onUpdateStatus, order.id]);

  const handleDelete = React.useCallback(() => {
    if (onDeleteOrder) {
      onDeleteOrder([order.id]);
    }
    setShowDeleteDialog(false);
  }, [onDeleteOrder, order.id]);

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

  const getProductSummary = () => {
    // ✅ معالجة خاصة لطلبات الاستبدال
    if ((order.order_type === 'exchange' || order.order_type === 'replacement') && order.exchange_metadata) {
      const { outgoing_items = [], incoming_items = [] } = order.exchange_metadata;
      
      return {
        type: 'exchange',
        outgoing: outgoing_items.map(item => ({
          productName: item.product_name,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          colorHex: item.color_hex
        })),
        incoming: incoming_items.map(item => ({
          productName: item.product_name,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          colorHex: item.color_hex
        }))
      };
    }
    
  // ✅ معالجة خاصة لطلبات الإرجاع
  if (order.order_type === 'return' && order.order_items) {
    const incomingItems = order.order_items.filter(item => item.item_direction === 'incoming');
    
    return {
      type: 'return',
      incoming: incomingItems.map(item => ({
        productName: item.products?.name || item.product_name || 'منتج',
        color: item.product_variants?.colors?.name || item.color || '',
        size: item.product_variants?.sizes?.name || item.size || '',
        quantity: item.quantity || 1,
        colorHex: item.product_variants?.colors?.hex_code || item.color_hex || null
      }))
    };
  }
    
    if (!order.items || order.items.length === 0) return null;
    
    const validItems = (order.items || []).filter(item => item != null && typeof item === 'object');
    const totalItems = validItems.reduce((sum, item) => sum + (Number(item?.quantity) || 1), 0);
    
    const groupedByProduct = validItems.reduce((acc, item) => {
      const productName = item?.productname || item?.product_name || item?.producttype || item?.product_type || 'منتج';
      if (!acc[productName]) {
        acc[productName] = [];
      }
      acc[productName].push(item);
      return acc;
    }, {});
    
    const uniqueProducts = Object.keys(groupedByProduct);
    
    if (uniqueProducts.length === 1) {
      const productName = uniqueProducts[0];
      const items = groupedByProduct[productName];
      
      if (items.length === 1) {
        const item = items[0];
        const colorInfo = item?.product_variants?.colors?.name || item?.color || '';
        const sizeInfo = item?.product_variants?.sizes?.name || item?.size || '';
        const parts = [colorInfo, sizeInfo].filter(Boolean);
        const variantInfo = parts.length > 0 ? parts.join(' - ') : '';
        
        return {
          type: 'single',
          totalItems,
          productName,
          quantity: item?.quantity || 1,
          variantInfo: variantInfo || null,
          colorHex: item?.product_variants?.colors?.hex_code || item?.color_hex
        };
      }
      
      else {
        const variantsMap = {};
        items.forEach(item => {
          const colorInfo = item?.product_variants?.colors?.name || item?.color || '';
          const sizeInfo = item?.product_variants?.sizes?.name || item?.size || '';
          const key = `${colorInfo} ${sizeInfo}`.trim();
          if (!variantsMap[key]) {
            variantsMap[key] = 0;
          }
          variantsMap[key] += item?.quantity || 1;
        });
        
        const variantsText = Object.entries(variantsMap)
          .map(([variant, qty]) => `${variant} (${qty})`)
          .join('، ');
        
        return {
          type: 'single-multi-variant',
          totalItems,
          productName,
          quantity: totalItems,
          variantsText
        };
      }
    }
    
    else {
      const products = uniqueProducts.map(productName => {
        const items = groupedByProduct[productName];
        const item = items[0];
        const colorInfo = item?.product_variants?.colors?.name || item?.color || '';
        const sizeInfo = item?.product_variants?.sizes?.name || item?.size || '';
        const parts = [colorInfo, sizeInfo].filter(Boolean);
        const variantInfo = parts.length > 0 ? parts.join(' - ') : '';
        
        return {
          productName,
          variantInfo,
          colorHex: item?.product_variants?.colors?.hex_code || item?.color_hex
        };
      });
      
      return {
        type: 'multiple',
        totalItems,
        products
      };
    }
  };

  const productSummary = getProductSummary();

  // تحديد ما إذا كان الطلب يحتاج لتحديد المنتجات المُسلّمة
  const needsPartialDeliverySelection = useMemo(() => {
    // فقط للطلبات متعددة المنتجات من الوسيط
    if (order.delivery_partner?.toLowerCase() !== 'alwaseet') return false;
    if (!order.order_items || order.order_items.length <= 1) return false;
    
    // التحقق من أن جميع العناصر لا تزال في pending
    const allPending = order.order_items.every(item => 
      !item.item_status || item.item_status === 'pending'
    );
    if (!allPending) return false;
    
    // ✅ الحالات التي تحتاج تسليم جزئي:
    // 1. الحالة 21 (تم التسليم + استرجاع جزئي) - دائماً
    if (order.delivery_status === '21') return true;
    
    // 2. الحالة 4 (تم التسليم) - فقط إذا كان هناك تغيير سعر من API
    if (order.delivery_status === '4' && order.price_change_type === 'api_sync') return true;
    
    return false;
  }, [order]);

  const employeeProfit = useMemo(() => {
    if (!calculateProfit || !order.items) return 0;
    
    if (!Array.isArray(profits)) return 0;
    
    const profitRecord = profits.find(p => p.order_id === order.id);
    if (profitRecord && profitRecord.employee_profit) {
      return profitRecord.employee_profit;
    }
    
    const validItems = order.items.filter(item => item != null);
    return validItems.reduce((sum, item) => {
      return sum + (calculateProfit(item, order.created_by) || 0);
    }, 0);
  }, [calculateProfit, order, profits]);

  const paymentStatus = useMemo(() => {
    if (!Array.isArray(profits)) {
      return null;
    }
    
    const profitRecord = profits.find(p => String(p.order_id) === String(order.id));
    
    const isLocalOrder = !order.tracking_number || order.tracking_number.startsWith('RYUS-') || order.delivery_partner === 'محلي';
    const isExternalOrder = !isLocalOrder;
    
    if (order.created_by === '91484496-b887-44f7-9e5d-be9db5567604') {
      return null;
    }
    
    if (!profitRecord || !profitRecord.employee_profit || profitRecord.employee_profit <= 0) {
      return null;
    }
    
    if (isLocalOrder) {
      if (order.status === 'delivered' && order.receipt_received === true) {
        if (profitRecord.status === 'settled') {
          return { status: 'paid', label: 'مدفوع', color: 'bg-emerald-500' };
        } else {
          return { status: 'pending_settlement', label: 'قابل للتحاسب', color: 'bg-blue-500' };
        }
      }
      else if (order.status === 'completed') {
        if (profitRecord.status === 'settled') {
          return { status: 'paid', label: 'مدفوع', color: 'bg-emerald-500' };
        }
      }
    }
    
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
      else if (order.status === 'completed') {
        if (profitRecord.status === 'settled') {
          return { status: 'paid', label: 'مدفوع', color: 'bg-emerald-500' };
        }
      }
    }
    
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
        
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-all duration-500" />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-purple-500 to-blue-500 opacity-60" />
        
        <CardContent className="relative p-4">
          <div className="space-y-3">
            
            <div className="flex items-start justify-between">
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
              
               {/* معلومات مُسلّم/راجع موجودة في قسم التفاصيل بالأسفل */}
              
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
              
              {order.status === 'completed' && order.isArchived && (
                <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-green-300/50 shadow-lg shadow-green-400/40 font-bold">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  مدفوع المستحقات
                </Badge>
              )}
            </div>

            <div className="bg-gradient-to-r from-muted/20 via-muted/10 to-transparent rounded-xl p-3 border border-muted/30 relative">
              <div className="grid grid-cols-3 gap-3 items-center">
                
                <div className="space-y-1 text-left">
                  <div className="flex items-center gap-2 justify-start">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold text-foreground">{formatDate(order.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 justify-start">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{formatTime(order.created_at)}</span>
                  </div>
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
                              <span className="truncate">
                                {order.delivery_partner === 'alwaseet' ? 'AL WASEET' : 
                                 order.delivery_partner === 'modon' ? 'MODON' : 
                                 order.delivery_partner || 'محلي'}
                              </span>
                            </Badge>
                       </div>

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
                
                <div className="flex items-center justify-center gap-1">
                  
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

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewOrder?.(order)}
                    className="h-8 w-8 p-0 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 hover:scale-110 transition-all duration-300 shadow-md"
                    title="تتبع"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>

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
                
                <div className="space-y-1 text-left">
                  <div className="flex items-center gap-2 flex-row-reverse">
                    <User className="h-4 w-4 text-primary" />
                    <span className="font-bold text-foreground text-sm">{order.customer_name}</span>
                  </div>
                   <div className="flex items-center gap-2 text-xs text-muted-foreground flex-row-reverse">
                     <Phone className="h-3 w-3" />
                     <span>{order.customer_phone}</span>
                   </div>
                   {(order.customer_city || order.customer_province) && (
                     <div className="flex items-center gap-1 text-xs text-muted-foreground flex-row-reverse">
                       <MapPin className="h-3 w-3 flex-shrink-0" />
                       <span className="text-right">
                         {order.customer_city}
                         {order.customer_province && ` – ${order.customer_province}`}
                       </span>
                     </div>
                   )}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-3 border border-primary/20">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2 text-right">
                  <div className="space-y-1">
                    {employeeProfit > 0 && (
                      <div className="flex items-center gap-1 text-xs justify-end">
                        <span className="font-bold text-emerald-600">
                          {employeeProfit.toLocaleString()} د.ع
                        </span>
                        <span className="text-muted-foreground">:ربح الموظف</span>
                      </div>
                    )}
                    
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-primary/70 font-bold">د.ع</span>
                          <span className="font-bold text-lg text-primary">
                            {(() => {
                              // عرض المبلغ السالب لطلبات الإرجاع
                              if (order.order_type === 'return') {
                                return '-' + Math.abs(order.refund_amount || 0).toLocaleString();
                              }
                              
                              // ✅ للاستبدال/الاستبدال: عرض final_amount مباشرة (يحتوي على فرق السعر + التوصيل)
                              if (order.order_type === 'replacement' || order.order_type === 'exchange') {
                                return Number(order.final_amount || 0).toLocaleString();
                              }
                              
                              // للطلبات العادية: حساب عادي
                              const totalAmount = Number(order.total_amount || 0);
                              const discount = Number(order.discount || 0);
                              const priceIncrease = Number(order.price_increase || 0);
                              const deliveryFee = Number(order.delivery_fee || 0);
                              const displayPrice = totalAmount - discount + priceIncrease + deliveryFee;
                              return displayPrice.toLocaleString();
                            })()}
                          </span>
                          <span className="text-xs text-muted-foreground font-medium">
                            {order.order_type === 'return' ? 'مبلغ الإرجاع' : 'شامل التوصيل'}
                          </span>
                        </div>
                       
                       {/* شارة الخصم - برتقالي تدرج مع أيقونة */}
                       {Number(order.discount || 0) > 0 && 
                        order.order_type !== 'return' && 
                        order.status !== 'partial_delivery' && (
                         <div className="relative group/discount">
                           <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-rose-500/20 rounded-full blur-sm"></div>
                           <Badge className="relative flex items-center gap-1 bg-gradient-to-r from-red-500 to-rose-600 text-white text-xs px-2 py-0.5 shadow-md">
                             <TrendingDown className="w-3 h-3" />
                             <span>خصم {Number(order.discount).toLocaleString()}</span>
                           </Badge>
                         </div>
                       )}
                       
                       {/* شارة الزيادة - أخضر تدرج مع أيقونة */}
                       {Number(order.price_increase || 0) > 0 && order.order_type !== 'return' && order.order_type !== 'replacement' && (
                         <div className="relative group/increase">
                           <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-full blur-sm"></div>
                           <Badge className="relative flex items-center gap-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs px-2 py-0.5 shadow-md">
                             <TrendingUp className="w-3 h-3" />
                             <span>زيادة {Number(order.price_increase).toLocaleString()}</span>
                           </Badge>
                         </div>
                       )}
                       
                       {/* شارة التسليم الجزئي - بنفسجي تدرج مع أيقونة */}
                       {order.status === 'partial_delivery' && (
                         <div className="relative group/partial">
                           <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-violet-500/20 rounded-full blur-sm"></div>
                           <Badge className="relative flex items-center gap-1 bg-gradient-to-r from-purple-500 to-violet-600 text-white text-xs px-2 py-0.5 shadow-md">
                             <PackageCheck className="w-3 h-3" />
                             <span>تسليم جزئي • {Number(order.final_amount || 0).toLocaleString()}</span>
                           </Badge>
                         </div>
                       )}
                       
                        {/* شارة الإرجاع - أحمر تدرج مع أيقونة */}
                        {order.order_type === 'return' && (
                          <div className="relative group/return">
                            <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-rose-500/20 rounded-full blur-sm"></div>
                            <Badge className="relative flex items-center gap-1 bg-gradient-to-r from-red-500 to-rose-600 text-white text-xs px-2 py-0.5 shadow-md">
                              <RotateCcw className="w-3 h-3" />
                              <span>ترجيع {Math.abs(order.refund_amount || 0).toLocaleString()}</span>
                            </Badge>
                          </div>
                        )}
                       
                       {/* شارة الاستبدال - بنفسجي تدرج مع أيقونة */}
                       {order.order_type === 'replacement' && (
                         <div className="relative group/exchange">
                           <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-violet-500/20 rounded-full blur-sm"></div>
                           <Badge className="relative flex items-center gap-1 bg-gradient-to-r from-purple-500 to-violet-600 text-white text-xs px-2 py-0.5 shadow-md">
                             <RefreshCcw className="w-3 h-3" />
                             <span>استبدال</span>
                           </Badge>
                         </div>
                       )}
                     </div>
                    
                    {paymentStatus && (
                      <div className="flex items-center gap-1 justify-end">
                        <span className="text-xs font-medium">{paymentStatus.label}</span>
                        <div className={`w-2 h-2 rounded-full ${paymentStatus.color}`}></div>
                      </div>
                    )}
                  </div>
                </div>

                {productSummary && (
                  <div className="ml-auto">
                    <div className="min-w-0">
                      
                       {/* ✅ تصميم احترافي لطلبات الاستبدال */}
                      {productSummary.type === 'exchange' && (
                        <div className="space-y-1.5">
                          {/* المنتجات الصادرة */}
                          {productSummary.outgoing.length > 0 && (
                            <div className="relative group/out">
                              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/10 rounded-lg blur-[2px] transition-all duration-300"></div>
                              
                              <div className="relative flex items-start gap-1 p-1 bg-gradient-to-br from-orange-50/90 to-amber-50/90 dark:from-orange-950/30 dark:to-amber-950/30 rounded-lg border border-orange-200/50 dark:border-orange-800/50 backdrop-blur-sm transition-all duration-300 max-w-[170px]">
                                {/* أيقونة صادر */}
                                <div className="flex-shrink-0 relative">
                                  <div className="absolute inset-0 bg-orange-500/20 rounded blur-[2px]"></div>
                                  <div className="relative flex items-center justify-center w-7 h-7 bg-gradient-to-br from-orange-500 to-amber-600 rounded shadow-md">
                                    <Package className="h-3.5 w-3.5 text-white" />
                                  </div>
                                </div>
                                
                                {/* المحتوى */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1 mb-0.5">
                                    <span className="text-[10px] font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider">
                                      صادر للزبون
                                    </span>
                                    <div className="h-px flex-1 bg-gradient-to-r from-orange-300/50 to-transparent"></div>
                                  </div>
                                  
                                  {productSummary.outgoing.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5 py-0.5">
                                      {item.colorHex && (
                                        <div className="relative">
                                          <div 
                                            className="w-3.5 h-3.5 rounded-full shadow-inner ring-1 ring-white dark:ring-gray-800 hover:scale-110 transition-transform duration-200" 
                                            style={{ 
                                              backgroundColor: item.colorHex,
                                              boxShadow: `0 1px 4px ${item.colorHex}40`
                                            }}
                                          />
                                        </div>
                                      )}
                                      
                                      <span className="font-semibold text-[11px] text-gray-900 dark:text-gray-100">
                                        {item.productName}
                                      </span>
                                      {item.color && (
                                        <span className="text-[10px] text-orange-600 dark:text-orange-400">
                                          • {item.color}
                                        </span>
                                      )}
                                      {item.size && (
                                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-orange-200/50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full">
                                          {item.size}
                                        </span>
                                      )}
                                      <span className="text-[10px] text-gray-600 dark:text-gray-400 ml-auto">
                                        × {item.quantity}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* المنتجات الواردة */}
                          {productSummary.incoming.length > 0 && (
                            <div className="relative group/in">
                              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-blue-500/10 rounded-lg blur-[2px] transition-all duration-300"></div>
                              
                              <div className="relative flex items-start gap-1 p-1 bg-gradient-to-br from-blue-50/90 to-cyan-50/90 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-lg border border-blue-200/50 dark:border-blue-800/50 backdrop-blur-sm transition-all duration-300 max-w-[170px]">
                                {/* أيقونة وارد */}
                                <div className="flex-shrink-0 relative">
                                  <div className="absolute inset-0 bg-blue-500/20 rounded blur-[2px]"></div>
                                  <div className="relative flex items-center justify-center w-7 h-7 bg-gradient-to-br from-blue-500 to-cyan-600 rounded shadow-md">
                                    <PackageCheck className="h-3.5 w-3.5 text-white" />
                                  </div>
                                </div>
                                
                                {/* المحتوى */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1 mb-0.5">
                                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                                      وارد من الزبون
                                    </span>
                                    <div className="h-px flex-1 bg-gradient-to-r from-blue-300/50 to-transparent"></div>
                                  </div>
                                  
                                  {productSummary.incoming.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5 py-0.5">
                                      {item.colorHex && (
                                        <div className="relative">
                                          <div 
                                            className="w-3.5 h-3.5 rounded-full shadow-inner ring-1 ring-white dark:ring-gray-800 hover:scale-110 transition-transform duration-200" 
                                            style={{ 
                                              backgroundColor: item.colorHex,
                                              boxShadow: `0 1px 4px ${item.colorHex}40`
                                            }}
                                          />
                                        </div>
                                      )}
                                      
                                      <span className="font-semibold text-[11px] text-gray-900 dark:text-gray-100">
                                        {item.productName}
                                      </span>
                                      {item.color && (
                                        <span className="text-[10px] text-blue-600 dark:text-blue-400">
                                          • {item.color}
                                        </span>
                                      )}
                                      {item.size && (
                                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-200/50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                                          {item.size}
                                        </span>
                                      )}
                                      <span className="text-[10px] text-gray-600 dark:text-gray-400 ml-auto">
                                        × {item.quantity}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* ✅ تصميم احترافي لطلبات الإرجاع */}
                      {productSummary.type === 'return' && (
                        <div className="space-y-1.5">
                          {/* المنتجات الواردة (الإرجاع) */}
                          {productSummary.incoming.length > 0 && (
                            <div className="relative group/in">
                              <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-green-500/10 rounded-lg blur-[2px] transition-all duration-300"></div>
                              
                              <div className="relative flex items-start gap-1 p-1 bg-gradient-to-br from-green-50/90 to-emerald-50/90 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg border border-green-200/50 dark:border-green-800/50 backdrop-blur-sm transition-all duration-300 max-w-[170px]">
                                {/* أيقونة وارد */}
                                <div className="flex-shrink-0 relative">
                                  <div className="absolute inset-0 bg-green-500/20 rounded blur-[2px]"></div>
                                  <div className="relative flex items-center justify-center w-7 h-7 bg-gradient-to-br from-green-500 to-emerald-600 rounded shadow-md">
                                    <PackageCheck className="h-3.5 w-3.5 text-white" />
                                  </div>
                                </div>
                                
                                {/* المحتوى */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1 mb-0.5">
                                    <span className="text-[10px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">
                                      وارد من الزبون
                                    </span>
                                    <div className="h-px flex-1 bg-gradient-to-r from-green-300/50 to-transparent"></div>
                                  </div>
                                  
                                  {productSummary.incoming.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5 py-0.5">
                                      <span className="font-semibold text-[11px] text-gray-900 dark:text-gray-100">
                                        {item.productName}
                                      </span>
                                      {item.color && (
                                        <span className="text-[10px] text-green-600 dark:text-green-400">
                                          • {item.color}
                                        </span>
                                      )}
                                      {item.size && (
                                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-200/50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                                          {item.size}
                                        </span>
                                      )}
                                      <span className="text-[10px] text-gray-600 dark:text-gray-400 ml-auto">
                                        × {item.quantity}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {productSummary.type === 'single' && (
                        <>
                          <div className="flex items-center gap-2 text-primary font-bold flex-row-reverse">
                            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 flex-shrink-0">
                              <Package className="h-4 w-4" />
                            </div>
                            <span className="text-sm">{productSummary.productName}</span>
                            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                              X{productSummary.quantity}
                            </span>
                          </div>
                          {productSummary.variantInfo && (
                            <div className="flex items-center gap-2 mt-1 justify-end mr-2">
                              <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-md font-medium">
                                {productSummary.variantInfo}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                      
                      {productSummary.type === 'single-multi-variant' && (
                        <>
                          <div className="flex items-center gap-2 text-primary font-bold flex-row-reverse">
                            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 flex-shrink-0">
                              <Package className="h-4 w-4" />
                            </div>
                            <span className="text-sm">{productSummary.productName}</span>
                            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                              X{productSummary.quantity}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 justify-end mr-2">
                            <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-md font-medium leading-relaxed">
                              {productSummary.variantsText}
                            </span>
                          </div>
                        </>
                      )}
                      
                      {productSummary.type === 'multiple' && (
                        <div className="space-y-1">
                          {productSummary.products.map((product, index) => (
                            <div key={index} className="flex items-center gap-2 text-primary font-bold flex-row-reverse">
                              {index === 0 && (
                                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 flex-shrink-0">
                                  <Package className="h-4 w-4" />
                                </div>
                              )}
                              {index > 0 && (
                                <span className="text-xs text-muted-foreground mr-2">+</span>
                              )}
                              <div className="flex items-center gap-2 flex-row-reverse">
                                <span className="text-sm">{product.productName}:</span>
                                {product.variantInfo && (
                                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-md font-medium">
                                    {product.variantInfo}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* ✅ تفاصيل التسليم الجزئي - مجاور السعر */}
                      {order.status === 'partial_delivery' && order.order_items && (
                        <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
                          {order.order_items.filter(i => i.item_status === 'delivered').map((item, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 justify-end">
                              <CheckCircle className="w-3 h-3" />
                              <span>{item.product?.name || 'منتج'} {item.variant?.color?.name && `- ${item.variant.color.name}`}</span>
                            </div>
                          ))}
                          {order.order_items.filter(i => i.item_status === 'pending_return' || i.item_status === 'returned').map((item, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400 justify-end">
                              <RotateCcw className="w-3 h-3" />
                              <span>{item.product?.name || 'منتج'} {item.variant?.color?.name && `- ${item.variant.color.name}`}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                    </div>
                  </div>
                )}
              </div>
            </div>



            <div className="flex justify-center pt-2 gap-2">
              {needsPartialDeliverySelection && (
                <Button
                  onClick={() => setShowPartialDelivery(true)}
                  variant="default"
                  size="sm"
                  className="relative group overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white border-0 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:scale-110 hover:-translate-y-1"
                >
                  {/* طبقة الإضاءة المتحركة */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  
                  {/* وهج خارجي */}
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-md blur opacity-30 group-hover:opacity-70 transition-opacity duration-500"></div>
                  
                  {/* المحتوى */}
                  <div className="relative flex items-center gap-2 px-2">
                    <Package className="w-4 h-4 animate-pulse" />
                    <span className="font-bold text-sm">تحديد المنتجات المُسلّمة</span>
                    <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                  </div>
                </Button>
              )}
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
      <PartialDeliveryDialog
        open={showPartialDelivery}
        onOpenChange={setShowPartialDelivery}
        order={order}
        onConfirm={() => {
          // تحديث العرض
          setShowPartialDelivery(false);
          window.dispatchEvent(new CustomEvent('orderUpdated', { detail: order.id }));
        }}
      />
    </motion.div>
  );
});

export default OrderCard;
