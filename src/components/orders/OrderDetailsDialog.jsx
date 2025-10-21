
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Phone, MapPin, Clock, Package, Truck, CheckCircle, XCircle, AlertTriangle, CornerDownLeft, Edit, Building, UserCircle, X, RefreshCw, Loader2, RotateCcw } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { toast } from '@/components/ui/use-toast';
import ReceiveInvoiceButton from '@/components/orders/ReceiveInvoiceButton';
import { getStatusForComponent } from '@/lib/order-status-translator';
import { useDeliveryTracking } from '@/hooks/useDeliveryTracking';

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

const OrderDetailsDialog = ({ order, open, onOpenChange, onUpdate, onEditOrder, canEditStatus = false, sellerName }) => {
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
      console.log(`🔄 مزامنة الطلب ${order.tracking_number}...`);
      
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
      } else {
        // لا نعرض رسالة خطأ هنا لأن syncOrderByQR تتعامل مع الحذف التلقائي
        console.log("⚠️ لم يتم العثور على الطلب في الوسيط أو لا يحتاج تحديث");
      }
    } catch (error) {
      console.error('❌ خطأ في مزامنة الطلب:', error);
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
      console.log("🔍 Checking invoice status for order:", order.tracking_number);
      
      // Call the retroactive linking function first
      const { data: linkResult, error: linkError } = await supabase.rpc('retroactive_link_orders_by_qr');
      
      if (linkError) {
        console.error("Error linking orders:", linkError);
      } else {
        console.log("✅ Link result:", linkResult);
      }
      
      // Call the sync recent invoices function
      const { data: syncResult, error: syncError } = await supabase.rpc('sync_recent_received_invoices');
      
      if (syncError) {
        console.error("Error syncing invoices:", syncError);
        toast({
          title: "خطأ في المزامنة",
          description: "حدث خطأ أثناء فحص الفواتير",
          variant: "destructive",
        });
      } else {
        console.log("✅ Sync result:", syncResult);
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
      console.error("Error checking invoice status:", error);
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
                    <span>الوسيط:</span> {order.delivery_status}
                  </div>
                )}
                {order.updated_at && (
                  <div className="text-xs text-muted-foreground">
                    آخر تحديث: {format(parseISO(order.updated_at), 'd/M/yyyy h:mm a', { locale: ar })}
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
                         <span className="font-medium">{order.delivery_partner === 'محلي' || !order.delivery_partner ? 'توصيل محلي' : order.delivery_partner}</span>
                     </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><User className="w-4 h-4" /><span>{customerInfo.name || 'زبون غير معروف'}</span></div>
                <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-4 h-4" /><span>{customerInfo.phone || 'لا يوجد رقم هاتف'}</span></div>
                <div className="flex items-center gap-2 text-muted-foreground sm:col-span-2"><MapPin className="w-4 h-4" /><span>{customerInfo.city}{customerInfo.province ? ` - ${customerInfo.province}` : ''}</span></div>
                {customerInfo.notes && (<div className="sm:col-span-2 text-muted-foreground"><strong>ملاحظات:</strong> {customerInfo.notes}</div>)}
               </div>
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
                  <div className="mt-4 pt-4 border-t border-border space-y-2">
                    {/* السعر الأصلي الكامل (قبل الخصم) */}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">السعر الأصلي</span>
                      <span className="text-foreground">
                        {((order.total_amount || 0) + (order.delivery_fee || 0)).toLocaleString()} د.ع
                      </span>
                    </div>
                    
                    {/* الخصم */}
                    {(order.discount || 0) > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-orange-500 font-medium">الخصم</span>
                        <span className="text-orange-500 font-bold">-{(order.discount || 0).toLocaleString()} د.ع</span>
                      </div>
                    )}
                    
                    {/* الزيادة */}
                    {(order.price_increase || 0) > 0 && (
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
          {canSyncOrder && (
            <Button 
              variant="outline" 
              onClick={handleSyncWithDelivery} 
              disabled={syncing}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-blue-400 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {syncing ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <RefreshCw className="w-4 h-4 ml-2" />}
              {syncing ? 'جاري التحقق...' : 'تحقق الآن'}
            </Button>
          )}
          {canEditOrder && onEditOrder && (
            <Button variant="secondary" onClick={handleEditClick}>
              <Edit className="w-4 h-4 ml-2" />
              تعديل الطلب
            </Button>
          )}
            {canEditStatusForOrder && (
            <Button onClick={handleUpdateStatus} disabled={newStatus === order.status}>
              <Edit className="w-4 h-4 ml-2" />
              تحديث الحالة
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailsDialog;
