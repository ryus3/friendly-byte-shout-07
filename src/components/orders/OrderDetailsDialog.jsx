
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Phone, MapPin, Clock, Package, Truck, CheckCircle, XCircle, AlertTriangle, CornerDownLeft, Edit, Building, UserCircle, X, RefreshCw, Loader2 } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { toast } from '@/components/ui/use-toast';

const getStatusInfo = (status) => {
  // التحقق من الحالات المحلية أولاً
  const localStatuses = {
    'pending': { badge: 'bg-gradient-to-r from-status-pending-start to-status-pending-end text-white border border-status-pending-border shadow-lg shadow-status-pending-shadow/40 font-bold rounded-lg px-4 py-2', icon: <Clock className="w-4 h-4" />, text: 'قيد التجهيز' },
    'shipped': { badge: 'bg-gradient-to-r from-status-shipped-start to-status-shipped-end text-white border border-status-shipped-border shadow-lg shadow-status-shipped-shadow/40 font-bold rounded-lg px-4 py-2', icon: <Truck className="w-4 h-4" />, text: 'تم الشحن' },
    'delivery': { badge: 'bg-gradient-to-r from-status-delivery-start to-status-delivery-end text-white border border-status-delivery-border shadow-lg shadow-status-delivery-shadow/40 font-bold rounded-lg px-4 py-2', icon: <Truck className="w-4 h-4" />, text: 'قيد التوصيل' },
    'delivered': { badge: 'bg-gradient-to-r from-status-delivered-start to-status-delivered-end text-white border border-status-delivered-border shadow-lg shadow-status-delivered-shadow/40 font-bold rounded-lg px-4 py-2', icon: <CheckCircle className="w-4 h-4" />, text: 'تم التسليم' },
    'completed': { badge: 'bg-gradient-to-r from-status-completed-start to-status-completed-end text-white border border-status-completed-border shadow-lg shadow-status-completed-shadow/40 font-bold rounded-lg px-4 py-2', icon: <CheckCircle className="w-4 h-4" />, text: 'مكتمل' },
    'cancelled': { badge: 'bg-gradient-to-r from-status-cancelled-start to-status-cancelled-end text-white border border-status-cancelled-border shadow-lg shadow-status-cancelled-shadow/40 font-bold rounded-lg px-4 py-2', icon: <XCircle className="w-4 h-4" />, text: 'ملغي' },
    'returned': { badge: 'bg-gradient-to-r from-status-returned-start to-status-returned-end text-white border border-status-returned-border shadow-lg shadow-status-returned-shadow/40 font-bold rounded-lg px-4 py-2', icon: <CornerDownLeft className="w-4 h-4" />, text: 'راجعة' },
    'returned_in_stock': { badge: 'bg-gradient-to-r from-status-returned-stock-start to-status-returned-stock-end text-white border border-status-returned-stock-border shadow-lg shadow-status-returned-stock-shadow/40 font-bold rounded-lg px-4 py-2', icon: <Package className="w-4 h-4" />, text: 'راجع للمخزن' },
    'return_received': { badge: 'bg-gradient-to-r from-status-returned-stock-start to-status-returned-stock-end text-white border border-status-returned-stock-border shadow-lg shadow-status-returned-stock-shadow/40 font-bold rounded-lg px-4 py-2', icon: <Package className="w-4 h-4" />, text: 'راجع للمخزن' }
  };
  
  if (localStatuses[status]) {
    return localStatuses[status];
  }
  
  // تطبيق نفس منطق OrderCard للحالات الخارجية
  if (status && typeof status === 'string') {
    const statusLower = status.toLowerCase();
    
    if (statusLower.includes('في الطريق') || statusLower.includes('en route')) {
      return { badge: 'bg-gradient-to-r from-orange-500 to-orange-600 text-white border border-orange-400 shadow-lg shadow-orange-500/40 font-bold rounded-lg px-4 py-2', icon: <Truck className="w-4 h-4" />, text: status };
    } else if (statusLower.includes('وصل') || statusLower.includes('arrived')) {
      return { badge: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border border-blue-400 shadow-lg shadow-blue-500/40 font-bold rounded-lg px-4 py-2', icon: <Truck className="w-4 h-4" />, text: status };
    } else if (statusLower.includes('خرج للتوصيل') || statusLower.includes('out for delivery')) {
      return { badge: 'bg-gradient-to-r from-green-400 to-green-500 text-white border border-green-300 shadow-lg shadow-green-400/40 font-bold rounded-lg px-4 py-2', icon: <Truck className="w-4 h-4" />, text: status };
    } else if (statusLower.includes('غير متواجد') || statusLower.includes('unavailable')) {
      return { badge: 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white border border-yellow-400 shadow-lg shadow-yellow-500/40 font-bold rounded-lg px-4 py-2', icon: <AlertTriangle className="w-4 h-4" />, text: status };
    } else if (statusLower.includes('تأخير') || statusLower.includes('delay')) {
      return { badge: 'bg-gradient-to-r from-red-400 to-red-500 text-white border border-red-300 shadow-lg shadow-red-400/40 font-bold rounded-lg px-4 py-2', icon: <Clock className="w-4 h-4" />, text: status };
    } else if (statusLower.includes('تسليم') || statusLower.includes('مسلم') || statusLower.includes('delivered')) {
      return { badge: 'bg-gradient-to-r from-status-delivered-start to-status-delivered-end text-white border border-status-delivered-border shadow-lg shadow-status-delivered-shadow/40 font-bold rounded-lg px-4 py-2', icon: <CheckCircle className="w-4 h-4" />, text: status };
    } else if (statusLower.includes('ملغي') || statusLower.includes('إلغاء') || statusLower.includes('cancel')) {
      return { badge: 'bg-gradient-to-r from-status-cancelled-start to-status-cancelled-end text-white border border-status-cancelled-border shadow-lg shadow-status-cancelled-shadow/40 font-bold rounded-lg px-4 py-2', icon: <XCircle className="w-4 h-4" />, text: status };
    } else if (statusLower.includes('راجع') || statusLower.includes('return')) {
      return { badge: 'bg-gradient-to-r from-status-returned-start to-status-returned-end text-white border border-status-returned-border shadow-lg shadow-status-returned-shadow/40 font-bold rounded-lg px-4 py-2', icon: <CornerDownLeft className="w-4 h-4" />, text: status };
    } else if (statusLower.includes('مندوب') || statusLower.includes('شحن') || statusLower.includes('ship')) {
      return { badge: 'bg-gradient-to-r from-status-shipped-start to-status-shipped-end text-white border border-status-shipped-border shadow-lg shadow-status-shipped-shadow/40 font-bold rounded-lg px-4 py-2', icon: <Truck className="w-4 h-4" />, text: status };
    } else if (statusLower.includes('انتظار') || statusLower.includes('محضر') || statusLower.includes('pending')) {
      return { badge: 'bg-gradient-to-r from-status-pending-start to-status-pending-end text-white border border-status-pending-border shadow-lg shadow-status-pending-shadow/40 font-bold rounded-lg px-4 py-2', icon: <Clock className="w-4 h-4" />, text: status };
    } else {
      // عرض الحالة الحقيقية مع تصميم جميل
      return { badge: 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white border border-purple-400 shadow-lg shadow-purple-500/40 font-bold rounded-lg px-4 py-2', icon: <AlertTriangle className="w-4 h-4" />, text: status };
    }
  }
  
  return { badge: 'bg-muted text-muted-foreground border-2 border-border shadow-sm font-medium rounded-lg px-4 py-2', icon: <AlertTriangle className="w-4 h-4" />, text: status || 'غير محدد' };
};

  const statusOptions = [
    { value: 'pending', label: 'قيد التجهيز' },
    { value: 'shipped', label: 'تم الشحن' },
    { value: 'delivery', label: 'قيد التوصيل' },
    { value: 'delivered', label: 'تم التسليم' },
    { value: 'completed', label: 'مكتمل' },
    { value: 'cancelled', label: 'ملغي' },
    { value: 'returned', label: 'راجعة' },
    { value: 'returned_in_stock', label: 'راجع للمخزن' }
  ];

const OrderDetailsDialog = ({ order, open, onOpenChange, onUpdate, onEditOrder, canEditStatus = false, sellerName }) => {
  const [newStatus, setNewStatus] = useState(order?.status);
  const [syncing, setSyncing] = useState(false);
  const { syncOrderByTracking, activePartner, isLoggedIn } = useAlWaseet();

  React.useEffect(() => {
    if (order) {
      setNewStatus(order.status);
    }
  }, [order]);
  
  if (!order) return null;

  const statusInfo = getStatusInfo(order.status);
  const customerInfo = order.customerinfo || {
    name: order.customer_name,
    phone: order.customer_phone,
    address: order.customer_address,
    city: order.customer_city
  };
  
  const getOrderDate = () => {
    const dateString = order.created_at || order.createdAt;
    if (!dateString) return 'لا يوجد تاريخ';
    const date = parseISO(dateString);
    if (!isValid(date)) return 'تاريخ غير صالح';
    return format(date, 'd MMMM yyyy, h:mm a', { locale: ar });
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
      const syncResult = await syncOrderByTracking(order.tracking_number);
      
      if (syncResult && syncResult.needs_update) {
        // تحديث حالة الطلب في قاعدة البيانات
        await onUpdate(order.id, syncResult.updates);
        
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
        toast({
          title: "خطأ في المزامنة",
          description: "لم يتم العثور على الطلب في شركة التوصيل",
          variant: "destructive"
        });
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

  const canEditOrder = order.status === 'pending';
  const canSyncOrder = order?.tracking_number && order?.delivery_partner && order.delivery_partner !== 'محلي' && activePartner !== 'local' && isLoggedIn;

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
                    #{order.tracking_number || order.order_number}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    {order.delivery_partner ? (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        طلب خارجي - {order.delivery_partner}
                      </span>
                    ) : (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        طلب محلي
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
              <div className={`inline-flex items-center gap-2 text-sm font-medium ${statusInfo.badge}`}>
                {statusInfo.icon} {statusInfo.text}
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
                <div className="flex items-center gap-2 text-muted-foreground sm:col-span-2"><MapPin className="w-4 h-4" /><span>{customerInfo.address || 'لا يوجد عنوان'}, {customerInfo.city || ''}</span></div>
                {customerInfo.notes && (<div className="sm:col-span-2 text-muted-foreground"><strong>ملاحظات:</strong> {customerInfo.notes}</div>)}
              </div>
            </div>
            <div className="p-4 bg-secondary rounded-lg border border-border">
              <h4 className="font-semibold text-foreground mb-3">المنتجات</h4>
               <div className="space-y-3">
                 {(order.order_items || order.items || []).map((item, index) => {
                   const productName = item.products?.name || item.product_name || item.productName || 'منتج غير معروف';
                   const colorName = item.product_variants?.colors?.name || item.color || '';
                   const sizeName = item.product_variants?.sizes?.name || item.size || '';
                   const itemTotal = item.total_price || item.total || (item.unit_price * item.quantity) || 0;
                   
                   return (
                     <div key={index} className="flex items-center justify-between p-3 bg-background rounded-lg">
                       <div>
                         <p className="font-medium text-foreground">{productName}</p>
                         <p className="text-sm text-muted-foreground">{colorName} {sizeName && `- ${sizeName}`} × {item.quantity}</p>
                       </div>
                       <div className="text-right"><p className="font-semibold text-primary">{itemTotal.toLocaleString()} د.ع</p></div>
                     </div>
                   );
                 })}
               </div>
               <div className="mt-4 pt-4 border-t border-border space-y-2">
                 <div className="flex justify-between items-center text-sm">
                   <span className="text-muted-foreground">المجموع الفرعي</span>
                   <span className="text-foreground">{(order.total_amount || 0).toLocaleString()} د.ع</span>
                 </div>
                 {(order.delivery_fee || 0) > 0 && (
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-muted-foreground">رسوم التوصيل</span>
                     <span className="text-foreground">{(order.delivery_fee || 0).toLocaleString()} د.ع</span>
                   </div>
                 )}
                 {(order.discount || 0) > 0 && (
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-muted-foreground">الخصم</span>
                     <span className="text-destructive">-{(order.discount || 0).toLocaleString()} د.ع</span>
                   </div>
                 )}
                 <div className="flex justify-between items-center pt-2 border-t">
                   <span className="text-lg font-semibold text-foreground">المجموع الكلي</span>
                   <span className="text-xl font-bold text-primary">{(order.final_amount || order.total || 0).toLocaleString()} د.ع</span>
                 </div>
               </div>
            </div>
            
            {/* قسم تحديث الحالة - للموظفين والمديرين */}
            {canEditStatus && (
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
            <Button variant="outline" onClick={handleSyncWithDelivery} disabled={syncing}>
              {syncing ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <RefreshCw className="w-4 h-4 ml-2" />}
              مزامنة مع شركة التوصيل
            </Button>
          )}
          {canEditOrder && onEditOrder && (
            <Button variant="secondary" onClick={handleEditClick}>
              <Edit className="w-4 h-4 ml-2" />
              تعديل الطلب
            </Button>
          )}
          {canEditStatus && (
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
