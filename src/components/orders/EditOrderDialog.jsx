import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QuickOrderContent } from '@/components/quick-order/QuickOrderContent';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useCitiesCache } from '@/hooks/useCitiesCache'; // ✅ استخدام الـ Cache
import { UnifiedEditOrderLoader } from '@/components/quick-order/UnifiedEditOrderLoader';
import devLog from '@/lib/devLogger';

const EditOrderDialog = ({ open, onOpenChange, order, onOrderUpdated }) => {
  const { isLoggedIn, token } = useAlWaseet();
  const { cities: cachedCities, allRegions: cachedRegions, isLoaded: isCacheLoaded } = useCitiesCache(); // ✅ استخدام الـ Cache
  
  // تحويل بيانات الطلب لصيغة البيانات المطلوبة لـ QuickOrderContent
  const convertOrderToEditData = async (order) => {
    if (!order) {
      return null;
    }
    
    // تحويل المنتجات لصيغة cart items مع product_id و variant_id للتحميل الصحيح
    const cartItems = (order.order_items || order.items || []).map(item => ({
      id: `${item.product_id}-${item.variant_id || 'no-variant'}`,
      productId: item.product_id,
      variantId: item.variant_id,
      productName: item.productname || item.product_name || item.products?.name || 'منتج',
      product_name: item.productname || item.product_name || item.products?.name || 'منتج',
      size: item.product_variants?.sizes?.name || item.size || '',
      color: item.product_variants?.colors?.name || item.color || '',
      price: item.unit_price || item.price || 0,
      unit_price: item.unit_price || item.price || 0,
      quantity: item.quantity || 1,
      total: (item.unit_price || item.price || 0) * (item.quantity || 1),
      image: item.product_variants?.images?.[0] || item.products?.images?.[0] || item.image || '/placeholder.svg',
      barcode: item.barcode || '',
      sku: item.sku || item.variant_id || '',
      // إضافة معرفات المنتج والمتغير للتحميل من النظام الموحد
      product_id: item.product_id,
      variant_id: item.variant_id
    }));

    

    // ✅ تحويل معرفات/أسماء المدن والمناطق باستخدام الـ Cache فقط
    let city_id = order?.alwaseet_city_id ? String(order.alwaseet_city_id) : '';
    let region_id = order?.alwaseet_region_id ? String(order.alwaseet_region_id) : '';
    
    if (!city_id && order?.city_id) city_id = String(order.city_id);
    if (!region_id && order?.region_id) region_id = String(order.region_id);
    
    // ✅ استخدام الـ Cache للبحث عن المدينة والمنطقة
    if (!city_id && order.customer_city && isCacheLoaded) {
      const cityMatch = cachedCities.find(city => city.name === order.customer_city);
        if (cityMatch) {
          city_id = String(cityMatch.alwaseet_id);
          
          if (!region_id && order.customer_province) {
          const regionMatch = cachedRegions.find(r => 
            r.city_id === cityMatch.alwaseet_id && r.name === order.customer_province
          );
          if (regionMatch) {
            region_id = String(regionMatch.alwaseet_id);
          }
        }
      }
    }

    // ✅ حساب السعر النهائي الصحيح - استخدام final_amount مباشرة
    const subtotal = cartItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const deliveryFee = order.delivery_fee || 0;
    const discount = order.discount || 0;
    
    // ✅ final_amount هو المصدر الرسمي - السعر الكامل شامل التوصيل
    const finalAmountFromOrder = order.final_amount || 0;
    
    // إذا لم يكن final_amount موجوداً، احسبه
    const finalTotal = finalAmountFromOrder > 0 
      ? finalAmountFromOrder 
      : (subtotal + deliveryFee - discount);

    const editData = {
      // معلومات العميل - مع ضمان وجود جميع البيانات
      customer_name: order.customer_name || '',
      customer_phone: order.customer_phone || '',
      customer_phone2: order.customer_phone2 || order.second_phone || '',
      customer_city: order.customer_city || order.city || '',
      customer_province: order.customer_province || order.region || order.province || '',
      customer_address: order.customer_address || order.address || '',
      
      // معرفات المدينة والمنطقة للوسيط (ضمان عدم التكرار)
      city_id: city_id || order.city_id || '',
      region_id: region_id || order.region_id || '',
      
      // تفاصيل الطلب - مع حساب صحيح للأسعار
      notes: order.notes || '',
      total_amount: subtotal,
      delivery_fee: deliveryFee,
      discount: discount,
      final_amount: finalTotal,  // ✅ إضافة final_amount صريحاً
      final_total: finalTotal,
      price_with_delivery: finalTotal,  // ✅ السعر الكامل شامل التوصيل
      delivery_partner: order.delivery_partner || 'محلي',
      tracking_number: order.tracking_number || '',
      order_number: order.order_number || '',
      
      // المنتجات - مع معرفات صحيحة للتحميل
      items: cartItems,
      
      // بيانات إضافية للتعديل
      editMode: true,
      orderId: order.id,
      originalOrder: order,
      
      // بيانات Al Waseet الأصلية - مع ضمان وجود رقم التتبع
      delivery_partner_order_id: order.delivery_partner_order_id || order.tracking_number || order.qr_id || '',
      
      // إضافة logging مفصل لتتبع البيانات
      _debug: {
        original_tracking: order.tracking_number,
        original_delivery_id: order.delivery_partner_order_id,
        original_partner: order.delivery_partner,
        converted_city_id: city_id,
        converted_region_id: region_id
      }
    };

    return editData;
  };

  const handleOrderUpdated = (updatedOrder) => {
    if (onOrderUpdated) {
      onOrderUpdated(updatedOrder);
    }
    onOpenChange(false);
  };

  const [editData, setEditData] = useState(null);
  
  // ✅ تحويل البيانات بعد تحميل الـ Cache
  useEffect(() => {
    if (!isCacheLoaded) return; // ✅ انتظار تحميل الـ Cache
    
    const loadEditData = async () => {
      if (order) {
        const data = await convertOrderToEditData(order);
        
        // ✅ تحميل المناطق مسبقاً قبل تعيين editData
        if (data?.city_id && cachedRegions.length > 0) {
          devLog.log(`🔍 فلترة المناطق للمدينة ${data.city_id} من ${cachedRegions.length} منطقة...`);
          
          // فلترة المناطق للمدينة المختارة باستخدام city_id فقط
          const cityRegions = cachedRegions.filter(r => {
            const rCityId = String(r.city_id || '');
            const dataCity = String(data.city_id || '');
            return rCityId === dataCity;
          });
          
          devLog.log(`✅ تم فلترة ${cityRegions.length} منطقة للمدينة ${data.city_id}`);
          
          // تمرير المناطق المحملة مع البيانات
          data.preloadedRegions = cityRegions;
        }
        
        setEditData(data);
      }
    };
    loadEditData();
  }, [order, isCacheLoaded, cachedRegions]); // ✅ إضافة cachedRegions

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-7xl max-h-[95vh] p-0 gap-0 bg-gradient-to-br from-background/95 via-background to-background/90 backdrop-blur-lg"
        dir="rtl"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="relative h-full flex flex-col">
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-card/80 to-card/60 backdrop-blur-sm">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary via-purple-600 to-blue-600 bg-clip-text text-transparent text-right">
              ✏️ تعديل الطلب - {order?.delivery_partner_order_id || order?.tracking_number || order?.order_number}
              <div className="text-sm text-muted-foreground font-normal mt-1">
                {order?.created_at ? (() => {
                  const date = new Date(order.created_at);
                  const dateStr = date.toLocaleDateString('en-GB');
                  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                  return `${dateStr} - ${timeStr}`;
                })() : ''}
              </div>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 p-0">
            <div className="p-6" dir="rtl">
              {editData ? (
                <QuickOrderContent
                  isDialog={true}
                  aiOrderData={editData}
                  onOrderCreated={handleOrderUpdated}
                  key={`edit-${order?.id}-${order?.customer_city}-${order?.customer_province}`}
                />
              ) : (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center animate-pulse">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-primary/20 to-accent/20"></div>
                    <h3 className="text-lg font-semibold text-foreground">
                      🔄 جاري تحميل بيانات الطلب...
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      الرجاء الانتظار حتى يتم تحضير البيانات للتعديل
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