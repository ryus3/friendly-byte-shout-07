
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Phone, MapPin, Clock, Package, Truck, CheckCircle, XCircle, AlertTriangle, CornerDownLeft, Edit, Building, UserCircle, X, RefreshCw, Loader2, RotateCcw, PackageCheck, ChevronRight, ChevronLeft } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { toast } from '@/components/ui/use-toast';
import ReceiveInvoiceButton from '@/components/orders/ReceiveInvoiceButton';
import { getStatusForComponent } from '@/lib/order-status-translator';
import { useDeliveryTracking } from '@/hooks/useDeliveryTracking';
import OrderStatusHistory from '@/components/sales/OrderStatusHistory';

const getStatusInfo = (order) => {
  const statusConfig = getStatusForComponent(order);
  return {
    badge: statusConfig.color.replace('text-xs', 'px-4 py-2'), // تعديل الحجم للحوار
    icon: React.createElement(statusConfig.icon, { className: "w-4 h-4" }),
    text: statusConfig.label
  };
};

  const statusOptions = [
    { value: 'pending', label: 'قيد التجهيز' },
    { value: 'shipped', label: 'تم الشحن' },
    { value: 'delivery', label: 'قيد التوصيل' },
    { value: 'delivered', label: 'تم التسليم' },
    { value: 'completed', label: 'مكتمل' },
    { value: 'cancelled', label: 'ملغي' },
    { value: 'returned', label: 'راجعة' },
    { value: 'returned_in_stock', label: 'راجع للمخزن' },
    { value: 'unknown', label: 'غير معروف' }
  ];

const OrderDetailsDialog = ({ 
  order, 
  open, 
  onOpenChange, 
  onUpdate, 
  onEditOrder, 
  canEditStatus = false, 
  sellerName,
  orders = [],              // قائمة جميع الطلبات للتنقل
  currentIndex = -1,        // الفهرس الحالي
  onNavigatePrev,           // دالة التنقل للسابق
  onNavigateNext            // دالة التنقل للتالي
}) => {
  const [newStatus, setNewStatus] = useState(order?.status);
  const [syncing, setSyncing] = useState(false);
  const [checkingInvoice, setCheckingInvoice] = useState(false);
  const { syncOrderByTracking, syncOrderByQR, activePartner, isLoggedIn } = useAlWaseet();
  const { trackingData, loading: trackingLoading } = useDeliveryTracking(order?.id);

  React.useEffect(() => {
    if (order) {
      setNewStatus(order.status);
    }
  }, [order]);
  
  if (!order) return null;

  // استخدام النظام الموحد للحالات
  const statusInfo = getStatusInfo(order);
  const customerInfo = order.customerinfo || {
    name: order.customer_name,
    phone: order.customer_phone,
    address: order.customer_address,
    city: order.customer_city,
    province: order.customer_province
  };
  
  const getOrderDate = () => {
    const dateString = order.created_at || order.createdAt;
    if (!dateString) return 'لا يوجد تاريخ';
    const date = parseISO(dateString);
    if (!isValid(date)) return 'تاريخ غير صالح';
    return format(date, 'd/M/yyyy, h:mm a');
  };
  
  const handleUpdateStatus = () => {
    if (onUpdate && newStatus !== order.status) {
      onUpdate(order.id, { status: newStatus });
    }
    onOpenChange(false);
  };

  const handleEditClick = () => {
    if(onEditOrder){
      onOpenChange(false); // Close this dialog
      onEditOrder(order); // Open the edit dialog
    }
  };

  const handleSyncWithDelivery = async () => {
    if (!order?.tracking_number || activePartner === 'local' || !isLoggedIn) {
      toast({
        title: "غير متاح",
        description: "المزامنة متاحة فقط للطلبات المرسلة لشركة التوصيل المسجل دخولها",
        variant: "default"
      });
      return;
    }

    setSyncing(true);
    try {
      // استخدام الدالة الجديدة للمزامنة المباشرة
      const syncResult = await syncOrderByQR(order.tracking_number);
      
      // التحقق من الحذف التلقائي
      if (syncResult && syncResult.autoDeleted) {
        // إغلاق الحوار وإظهار رسالة الحذف التلقائي
        onOpenChange(false);
        
        toast({
          title: "تم حذف الطلب تلقائياً",
          description: syncResult.message,
          variant: "default"
        });
        
        // إعادة تحميل الصفحة لإزالة الطلب المحذوف
        setTimeout(() => {
          window.location.reload();
        }, 1500);
        
        return;
      }
      
      if (syncResult && syncResult.needs_update) {
        // إعادة تحميل الصفحة لإظهار التحديثات
        window.location.reload();
        
        toast({
          title: "تمت المزامنة بنجاح",
          description: `تم تحديث حالة الطلب إلى: ${syncResult.updates.status}`,
          variant: "success"
        });
      } else if (syncResult) {
        toast({
          title: "الطلب محدث",
          description: "الطلب محدث بالفعل ولا يحتاج لمزامنة",
          variant: "default"
        });
      }
    } catch (error) {
      toast({
        title: "خطأ في المزامنة",
        description: "حدث خطأ أثناء المزامنة مع شركة التوصيل",
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleCheckInvoiceStatus = async () => {
    if (!order?.tracking_number) {
      toast({
        title: "خطأ",
        description: "لا يوجد رقم تتبع للطلب",
        variant: "destructive",
      });
      return;
    }

    setCheckingInvoice(true);
    try {
      // Call the retroactive linking function first
      const { data: linkResult, error: linkError } = await supabase.rpc('retroactive_link_orders_by_qr');
      
      // ✅ Call the sync recent invoices function
      const { data: syncResult, error: syncError } = await supabase.rpc('sync_recent_received_invoices');
      
      if (syncError) {
        toast({
          title: "خطأ في المزامنة",
          description: `فشلت المزامنة: ${syncError.message}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "تم فحص الفواتير",
          description: `تم تحديث ${syncResult.updated_orders_count || 0} طلب`,
        });
        
        // Refresh the page after successful sync
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
      
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء فحص حالة الفاتورة",
        variant: "destructive",
      });
    } finally {
      setCheckingInvoice(false);
    }
  };

  const canEditOrder = order.status === 'pending';
  const canSyncOrder = order?.tracking_number && order?.delivery_partner && order.delivery_partner !== 'محلي' && activePartner !== 'local' && isLoggedIn;
  
  // تقييد تعديل الحالة للطلبات الخارجية المشحونة/المسلمة
  const isExternalOrder = order?.delivery_partner && order.delivery_partner !== 'محلي';
  const isShippedOrDelivered = ['shipped', 'delivery', 'delivered', 'completed'].includes(order.status);
  const canEditStatusForOrder = canEditStatus && (!isExternalOrder || order.status === 'pending' || order.status === 'returned_in_stock');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-row items-center justify-between border-b pb-4">
          <div>
            <DialogTitle className="gradient-text">تفاصيل الطلب</DialogTitle>
            <DialogDescription className="text-right text-muted-foreground">معلومات كاملة عن الطلب والشحنة.</DialogDescription>
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="space-y-6 p-6">
            <div className="flex items-center justify-between p-4 bg-secondary rounded-lg border border-border">
              <div>
                <div>
                  <h3 className="text-lg font-bold text-foreground break-all">
                    #{order.delivery_partner_order_id || order.tracking_number || order.order_number}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {order.delivery_partner !== 'محلي' && order.tracking_number && !order.tracking_number.startsWith('RYUS-') ? (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        طلب خارجي - {order.delivery_partner}
                      </span>
                    ) : (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        طلب محلي
                      </span>
                    )}

                    {/* شارات فاتورة الوسيط المحسنة */}
                    {order.delivery_partner === 'alwaseet' && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {order.delivery_partner_invoice_id ? (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-medium">
                            فاتورة الوسيط: {order.delivery_partner_invoice_id} ✓
                          </span>
                        ) : order.receipt_received ? (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">
                            مستلم يدوياً
                          </span>
                        ) : (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-medium">
                            بانتظار الفاتورة
                          </span>
                        )}
                        
                        {order.delivery_partner_order_id && (
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                            معرف الوسيط: {order.delivery_partner_order_id}
                          </span>
                        )}
                      </div>
                    )}

                    {/* معلومات وقت استلام الفاتورة */}
                    {order.invoice_received_at && (
                      <span className="text-xs text-muted-foreground">
                        استلمت: {format(parseISO(order.invoice_received_at), 'd/M/yyyy h:mm a', { locale: ar })}
                      </span>
                    )}
                  </div>
                </div>
                {false && (
                  <p className="text-xs text-muted-foreground font-mono">
                    رقم النظام: {order.order_number}
                  </p>
                )}
                <p className="text-muted-foreground text-sm">{getOrderDate()}</p>
              </div>
              <div className="flex flex-col gap-2 items-end">
                <div className={`inline-flex items-center gap-2 text-sm font-medium ${statusInfo.badge}`}>
                  {statusInfo.icon} {statusInfo.text}
                </div>
                {order.delivery_partner !== 'محلي' && order.delivery_status && order.delivery_status !== statusInfo.text && (
                  <div className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded border">
                    <span>{order.delivery_partner === 'modon' ? 'مدن:' : order.delivery_partner === 'alwaseet' ? 'الوسيط:' : 'الشريك:'}</span> {order.delivery_status}
                  </div>
                )}
                {order.updated_at && (
                  <div className="text-xs text-muted-foreground">
                    آخر تحديث: {format(parseISO(order.updated_at), 'd/M/yyyy h:mm a', { locale: ar })}
                  </div>
                )}
                {order.last_synced_at && ['alwaseet','modon'].includes(order.delivery_partner) && (
                  <div className="text-xs text-muted-foreground">
                    آخر مزامنة: {format(parseISO(order.last_synced_at), 'd/M/yyyy h:mm a', { locale: ar })}
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 bg-secondary rounded-lg border border-border">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-3 gap-2">
                <h4 className="font-semibold text-foreground">معلومات العميل</h4>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {sellerName && (
                        <div className="flex items-center gap-1">
                            <UserCircle className="w-3 h-3"/>
                            <span>البائع: {sellerName}</span>
                        </div>
                    )}
                      <div className="flex items-center gap-1.5">
                         <Building className="w-3 h-3"/>
                         <span className="font-medium">
                           {order.delivery_partner === 'محلي' || !order.delivery_partner ? 'توصيل محلي' : 
                            order.delivery_partner === 'alwaseet' ? 'AL WASEET' :
                            order.delivery_partner === 'modon' ? 'MODON' :
                            order.delivery_partner}
                         </span>
                     </div>
                     {order.delivery_account_used && order.delivery_partner !== 'محلي' && (
                       <div className="flex items-center gap-1.5 text-xs text-primary">
                         <UserCircle className="w-3 h-3"/>
                         <span>الحساب: {order.delivery_account_used}</span>
                       </div>
                     )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><User className="w-4 h-4" /><span>{customerInfo.name || 'زبون غير معروف'}</span></div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>{customerInfo.phone || order.customer_phone || 'لا يوجد رقم هاتف'}</span>
                  </div>
                  {(customerInfo.phone2 || order.customer_phone2) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <span>{customerInfo.phone2 || order.customer_phone2}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground sm:col-span-2"><MapPin className="w-4 h-4" /><span>{customerInfo.city}{customerInfo.province ? ` - ${customerInfo.province}` : ''}</span></div>
                {customerInfo.notes && (<div className="sm:col-span-2 text-muted-foreground"><strong>ملاحظات:</strong> {customerInfo.notes}</div>)}
               </div>
             </div>

             {/* Order Status History - سجل حركات الطلب */}
             <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
               <OrderStatusHistory orderId={order.id} />
             </div>
 
             {/* زر استلام الفاتورة في المعاينة */}
             {order.status === 'delivered' && !order.receipt_received && (
               <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                 <div className="flex items-center justify-between">
                   <div>
                     <h4 className="font-semibold text-amber-800">استلام الفاتورة</h4>
                     <p className="text-sm text-amber-700">يجب استلام الفاتورة لإكمال الطلب وتسوية الأرباح</p>
                   </div>
                   <ReceiveInvoiceButton 
                     order={order} 
                     onSuccess={() => {
                       onOpenChange(false);
                       window.location.reload(); // إعادة تحميل لإظهار التحديثات
                     }} 
                   />
                 </div>
               </div>
             )}

             {/* معلومات استلام الفاتورة إذا تم الاستلام */}
              {order.receipt_received && (
                <div className="p-4 rounded-lg border bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-700">
                  <h4 className="font-semibold mb-2 text-emerald-800 dark:text-emerald-100">تفاصيل استلام الفاتورة</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-emerald-700 dark:text-emerald-200">تاريخ الاستلام:</span>
                      <span className="font-medium text-foreground">
                        {order.receipt_received_at && format(parseISO(order.receipt_received_at), 'd/M/yyyy h:mm a', { locale: ar })}
                      </span>
                    </div>
                    {order.delivery_partner_invoice_id && (
                      <div className="flex justify-between">
                        <span className="text-emerald-700 dark:text-emerald-200">رقم فاتورة الشريك:</span>
                        <span className="font-medium text-foreground">{order.delivery_partner_invoice_id}</span>
                      </div>
                    )}
                    {order.delivery_partner_invoice_date && (
                      <div className="flex justify-between">
                        <span className="text-emerald-700 dark:text-emerald-200">تاريخ فاتورة الشريك:</span>
                        <span className="font-medium text-foreground">
                          {format(parseISO(order.delivery_partner_invoice_date), 'd/M/yyyy', { locale: ar })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* عرض معلومات الطلب الأصلي إذا كان طلب إرجاع */}
              {order.order_type === 'return' && (
                <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 mb-3">
                    <RotateCcw className="w-5 h-5 text-red-600 dark:text-red-400" />
                    <h4 className="font-semibold text-red-800 dark:text-red-200">طلب إرجاع</h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-red-700 dark:text-red-300">مبلغ الإرجاع:</span>
                      <span className="font-bold text-red-900 dark:text-red-100 text-lg">
                        -{Math.abs(order.refund_amount || 0).toLocaleString()} د.ع
                      </span>
                    </div>
                    {order.ai_orders?.[0]?.original_order_id && (
                      <div className="pt-2 border-t border-red-200 dark:border-red-800">
                        <span className="text-red-700 dark:text-red-300">مرتبط بالطلب الأصلي:</span>
                        <span className="font-medium text-red-900 dark:text-red-100 mr-2">
                          #{order.ai_orders[0].original_order_id}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="p-4 bg-secondary rounded-lg border border-border">
                <h4 className="font-semibold text-foreground mb-3">المنتجات</h4>
                
                {/* ✅ عرض احترافي لطلبات الاستبدال */}
                {(order.order_type === 'exchange' || order.order_type === 'replacement') && order.exchange_metadata ? (
                  <div className="space-y-2.5">
                    {/* المنتجات الصادرة */}
                    {order.exchange_metadata.outgoing_items?.length > 0 && (
                      <div className="relative group/out">
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/10 rounded-xl blur-[2px] transition-all duration-300"></div>
                        
                        <div className="relative p-2.5 bg-gradient-to-br from-orange-50/90 to-amber-50/90 dark:from-orange-950/30 dark:to-amber-950/30 rounded-xl border border-orange-200/50 dark:border-orange-800/50 backdrop-blur-sm transition-all duration-300 w-full">
                          {/* أيقونة وعنوان */}
                          <div className="flex items-center gap-2.5 mb-2.5">
                            <div className="flex-shrink-0 relative">
                              <div className="absolute inset-0 bg-orange-500/20 rounded-lg blur-md"></div>
                              <div className="relative flex items-center justify-center w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg shadow-lg">
                                <Package className="h-5 w-5 text-white" />
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider">
                                  صادر للزبون
                                </span>
                                <div className="h-px flex-1 bg-gradient-to-r from-orange-300/50 to-transparent"></div>
                              </div>
                            </div>
                          </div>
                          
                          {/* قائمة المنتجات */}
                          <div className="space-y-1.5">
                            {order.exchange_metadata.outgoing_items.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2 p-1.5 bg-white/50 dark:bg-gray-900/30 rounded-lg">
                                {item.color_hex && (
                                  <div className="relative">
                                    <div 
                                      className="w-5 h-5 rounded-full shadow-inner ring-2 ring-white dark:ring-gray-800 hover:scale-110 transition-transform duration-200" 
                                      style={{ 
                                        backgroundColor: item.color_hex,
                                        boxShadow: `0 2px 8px ${item.color_hex}40`
                                      }}
                                    />
                                  </div>
                                )}
                                
                                <span className="font-semibold text-[11px] text-gray-900 dark:text-gray-100">
                                  {item.product_name}
                                </span>
                                {item.color && (
                                  <span className="text-[11px] text-orange-600 dark:text-orange-400">
                                    • {item.color}
                                  </span>
                                )}
                                {item.size && (
                                  <span className="px-1.5 py-0.5 text-[11px] font-medium bg-orange-200/50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full">
                                    {item.size}
                                  </span>
                                )}
                                <span className="text-[11px] text-gray-600 dark:text-gray-400 ml-auto">
                                  × {item.quantity}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* المنتجات الواردة */}
                    {order.exchange_metadata.incoming_items?.length > 0 && (
                      <div className="relative group/in">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-blue-500/10 rounded-xl blur-[2px] transition-all duration-300"></div>
                        
                        <div className="relative p-2.5 bg-gradient-to-br from-blue-50/90 to-cyan-50/90 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-xl border border-blue-200/50 dark:border-blue-800/50 backdrop-blur-sm transition-all duration-300 w-full">
                          {/* أيقونة وعنوان */}
                          <div className="flex items-center gap-2.5 mb-2.5">
                            <div className="flex-shrink-0 relative">
                              <div className="absolute inset-0 bg-blue-500/20 rounded-lg blur-md"></div>
                              <div className="relative flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg shadow-lg">
                                <PackageCheck className="h-5 w-5 text-white" />
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                                  وارد من الزبون
                                </span>
                                <div className="h-px flex-1 bg-gradient-to-r from-blue-300/50 to-transparent"></div>
                              </div>
                            </div>
                          </div>
                          
                          {/* قائمة المنتجات */}
                          <div className="space-y-1.5">
                            {order.exchange_metadata.incoming_items.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2 p-1.5 bg-white/50 dark:bg-gray-900/30 rounded-lg">
                                {item.color_hex && (
                                  <div className="relative">
                                    <div 
                                      className="w-5 h-5 rounded-full shadow-inner ring-2 ring-white dark:ring-gray-800 hover:scale-110 transition-transform duration-200" 
                                      style={{ 
                                        backgroundColor: item.color_hex,
                                        boxShadow: `0 2px 8px ${item.color_hex}40`
                                      }}
                                    />
                                  </div>
                                )}
                                
                                <span className="font-semibold text-[11px] text-gray-900 dark:text-gray-100">
                                  {item.product_name}
                                </span>
                                {item.color && (
                                  <span className="text-[11px] text-blue-600 dark:text-blue-400">
                                    • {item.color}
                                  </span>
                                )}
                                {item.size && (
                                  <span className="px-1.5 py-0.5 text-[11px] font-medium bg-blue-200/50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                                    {item.size}
                                  </span>
                                )}
                                <span className="text-[11px] text-gray-600 dark:text-gray-400 ml-auto">
                                  × {item.quantity}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* ✅ كرت المنتجات الواردة - طلبات الإرجاع */}
                    {order.order_type === 'return' && order.order_items?.filter(item => item.item_direction === 'incoming').length > 0 && (
                      <div className="mb-3">
                        <div className="relative group/in">
                          <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-green-500/10 rounded-xl blur-[2px] transition-all duration-300"></div>
                          
                          <div className="relative p-2.5 bg-gradient-to-br from-green-50/90 to-emerald-50/90 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl border border-green-200/50 dark:border-green-800/50 backdrop-blur-sm transition-all duration-300 w-full">
                            {/* أيقونة وعنوان */}
                            <div className="flex items-center gap-2.5 mb-2.5">
                              <div className="flex-shrink-0 relative">
                                <div className="absolute inset-0 bg-green-500/20 rounded-lg blur-md"></div>
                                <div className="relative flex items-center justify-center w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg shadow-lg">
                                  <PackageCheck className="h-5 w-5 text-white" />
                                </div>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">
                                    وارد من الزبون (إرجاع)
                                  </span>
                                  <div className="h-px flex-1 bg-gradient-to-r from-green-300/50 to-transparent"></div>
                                </div>
                              </div>
                            </div>
                            
                            {/* قائمة المنتجات */}
                            <div className="space-y-1.5">
                              {order.order_items.filter(item => item.item_direction === 'incoming').map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 p-1.5 bg-white/50 dark:bg-gray-900/30 rounded-lg">
                                  <span className="font-semibold text-[11px] text-gray-900 dark:text-gray-100">
                                    {item.product_name}
                                  </span>
                                  {item.color && (
                                    <span className="text-[11px] text-green-600 dark:text-green-400">
                                      • {item.color}
                                    </span>
                                  )}
                                  {item.size && (
                                    <span className="px-1.5 py-0.5 text-[11px] font-medium bg-green-200/50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                                      {item.size}
                                    </span>
                                  )}
                                  <span className="text-[11px] text-gray-600 dark:text-gray-400 ml-auto">
                                    × {item.quantity || 1}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* ✅ عرض معلومات التسليم الجزئي إذا وجدت */}
                    {order.status === 'partial_delivery' && trackingData && (
                      <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-300 dark:border-amber-800">
                        <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300 mb-2">
                          <PackageCheck className="w-4 h-4" />
                          <span>تسليم جزئي</span>
                        </div>
                        <div className="text-xs space-y-1">
                          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            <span>{trackingData.delivered_items_count || 0} منتج مُسلّم</span>
                          </div>
                          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                            <RotateCcw className="w-3 h-3" />
                            <span>{trackingData.returned_items_count || 0} منتج راجع</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      {(order.order_items || order.items || []).map((item, index) => {
                        const productName = item.products?.name || item.product_name || item.productName || 'منتج غير معروف';
                        const colorName = item.product_variants?.colors?.name || item.color || '';
                        const sizeName = item.product_variants?.sizes?.name || item.size || '';
                        const itemTotal = item.total_price || item.total || (item.unit_price * item.quantity) || 0;
                        const itemStatus = item.item_status;
                        
                        return (
                          <div key={index} className={`flex items-center justify-between p-3 bg-background rounded-lg ${
                            itemStatus === 'delivered' ? 'border-l-4 border-green-500' :
                            itemStatus === 'pending_return' || itemStatus === 'returned' ? 'border-l-4 border-orange-500' : ''
                          }`}>
                            <div className="flex items-center gap-2">
                              {itemStatus === 'delivered' && <CheckCircle className="w-4 h-4 text-green-500" />}
                              {(itemStatus === 'pending_return' || itemStatus === 'returned') && <RotateCcw className="w-4 h-4 text-orange-500" />}
                              <div>
                                <p className="font-medium text-foreground">{productName}</p>
                                <p className="text-sm text-muted-foreground">{colorName} {sizeName && `- ${sizeName}`} × {item.quantity}</p>
                                {itemStatus && itemStatus !== 'pending' && (
                                  <span className={`text-xs font-medium ${
                                    itemStatus === 'delivered' ? 'text-green-600' :
                                    itemStatus === 'pending_return' ? 'text-orange-600' :
                                    itemStatus === 'returned' ? 'text-blue-600' : ''
                                  }`}>
                                    {itemStatus === 'delivered' ? 'مُسلّم' :
                                     itemStatus === 'pending_return' ? 'بانتظار الإرجاع' :
                                     itemStatus === 'returned' ? 'تم الإرجاع' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right"><p className="font-semibold text-primary">{itemTotal.toLocaleString()} د.ع</p></div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                  <div className="mt-4 pt-4 border-t border-border space-y-2">
                    {order.order_type === 'return' ? (
                      /* 🔴 عرض خاص لطلبات الإرجاع */
                      <>
                        <div className="flex justify-between items-center text-sm bg-red-50 dark:bg-red-950/20 p-3 rounded">
                          <span className="text-red-700 dark:text-red-300 font-medium">المبلغ المدفوع للزبون</span>
                          <span className="text-red-900 dark:text-red-100 font-bold text-lg">
                            {Math.abs(order.refund_amount || 0).toLocaleString()} د.ع
                          </span>
                        </div>
                        
                        <div className="text-xs text-muted-foreground space-y-1 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
                          <p className="font-medium text-amber-800 dark:text-amber-200">📌 ملاحظات مهمة:</p>
                          <ul className="list-disc list-inside space-y-0.5 text-amber-700 dark:text-amber-300">
                            <li>المبلغ يُدفع للزبون نقداً</li>
                            <li>عند تغيير الحالة لـ "21" يُخصم من أرباح الطلب الأصلي</li>
                            <li>عند تغيير الحالة لـ "17" يُرجع المنتج للمخزون تلقائياً</li>
                          </ul>
                        </div>
                        
                        {order.delivery_fee > 0 && (
                          <div className="text-xs text-muted-foreground pt-1 border-t space-y-1">
                            <div className="flex justify-between">
                              <span>رسوم التوصيل (مضافة)</span>
                              <span>{(order.delivery_fee || 0).toLocaleString()} د.ع</span>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      /* ✅ العرض العادي للطلبات العادية */
                      <>
                        {/* السعر الأصلي (المنتجات قبل الخصم) */}
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">السعر الأصلي (المنتجات)</span>
                          <span className="text-foreground">
                            {((order.total_amount || 0) + (order.discount || 0)).toLocaleString()} د.ع
                          </span>
                        </div>
                        
                        {/* الخصم */}
                        {(order.discount || 0) > 0 && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-orange-500 font-medium">الخصم</span>
                            <span className="text-orange-500 font-bold">-{(order.discount || 0).toLocaleString()} د.ع</span>
                          </div>
                        )}
                        
                        {/* الزيادة - إخفاء في طلبات الاستبدال */}
                        {(order.price_increase || 0) > 0 && order.order_type !== 'replacement' && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-green-600 font-medium">زيادة السعر</span>
                            <span className="text-green-600 font-bold">+{(order.price_increase || 0).toLocaleString()} د.ع</span>
                          </div>
                        )}
                        
                        {/* تفصيل السعر */}
                        <div className="text-xs text-muted-foreground pt-1 border-t space-y-1">
                          <div className="flex justify-between">
                            <span>المنتجات</span>
                            <span>{(order.total_amount || 0).toLocaleString()} د.ع</span>
                          </div>
                          <div className="flex justify-between">
                            <span>رسوم التوصيل</span>
                            <span>{(order.delivery_fee || 0).toLocaleString()} د.ع</span>
                          </div>
                        </div>
                        
                        {/* المجموع النهائي */}
                        <div className="flex justify-between items-center pt-2 border-t-2 border-primary/20">
                          <span className="text-lg font-bold">المبلغ النهائي</span>
                          <span className="text-xl font-bold text-primary">
                            {(order.final_amount || 0).toLocaleString()} د.ع
                          </span>
                        </div>
                      </>
                    )}
                  </div>
            </div>
            
            {/* قسم تحديث الحالة - للموظفين والمديرين */}
            {canEditStatusForOrder && (
              <div className="p-4 bg-secondary rounded-lg border border-border">
                <h4 className="font-semibold text-foreground mb-3">تحديث حالة الطلب</h4>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الحالة الجديدة" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="gap-2 pt-4 border-t">
          <div className="flex items-center justify-between w-full flex-wrap gap-2">
            {/* أزرار التنقل بين الطلبات */}
            <div className="flex items-center gap-2">
              {orders.length > 0 && onNavigatePrev && onNavigateNext && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={onNavigatePrev}
                    disabled={currentIndex <= 0}
                  >
                    <ChevronRight className="w-4 h-4 ml-1" />
                    السابق
                  </Button>
                  
                  <span className="text-sm text-muted-foreground px-2">
                    {currentIndex + 1} من {orders.length}
                  </span>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={onNavigateNext}
                    disabled={currentIndex >= orders.length - 1}
                  >
                    التالي
                    <ChevronLeft className="w-4 h-4 mr-1" />
                  </Button>
                </>
              )}
            </div>

            {/* أزرار الإجراءات */}
            <div className="flex items-center gap-2 flex-wrap">
              {canSyncOrder && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSyncWithDelivery} 
                  disabled={syncing}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-blue-400 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  {syncing ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <RefreshCw className="w-4 h-4 ml-2" />}
                  {syncing ? 'جاري التحقق...' : 'تحقق الآن'}
                </Button>
              )}
              {canEditOrder && onEditOrder && (
                <Button variant="secondary" size="sm" onClick={handleEditClick}>
                  <Edit className="w-4 h-4 ml-2" />
                  تعديل الطلب
                </Button>
              )}
              {canEditStatusForOrder && (
                <Button size="sm" onClick={handleUpdateStatus} disabled={newStatus === order.status}>
                  <Edit className="w-4 h-4 ml-2" />
                  تحديث الحالة
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailsDialog;
