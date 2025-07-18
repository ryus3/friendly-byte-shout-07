
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Phone, MapPin, Clock, Package, Truck, CheckCircle, XCircle, AlertTriangle, CornerDownLeft, Edit, Building, UserCircle } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';

const getStatusInfo = (status) => {
  switch (status) {
    case 'pending': return { badge: 'bg-[hsl(var(--status-pending)_/_0.2)] text-[hsl(var(--status-pending))] border-[hsl(var(--status-pending)_/_0.3)]', icon: <Clock className="w-4 h-4" />, text: 'قيد التجهيز' };
    case 'processing': return { badge: 'bg-[hsl(var(--status-processing)_/_0.2)] text-[hsl(var(--status-processing))] border-[hsl(var(--status-processing)_/_0.3)]', icon: <Package className="w-4 h-4" />, text: 'قيد المعالجة' };
    case 'shipped': return { badge: 'bg-[hsl(var(--status-shipped)_/_0.2)] text-[hsl(var(--status-shipped))] border-[hsl(var(--status-shipped)_/_0.3)]', icon: <Truck className="w-4 h-4" />, text: 'تم الشحن' };
    case 'delivery': return { badge: 'bg-[hsl(var(--status-delivery)_/_0.2)] text-[hsl(var(--status-delivery))] border-[hsl(var(--status-delivery)_/_0.3)]', icon: <Truck className="w-4 h-4" />, text: 'قيد التوصيل' };
    case 'delivered': return { badge: 'bg-[hsl(var(--status-delivered)_/_0.2)] text-[hsl(var(--status-delivered))] border-[hsl(var(--status-delivered)_/_0.3)]', icon: <CheckCircle className="w-4 h-4" />, text: 'تم التسليم' };
    case 'cancelled': return { badge: 'bg-[hsl(var(--status-cancelled)_/_0.2)] text-[hsl(var(--status-cancelled))] border-[hsl(var(--status-cancelled)_/_0.3)]', icon: <XCircle className="w-4 h-4" />, text: 'ملغي' };
    case 'returned': return { badge: 'bg-[hsl(var(--status-returned)_/_0.2)] text-[hsl(var(--status-returned))] border-[hsl(var(--status-returned)_/_0.3)]', icon: <CornerDownLeft className="w-4 h-4" />, text: 'راجعة' };
    case 'returned_in_stock': return { badge: 'bg-[hsl(var(--status-cancelled)_/_0.2)] text-[hsl(var(--status-cancelled))] border-[hsl(var(--status-cancelled)_/_0.3)]', icon: <Package className="w-4 h-4" />, text: 'تم الإرجاع للمخزن' };
    default: return { badge: 'bg-[hsl(var(--status-cancelled)_/_0.2)] text-[hsl(var(--status-cancelled))] border-[hsl(var(--status-cancelled)_/_0.3)]', icon: <Package className="w-4 h-4" />, text: 'تم الإرجاع للمخزن' };
  }
};

const statusOptions = [
  { value: 'pending', label: 'قيد التجهيز' },
  { value: 'processing', label: 'قيد المعالجة' },
  { value: 'shipped', label: 'تم الشحن' },
  { value: 'delivery', label: 'قيد التوصيل' },
  { value: 'delivered', label: 'تم التسليم' },
  { value: 'cancelled', label: 'ملغي' },
  { value: 'returned', label: 'راجعة' },
];

const OrderDetailsDialog = ({ order, open, onOpenChange, onUpdate, onEditOrder, canEditStatus, sellerName }) => {
  const [newStatus, setNewStatus] = useState(order?.status);

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

  const canEditOrder = order.status === 'pending';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full sm:max-w-2xl flex flex-col max-h-[90vh]">
        <DialogHeader><DialogTitle className="gradient-text">تفاصيل الطلب</DialogTitle></DialogHeader>
        <ScrollArea className="flex-grow -mx-6 px-6">
          <div className="space-y-6 pb-6">
            <div className="flex items-center justify-between p-4 bg-secondary rounded-lg border border-border">
              <div>
                <h3 className="text-lg font-bold text-foreground break-all">#{order.tracking_number || order.trackingnumber || 'لا يوجد رقم تتبع'}</h3>
                <p className="text-muted-foreground text-sm">{getOrderDate()}</p>
              </div>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${statusInfo.badge}`}>
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
                         <span className={`px-2 py-1 rounded text-xs font-medium border ${order.delivery_partner === 'محلي' || !order.delivery_partner ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                           {order.delivery_partner === 'محلي' || !order.delivery_partner ? 'توصيل محلي' : order.delivery_partner}
                         </span>
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
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
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
