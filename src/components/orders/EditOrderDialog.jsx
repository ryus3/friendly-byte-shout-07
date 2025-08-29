import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QuickOrderContent } from '@/components/quick-order/QuickOrderContent';
import { ScrollArea } from '@/components/ui/scroll-area';

const EditOrderDialog = ({ open, onOpenChange, order, onOrderUpdated }) => {
  console.log('🔍 EditOrderDialog - مُستقبل بيانات الطلب:', order);
  
  // تحويل بيانات الطلب لصيغة البيانات المطلوبة لـ QuickOrderContent
  const convertOrderToEditData = (order) => {
    if (!order) {
      console.log('❌ لا توجد بيانات طلب لـ EditOrderDialog');
      return null;
    }
    
    console.log('🔍 EditOrderDialog - بيانات الطلب الخام المُستقبلة:', order);
    console.log('🔍 EditOrderDialog - عناصر الطلب المتاحة:', order.order_items || order.items);
    
    // تحويل المنتجات لصيغة cart items مع product_id و variant_id للتحميل الصحيح
    const cartItems = (order.order_items || order.items || []).map(item => {
      console.log('🛒 تحويل عنصر:', item);
      return {
        id: `${item.product_id}-${item.variant_id || 'no-variant'}`,
        productId: item.product_id,
        variantId: item.variant_id,
        productName: item.productname || item.product_name || 'منتج',
        product_name: item.productname || item.product_name || 'منتج',
        size: item.size || '',
        color: item.color || '',
        price: item.unit_price || item.price || 0,
        unit_price: item.unit_price || item.price || 0,
        quantity: item.quantity || 1,
        total: (item.unit_price || item.price || 0) * (item.quantity || 1),
        image: item.image || '/placeholder.svg',
        barcode: item.barcode || '',
        sku: item.sku || '',
        // إضافة معرفات المنتج والمتغير للتحميل من النظام الموحد
        product_id: item.product_id,
        variant_id: item.variant_id,
        costPrice: item.cost_price || 0,
        cost_price: item.cost_price || 0
      };
    });

    console.log('🛒 EditOrderDialog - عناصر السلة المُحولة:', cartItems);

    const editData = {
      // معلومات العميل - مع ضمان وجود جميع البيانات
      customer_name: order.customer_name || '',
      customer_phone: order.customer_phone || '',
      customer_phone2: order.customer_phone2 || order.second_phone || '',
      customer_city: order.customer_city || order.city || '',
      customer_province: order.customer_province || order.region || order.province || '',
      customer_address: order.customer_address || order.address || '',
      
      // تفاصيل الطلب - مع حساب صحيح للأسعار
      notes: order.notes || '',
      total_amount: order.total_amount || order.final_amount || 0,
      delivery_fee: order.delivery_fee || 0,
      discount: order.discount || 0,
      // حساب الإجمالي مع رسوم التوصيل
      final_total: (order.total_amount || order.final_amount || 0) + (order.delivery_fee || 0),
      delivery_partner: order.delivery_partner || 'محلي',
      tracking_number: order.tracking_number || '',
      order_number: order.order_number || '',
      order_type: order.order_type || 'new',
      package_size: order.package_size || 'عادي',
      promocode: order.promocode || '',
      
      // المنتجات - مع معرفات صحيحة للتحميل
      items: cartItems,
      
      // بيانات إضافية للتعديل
      editMode: true,
      orderId: order.id,
      originalOrder: order
    };

    console.log('📋 EditOrderDialog - بيانات التعديل النهائية المُحضرة:', editData);
    return editData;
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
      <DialogContent 
        className="max-w-7xl max-h-[95vh] p-0 gap-0 bg-gradient-to-br from-background/95 via-background to-background/90 backdrop-blur-lg"
        dir="rtl"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="relative h-full flex flex-col" dir="rtl">
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-card/80 to-card/60 backdrop-blur-sm" dir="rtl">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary via-purple-600 to-blue-600 bg-clip-text text-transparent text-right" dir="rtl">
              ✏️ تعديل الطلب - {order?.order_number || order?.tracking_number}
              <div className="text-sm text-muted-foreground font-normal mt-1 text-right" dir="rtl">
                تاريخ الإنشاء: {order?.created_at ? new Date(order.created_at).toLocaleDateString('ar-SA') : ''}
                {order?.customer_name && ` • العميل: ${order.customer_name}`}
              </div>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 p-0" dir="rtl">
            <div className="p-6" dir="rtl">
              {editData ? (
                <QuickOrderContent
                  isDialog={true}
                  aiOrderData={editData}
                  onOrderCreated={handleOrderUpdated}
                  key={`edit-${order?.id}`} // لإعادة تحميل المكون عند تغيير الطلب
                />
              ) : (
                <div className="flex items-center justify-center h-64" dir="rtl">
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