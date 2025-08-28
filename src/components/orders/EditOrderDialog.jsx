import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QuickOrderContent } from '@/components/quick-order/QuickOrderContent';
import { ScrollArea } from '@/components/ui/scroll-area';

const EditOrderDialog = ({ open, onOpenChange, order, onOrderUpdated }) => {
  // تحويل بيانات الطلب لصيغة البيانات المطلوبة لـ QuickOrderContent
  const convertOrderToEditData = (order) => {
    if (!order) return null;
    
    // تحويل المنتجات لصيغة cart items
    const cartItems = (order.items || []).map(item => ({
      id: `${item.product_id}-${item.variant_id || 'no-variant'}`,
      productId: item.product_id,
      variantId: item.variant_id,
      productName: item.productname || item.product_name || 'منتج',
      size: item.size || '',
      color: item.color || '',
      price: item.unit_price || item.price || 0,
      quantity: item.quantity || 1,
      total: (item.unit_price || item.price || 0) * (item.quantity || 1),
      image: item.image || '/placeholder.svg',
      barcode: item.barcode || '',
      sku: item.sku || ''
    }));

    return {
      // معلومات العميل
      customer_name: order.customer_name || '',
      customer_phone: order.customer_phone || '',
      customer_phone2: order.customer_phone2 || '',
      customer_city: order.customer_city || '',
      customer_province: order.customer_province || order.region || '',
      customer_address: order.customer_address || '',
      
      // تفاصيل الطلب
      notes: order.notes || '',
      total_amount: order.total_amount || 0,
      delivery_fee: order.delivery_fee || 0,
      delivery_partner: order.delivery_partner || 'محلي',
      tracking_number: order.tracking_number || '',
      order_number: order.order_number || '',
      
      // المنتجات
      items: cartItems,
      
      // بيانات إضافية للتعديل
      editMode: true,
      orderId: order.id,
      originalOrder: order
    };
  };

  const handleOrderUpdated = (updatedOrder) => {
    if (onOrderUpdated) {
      onOrderUpdated(updatedOrder);
    }
    onOpenChange(false);
  };

  const editData = convertOrderToEditData(order);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] p-0 gap-0 bg-gradient-to-br from-background/95 via-background to-background/90 backdrop-blur-lg">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="relative h-full flex flex-col">
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-card/80 to-card/60 backdrop-blur-sm">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary via-purple-600 to-blue-600 bg-clip-text text-transparent">
              ✏️ تعديل الطلب - {order?.order_number || order?.tracking_number}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 p-0">
            <div className="p-6">
              {editData ? (
                <QuickOrderContent
                  isDialog={true}
                  aiOrderData={editData}
                  onOrderCreated={handleOrderUpdated}
                  key={`edit-${order?.id}`} // لإعادة تحميل المكون عند تغيير الطلب
                />
              ) : (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-muted-foreground">
                      خطأ في تحميل بيانات الطلب
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      لم يتم العثور على بيانات الطلب المطلوب تعديله
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditOrderDialog;