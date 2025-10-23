import React, { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';

export const useOrders = (initialOrders, initialAiOrders, settings, onStockUpdate, addNotification, hasPermission, user) => {
  const [orders, setOrders] = useState(initialOrders || []);
  const [aiOrders, setAiOrders] = useState(initialAiOrders || []);

  const createOrder = useCallback(async (customerInfo, cartItems, trackingNumber, discount, status, qrLink = null, deliveryPartnerData = null) => {
    try {
      // ✅ كشف Payload Mode (طلبات الاستبدال) vs Separate Parameters Mode (طلبات عادية)
      const isPayloadMode = customerInfo && typeof customerInfo === 'object' && 
                           (customerInfo.tracking_number || customerInfo.exchange_metadata || customerInfo.order_type);
      
      console.log('🔍 نمط الاستدعاء:', {
        mode: isPayloadMode ? 'Payload Mode (استبدال/إرجاع)' : 'Separate Parameters (عادي)',
        hasTrackingNumber: !!customerInfo?.tracking_number,
        hasExchangeMetadata: !!customerInfo?.exchange_metadata,
        orderType: customerInfo?.order_type || customerInfo?.orderType,
        cartItemsParam: cartItems,
        trackingNumberParam: trackingNumber
      });
      
      let actualCustomerInfo, actualCartItems, actualTrackingNumber, actualDiscount, actualStatus, actualQrLink, actualDeliveryPartnerData;
      
      if (isPayloadMode) {
        console.log('📦 Payload Mode: استخراج البيانات من الكائن الواحد');
        // ✅ استخراج البيانات من الكائن الواحد (لطلبات الاستبدال/الإرجاع)
        actualCustomerInfo = customerInfo;
        actualCartItems = customerInfo.items || [];
        actualTrackingNumber = customerInfo.tracking_number || trackingNumber;
        actualDiscount = customerInfo.discount || 0;
        actualStatus = customerInfo.status || 'pending';
        actualQrLink = customerInfo.qr_link || qrLink;
        actualDeliveryPartnerData = customerInfo.delivery_partner ? {
          partner: customerInfo.delivery_partner,
          orderId: customerInfo.delivery_partner_order_id,
          ...deliveryPartnerData
        } : deliveryPartnerData;
        
        console.log('📋 البيانات المستخرجة:', {
          trackingNumber: actualTrackingNumber,
          cartItems: actualCartItems,
          discount: actualDiscount,
          status: actualStatus
        });
      } else {
        console.log('📦 Separate Parameters: استخدام المعاملات المنفصلة');
        // ✅ استخدام المعاملات المنفصلة (للطلبات العادية)
        actualCustomerInfo = customerInfo;
        actualCartItems = cartItems;
        actualTrackingNumber = trackingNumber;
        actualDiscount = discount;
        actualStatus = status;
        actualQrLink = qrLink;
        actualDeliveryPartnerData = deliveryPartnerData;
      }
      
      const orderType = actualCustomerInfo.orderType || actualCustomerInfo.order_type || 'normal';
      const refundAmount = actualCustomerInfo.refundAmount || actualCustomerInfo.refund_amount || 0;
      const originalOrderId = actualCustomerInfo.originalOrderId || actualCustomerInfo.original_order_id || null;
      const deliveryFee = actualCustomerInfo.deliveryFee || actualCustomerInfo.delivery_fee || 0;
      
      // حساب total_amount و final_amount
      let totalAmount = 0;
      let finalAmount = 0;
      
      // ✅ معالجة خاصة لطلبات الاستبدال
      if (orderType === 'replacement' || orderType === 'exchange') {
        const exchangeMetadata = actualCustomerInfo.exchange_metadata;
        
        if (!exchangeMetadata) {
          throw new Error('بيانات الاستبدال مفقودة');
        }
        
        // ✅ استخدام المبلغ المحسوب من الواجهة
        totalAmount = actualCustomerInfo.total_amount || 0;
        finalAmount = totalAmount + deliveryFee;
      } else if (orderType === 'return') {
        totalAmount = -Math.abs(refundAmount);
        finalAmount = totalAmount + deliveryFee;
      } else {
        totalAmount = actualCartItems.reduce((sum, item) => sum + (item.total_price || (item.price * item.quantity)), 0) - (actualDiscount || 0);
        finalAmount = totalAmount + deliveryFee;
      }

      // إنشاء سجل الطلب
      console.log('📝 إنشاء سجل الطلب:', {
        order_number: actualTrackingNumber,
        tracking_number: actualTrackingNumber,
        orderType,
        total_amount: totalAmount,
        final_amount: finalAmount,
        discount: actualDiscount,
        status: actualStatus
      });
      
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: actualTrackingNumber,
          tracking_number: actualTrackingNumber,
          customer_name: actualCustomerInfo.customer_name,
          customer_phone: actualCustomerInfo.customer_phone,
          customer_phone2: actualCustomerInfo.customer_phone2 || null,
          customer_city: actualCustomerInfo.customer_city,
          customer_province: actualCustomerInfo.customer_province,
          customer_address: actualCustomerInfo.customer_address,
          alwaseet_city_id: actualCustomerInfo.alwaseet_city_id || null,
          alwaseet_region_id: actualCustomerInfo.alwaseet_region_id || null,
          notes: actualCustomerInfo.notes || '',
          total_amount: totalAmount,
          delivery_fee: deliveryFee,
          final_amount: finalAmount,
          discount: actualDiscount || 0,
          status: actualStatus || 'pending',
          delivery_status: actualDeliveryPartnerData ? 1 : 0,
          qr_link: actualQrLink,
          order_type: orderType === 'replacement' ? 'replacement' : orderType === 'exchange' ? 'exchange' : orderType,
          refund_amount: orderType === 'return' ? Math.abs(refundAmount) : null,
          original_order_id: originalOrderId,
          exchange_metadata: (orderType === 'replacement' || orderType === 'exchange') 
            ? actualCustomerInfo.exchange_metadata 
            : null,
          delivery_partner: actualDeliveryPartnerData?.partner || null,
          delivery_partner_order_id: actualDeliveryPartnerData?.orderId || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('*')
        .single();

      if (orderError) {
        console.error('❌ فشل إنشاء الطلب:', orderError);
        throw new Error(`فشل في إنشاء الطلب: ${orderError.message}`);
      }
      
      console.log('✅ تم إنشاء الطلب بنجاح:', {
        orderId: newOrder.id,
        orderNumber: newOrder.order_number,
        trackingNumber: newOrder.tracking_number,
        orderType: newOrder.order_type
      });

      // ✅ إنشاء order_items للاستبدال (للحجز والتتبع فقط)
      if ((orderType === 'replacement' || orderType === 'exchange') && actualCustomerInfo.exchange_metadata) {
        const exchangeMetadata = actualCustomerInfo.exchange_metadata;
        const orderItemsToInsert = [];
        
        console.log('🔍 بدء معالجة order_items للاستبدال:', {
          orderType,
          hasExchangeMetadata: !!exchangeMetadata,
          outgoingCount: exchangeMetadata.outgoing_items?.length || 0,
          incomingCount: exchangeMetadata.incoming_items?.length || 0,
          fullMetadata: exchangeMetadata
        });
        
        // ✅ إضافة المنتجات الصادرة (outgoing)
        if (exchangeMetadata.outgoing_items && Array.isArray(exchangeMetadata.outgoing_items)) {
          console.log(`📦 معالجة ${exchangeMetadata.outgoing_items.length} منتج صادر...`);
          
          for (const item of exchangeMetadata.outgoing_items) {
            console.log('  ➕ إضافة منتج صادر:', {
              product_id: item.product_id,
              variant_id: item.variant_id,
              quantity: item.quantity,
              product_name: item.product_name
            });
            
            orderItemsToInsert.push({
              order_id: newOrder.id,
              product_id: item.product_id,
              variant_id: item.variant_id,
              quantity: item.quantity || 1,
              unit_price: 0,              // ✅ صفر لتجنب الحسابات المالية
              total_price: 0,             // ✅ صفر لتجنب الحسابات المالية
              item_direction: 'outgoing'  // ✅ تحديد الاتجاه
            });
          }
        } else {
          console.warn('⚠️ لا توجد منتجات صادرة أو البيانات غير صحيحة!', exchangeMetadata.outgoing_items);
        }
        
        // ✅ إضافة المنتجات الواردة (incoming) - للتتبع فقط
        if (exchangeMetadata.incoming_items && Array.isArray(exchangeMetadata.incoming_items)) {
          console.log(`📦 معالجة ${exchangeMetadata.incoming_items.length} منتج وارد...`);
          
          for (const item of exchangeMetadata.incoming_items) {
            console.log('  ➕ إضافة منتج وارد:', {
              product_id: item.product_id,
              variant_id: item.variant_id,
              quantity: item.quantity,
              product_name: item.product_name
            });
            
            orderItemsToInsert.push({
              order_id: newOrder.id,
              product_id: item.product_id,
              variant_id: item.variant_id,
              quantity: item.quantity || 1,
              unit_price: 0,              // ✅ صفر
              total_price: 0,             // ✅ صفر
              item_direction: 'incoming'  // ✅ تحديد الاتجاه
            });
          }
        } else {
          console.warn('⚠️ لا توجد منتجات واردة أو البيانات غير صحيحة!', exchangeMetadata.incoming_items);
        }
        
        console.log(`📊 إجمالي order_items للإدراج: ${orderItemsToInsert.length}`, orderItemsToInsert);
        
        // ✅ حفظ order_items مع معالجة شاملة
        if (orderItemsToInsert.length > 0) {
          console.log(`📝 محاولة إنشاء ${orderItemsToInsert.length} order_items في قاعدة البيانات...`);
          
          const { data: insertedItems, error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItemsToInsert)
            .select();  // ✅ إرجاع البيانات المدرجة للتحقق
          
          if (itemsError) {
            console.error('❌ فشل إنشاء order_items:', {
              error: itemsError,
              code: itemsError.code,
              message: itemsError.message,
              details: itemsError.details,
              hint: itemsError.hint,
              itemsToInsert: orderItemsToInsert
            });
            throw new Error(`فشل في إضافة منتجات الطلب: ${itemsError.message}`);
          }
          
          console.log(`✅ تم إنشاء ${insertedItems?.length || 0} order_items بنجاح:`, insertedItems);
          console.log('🔒 سيتم حجز المنتجات الصادرة تلقائياً عبر التريجر auto_stock_management_trigger');
        } else {
          // ✅ تحذير واضح إذا لم يتم إنشاء أي items
          console.error('❌ لا توجد عناصر للإدراج! تفاصيل exchangeMetadata الكاملة:', {
            full_metadata: exchangeMetadata,
            outgoing_items: exchangeMetadata.outgoing_items,
            incoming_items: exchangeMetadata.incoming_items,
            outgoing_type: typeof exchangeMetadata.outgoing_items,
            incoming_type: typeof exchangeMetadata.incoming_items,
            outgoing_isArray: Array.isArray(exchangeMetadata.outgoing_items),
            incoming_isArray: Array.isArray(exchangeMetadata.incoming_items)
          });
          throw new Error('فشل في معالجة منتجات الاستبدال - البيانات غير كاملة');
        }
      }
      // ✅ للطلبات العادية فقط (ليس الإرجاع)
      else if (actualCartItems && actualCartItems.length > 0 && orderType !== 'return') {
        console.log(`📦 إنشاء order_items للطلب العادي: ${actualCartItems.length} منتجات`);
        
        const orderItemsToInsert = actualCartItems.map(item => ({
          order_id: newOrder.id,
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          quantity: item.quantity || 1,
          unit_price: item.unit_price || item.price || 0,
          total_price: item.total_price || ((item.unit_price || item.price || 0) * (item.quantity || 1)),
          item_direction: null  // ✅ null للطلبات العادية
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItemsToInsert);

        if (itemsError) {
          console.error('❌ فشل إنشاء order_items للطلب العادي:', itemsError);
          throw new Error(`فشل في إضافة منتجات الطلب: ${itemsError.message}`);
        }
        
        console.log(`✅ تم إنشاء ${orderItemsToInsert.length} order_items للطلب العادي`);

        // تحديث المخزون - فقط للطلبات العادية (ليس للإرجاع)
        if (orderType !== 'return' && onStockUpdate) {
          for (const item of actualCartItems) {
            await onStockUpdate(item.product_id, item.variant_id, item.quantity, 'subtract');
          }
        }
      }

      // إضافة الطلب للحالة المحلية
      setOrders(prevOrders => [...prevOrders, { ...newOrder, items: actualCartItems }]);

      // إضافة إشعار
      if (addNotification) {
        const orderTypeText = orderType === 'return' ? 'إرجاع' : orderType === 'exchange' ? 'استبدال' : 'طلب';
        addNotification(
          `تم إنشاء ${orderTypeText} جديد: ${actualTrackingNumber}`,
          'success'
        );
      }

      console.log('✅ اكتمل إنشاء الطلب بنجاح:', {
        success: true,
        trackingNumber: actualTrackingNumber,
        orderId: newOrder.id,
        orderType
      });

      return { success: true, trackingNumber: actualTrackingNumber, orderId: newOrder.id };
    } catch (error) {
      console.error('Error in createOrder:', error);
      return { success: false, error: error.message || 'حدث خطأ في إنشاء الطلب' };
    }
  }, [onStockUpdate, addNotification]);

  const updateOrder = useCallback(async (orderId, updates, newProducts = null, originalItems = null) => {
    try {
      // تحديث الطلب في قاعدة البيانات
      const { data: updatedOrder, error: updateError } = await supabase
        .from('orders')
        .update({
          customer_name: updates.customer_name,
          customer_phone: updates.customer_phone,
          customer_phone2: updates.customer_phone2,
          customer_city: updates.customer_city,
          customer_province: updates.customer_province,
          customer_address: updates.customer_address,
          alwaseet_city_id: updates.alwaseet_city_id ?? null,
          alwaseet_region_id: updates.alwaseet_region_id ?? null,
          notes: updates.notes,
          total_amount: updates.total_amount,
          delivery_fee: updates.delivery_fee,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select('*')
        .single();

      if (updateError) {
        throw new Error(`فشل في تحديث الطلب: ${updateError.message}`);
      }

      // تحديث المنتجات إذا تم تمريرها
      if (newProducts && Array.isArray(newProducts) && newProducts.length > 0) {
        // حذف المنتجات القديمة أولاً
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .eq('order_id', orderId);

        if (deleteError) {
          throw new Error(`فشل في حذف المنتجات القديمة: ${deleteError.message}`);
        }
        
        // إضافة المنتجات الجديدة
        const orderItemsToInsert = newProducts.map(item => ({
          order_id: orderId,
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          quantity: item.quantity || 1,
          unit_price: item.unit_price || item.price || 0,
          total_price: item.total_price || ((item.unit_price || item.price || 0) * (item.quantity || 1))
        }));

        const { error: insertError } = await supabase
          .from('order_items')
          .insert(orderItemsToInsert);

        if (insertError) {
          throw new Error(`فشل في إضافة المنتجات الجديدة: ${insertError.message}`);
        }

        // تحديث المخزون
        if (onStockUpdate) {
          // استرداد المخزون للمنتجات القديمة
          if (originalItems && Array.isArray(originalItems)) {
            for (const item of originalItems) {
              await onStockUpdate(item.product_id, item.variant_id, item.quantity, 'add');
            }
          }

          // خصم المخزون للمنتجات الجديدة
          for (const item of newProducts) {
            await onStockUpdate(item.product_id, item.variant_id, item.quantity, 'subtract');
          }
        }
      }

      // تحديث حالة الطلبات المحلية
      setOrders(prevOrders => {
        const updatedOrders = prevOrders.map(order => 
          order.id === orderId 
            ? { 
                ...order, 
                ...updates, 
                items: newProducts || order.items,
                updated_at: new Date().toISOString(),
                alwaseet_city_id: updates.alwaseet_city_id || order.alwaseet_city_id,
                alwaseet_region_id: updates.alwaseet_region_id || order.alwaseet_region_id
              }
            : order
        );
        
        // إرسال حدث للتأكد من تحديث كل المكونات
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('localOrderUpdated', { 
            detail: { 
              orderId, 
              order: updatedOrders.find(o => o.id === orderId),
              timestamp: new Date().toISOString()
            } 
          }));
        }, 100);
        
        return updatedOrders;
      });

      // إضافة إشعار
      if (addNotification) {
        addNotification(
          `تم تحديث الطلب ${updatedOrder.order_number || updatedOrder.tracking_number}`,
          'success'
        );
      }

      return { success: true, order: updatedOrder };
    } catch (error) {
      console.error('Error in updateOrder:', error);
      return { success: false, error: error.message };
    }
  }, [onStockUpdate, addNotification]);

  const deleteOrders = useCallback(async (orderIds, isAiOrder = false) => {
    try {
      // Implementation will be restored later
      return { success: true };
    } catch (error) {
      console.error('Error in deleteOrders:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // دالة approveAiOrder للتوافق العكسي
  const approveAiOrder = useCallback(async (aiOrderId) => {
    try {
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  return { 
    orders, 
    setOrders,
    aiOrders, 
    setAiOrders,
    createOrder, 
    updateOrder, 
    deleteOrders, 
    approveAiOrder 
  };
};
