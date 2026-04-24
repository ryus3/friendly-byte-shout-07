import React, { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import devLog from '@/lib/devLogger';

export const useOrders = (initialOrders, initialAiOrders, settings, onStockUpdate, addNotification, hasPermission, user) => {
  const [orders, setOrders] = useState(initialOrders || []);
  const [aiOrders, setAiOrders] = useState(initialAiOrders || []);

  const createOrder = useCallback(async (customerInfo, cartItems, trackingNumber, discount, status, qrLink = null, deliveryPartnerData = null) => {
    devLog.log('🚀 ============ بدء createOrder ============');
    devLog.log('📥 المعاملات المستلمة:', {
      customerInfo,
      cartItems,
      trackingNumber,
      discount,
      status,
      qrLink,
      deliveryPartnerData
    });
    
    try {
      // ✅ كشف Payload Mode (طلبات الاستبدال) vs Separate Parameters Mode (طلبات عادية)
      const isPayloadMode = customerInfo && typeof customerInfo === 'object' && 
                           (customerInfo.tracking_number || customerInfo.exchange_metadata || customerInfo.order_type);
      
      devLog.log('🔍 نمط الاستدعاء:', {
        mode: isPayloadMode ? 'Payload Mode (استبدال/إرجاع)' : 'Separate Parameters (عادي)',
        hasTrackingNumber: !!customerInfo?.tracking_number,
        hasExchangeMetadata: !!customerInfo?.exchange_metadata,
        orderType: customerInfo?.order_type || customerInfo?.orderType,
        cartItemsParam: cartItems,
        trackingNumberParam: trackingNumber
      });
      
      let actualCustomerInfo, actualCartItems, actualTrackingNumber, actualDiscount, actualStatus, actualQrLink, actualDeliveryPartnerData;
      
      if (isPayloadMode) {
        devLog.log('📦 Payload Mode: استخراج البيانات من الكائن الواحد');
        // ✅ استخراج البيانات من الكائن الواحد (لطلبات الاستبدال/الإرجاع)
        actualCustomerInfo = customerInfo;
        actualCartItems = customerInfo.items || [];
        
        // ✅ FALLBACK: إذا items فارغة واستبدال، استخرج من exchange_metadata
        if (actualCartItems.length === 0 && 
            (customerInfo.order_type === 'replacement' || customerInfo.order_type === 'exchange') &&
            customerInfo.exchange_metadata) {
          devLog.log('⚠️ items فارغة - استخراج من exchange_metadata');
          const { outgoing_items = [], incoming_items = [] } = customerInfo.exchange_metadata;
          
          actualCartItems = [
            ...outgoing_items.map(item => ({
              ...item,
              item_direction: 'outgoing',
              productId: item.product_id,
              variantId: item.variant_id,
              productName: item.product_name
            })),
            ...incoming_items.map(item => ({
              ...item,
              item_direction: 'incoming',
              productId: item.product_id,
              variantId: item.variant_id,
              productName: item.product_name
            }))
          ];
          
          devLog.log('✅ تم استخراج cart items من exchange_metadata:', actualCartItems);
        }
        
        devLog.log('📋 actualCartItems النهائية:', {
          count: actualCartItems.length,
          items: actualCartItems
        });
        
        actualTrackingNumber = customerInfo.tracking_number || trackingNumber;
        actualDiscount = customerInfo.discount || 0;
        actualStatus = customerInfo.status || 'pending';
        actualQrLink = customerInfo.qr_link || qrLink;
        actualDeliveryPartnerData = customerInfo.delivery_partner ? {
          partner: customerInfo.delivery_partner,
          orderId: customerInfo.delivery_partner_order_id,
          ...deliveryPartnerData
        } : deliveryPartnerData;
        
        devLog.log('📋 البيانات المستخرجة:', {
          trackingNumber: actualTrackingNumber,
          cartItems: actualCartItems,
          discount: actualDiscount,
          status: actualStatus
        });
      } else {
        devLog.log('📦 Separate Parameters: استخدام المعاملات المنفصلة');
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
      
      devLog.log('📊 بيانات الطلب المستخرجة:', {
        orderType,
        refundAmount,
        originalOrderId,
        deliveryFee,
        hasExchangeMetadata: !!actualCustomerInfo.exchange_metadata
      });
      
      // ✅ VALIDATION صارم: طلبات الاستبدال يجب أن تحتوي على exchange_metadata
      if ((orderType === 'replacement' || orderType === 'exchange') && !actualCustomerInfo.exchange_metadata) {
        const errorMsg = '❌ CRITICAL ERROR: طلب استبدال بدون exchange_metadata!';
        console.error(errorMsg, {
          orderType,
          actualCustomerInfo,
          hasExchangeMetadata: !!actualCustomerInfo.exchange_metadata
        });
        throw new Error('فشل في إنشاء طلب الاستبدال: بيانات الاستبدال مفقودة');
      }
      
      // حساب total_amount و final_amount
      let totalAmount = 0;
      let finalAmount = 0;
      
      // ✅ معالجة خاصة لطلبات الاستبدال
      if (orderType === 'replacement' || orderType === 'exchange') {
        const exchangeMetadata = actualCustomerInfo.exchange_metadata;
        
        if (!exchangeMetadata) {
          throw new Error('بيانات الاستبدال مفقودة');
        }
        
        // ✅ حساب فرق السعر فقط
        const outgoingTotal = (exchangeMetadata.outgoing_items || [])
          .reduce((sum, item) => sum + (item.total_price || 0), 0);
        const incomingTotal = (exchangeMetadata.incoming_items || [])
          .reduce((sum, item) => sum + (item.total_price || 0), 0);
        
        const priceDifference = outgoingTotal - incomingTotal;
        
        // ✅ المبلغ = فرق السعر فقط (إذا كان موجباً، وإلا صفر)
        totalAmount = priceDifference > 0 ? priceDifference : 0;
        
        // ✅ المبلغ النهائي = فرق السعر + رسوم التوصيل
        finalAmount = totalAmount + deliveryFee;
        
        devLog.log('💰 حساب مبالغ الاستبدال:', {
          outgoingTotal,
          incomingTotal,
          priceDifference,
          totalAmount,
          deliveryFee,
          finalAmount
        });
      } else if (orderType === 'return') {
        totalAmount = -Math.abs(refundAmount);
        finalAmount = totalAmount + deliveryFee;
      } else {
        totalAmount = actualCartItems.reduce((sum, item) => sum + (item.total_price || (item.price * item.quantity)), 0) - (actualDiscount || 0);
        finalAmount = totalAmount + deliveryFee;
      }

      // إنشاء سجل الطلب
      devLog.log('📝 إنشاء سجل الطلب:', {
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
      
      devLog.log('✅ تم إنشاء الطلب بنجاح:', {
        orderId: newOrder.id,
        orderNumber: newOrder.order_number,
        trackingNumber: newOrder.tracking_number,
        orderType: newOrder.order_type
      });

      // ✅ إنشاء order_items للاستبدال (للحجز والتتبع فقط)
      devLog.log('🔍 ============ فحص شرط الاستبدال ============');
      devLog.log('🔍 معلومات الشرط:', {
        orderType: orderType,
        orderTypeCheck1: orderType === 'replacement',
        orderTypeCheck2: orderType === 'exchange',
        hasExchangeMetadata: !!actualCustomerInfo.exchange_metadata,
        exchangeMetadata: actualCustomerInfo.exchange_metadata,
        fullCustomerInfo: actualCustomerInfo,
        conditionResult: (orderType === 'replacement' || orderType === 'exchange') && actualCustomerInfo.exchange_metadata
      });
      
      if ((orderType === 'replacement' || orderType === 'exchange') && actualCustomerInfo.exchange_metadata) {
        devLog.log('✅ دخول كتلة معالجة الاستبدال - الشرط تحقق!');
        
        const exchangeMetadata = actualCustomerInfo.exchange_metadata;
        const orderItemsToInsert = [];
        
        devLog.log('🔍 بدء معالجة order_items للاستبدال:', {
          orderType,
          hasExchangeMetadata: !!exchangeMetadata,
          outgoingCount: exchangeMetadata.outgoing_items?.length || 0,
          incomingCount: exchangeMetadata.incoming_items?.length || 0,
          fullMetadata: JSON.stringify(exchangeMetadata, null, 2)
        });
        
        // ✅ إضافة المنتجات الصادرة (outgoing)
        if (exchangeMetadata.outgoing_items && Array.isArray(exchangeMetadata.outgoing_items)) {
          devLog.log(`📦 معالجة ${exchangeMetadata.outgoing_items.length} منتج صادر...`);
          
          for (const item of exchangeMetadata.outgoing_items) {
            devLog.log('  ➕ إضافة منتج صادر:', {
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
              unit_price: item.unit_price || 0,
              total_price: item.total_price || 0,
              item_direction: 'outgoing',  // ✅ تحديد الاتجاه
              product_name: item.product_name,
              color_name: item.color_name,
              size_name: item.size_name
            });
          }
        } else {
          devLog.warn('⚠️ لا توجد منتجات صادرة أو البيانات غير صحيحة!', exchangeMetadata.outgoing_items);
        }
        
        // ✅ إضافة المنتجات الواردة (incoming) - للتتبع فقط
        if (exchangeMetadata.incoming_items && Array.isArray(exchangeMetadata.incoming_items)) {
          devLog.log(`📦 معالجة ${exchangeMetadata.incoming_items.length} منتج وارد...`);
          
          for (const item of exchangeMetadata.incoming_items) {
            devLog.log('  ➕ إضافة منتج وارد:', {
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
              unit_price: item.unit_price || 0,
              total_price: item.total_price || 0,
              item_direction: 'incoming',  // ✅ تحديد الاتجاه
              product_name: item.product_name,
              color_name: item.color_name,
              size_name: item.size_name
            });
          }
        } else {
          devLog.warn('⚠️ لا توجد منتجات واردة أو البيانات غير صحيحة!', exchangeMetadata.incoming_items);
        }
        
        devLog.log(`📊 إجمالي order_items للإدراج: ${orderItemsToInsert.length}`);
        devLog.log('📋 البيانات الكاملة للإدراج:', JSON.stringify(orderItemsToInsert, null, 2));
        
        // ✅ VALIDATION صارم: منع إنشاء طلب استبدال بدون order_items
        if (orderItemsToInsert.length === 0) {
          const errorMsg = '❌ CRITICAL ERROR: لا يمكن إنشاء طلب استبدال بدون order_items!';
          console.error(errorMsg);
          console.error('🔍 تفاصيل exchangeMetadata الكاملة:', {
            full_metadata: exchangeMetadata,
            outgoing_items: exchangeMetadata.outgoing_items,
            incoming_items: exchangeMetadata.incoming_items,
            outgoing_type: typeof exchangeMetadata.outgoing_items,
            incoming_type: typeof exchangeMetadata.incoming_items,
            outgoing_isArray: Array.isArray(exchangeMetadata.outgoing_items),
            incoming_isArray: Array.isArray(exchangeMetadata.incoming_items),
            outgoing_length: exchangeMetadata.outgoing_items?.length,
            incoming_length: exchangeMetadata.incoming_items?.length
          });
          
          // ✅ حذف الطلب المُنشأ لأنه غير مكتمل
          devLog.log('🗑️ حذف الطلب غير المكتمل:', newOrder.id);
          await supabase.from('orders').delete().eq('id', newOrder.id);
          
          throw new Error('فشل في معالجة منتجات الاستبدال - البيانات غير كاملة');
        }
        
        // ✅ حفظ order_items مع معالجة شاملة
        devLog.log(`📝 ============ محاولة إنشاء ${orderItemsToInsert.length} order_items ============`);
        devLog.log('📋 البيانات المرسلة إلى قاعدة البيانات:', orderItemsToInsert);
        
        const { data: insertedItems, error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItemsToInsert)
          .select();  // ✅ إرجاع البيانات المدرجة للتحقق
        
        devLog.log('📊 نتيجة عملية الإدراج:', {
          success: !itemsError,
          insertedCount: insertedItems?.length || 0,
          error: itemsError,
          insertedData: insertedItems
        });
        
        if (itemsError) {
          console.error('❌ ============ فشل إنشاء order_items ============');
          console.error('❌ تفاصيل الخطأ:', {
            error: itemsError,
            code: itemsError.code,
            message: itemsError.message,
            details: itemsError.details,
            hint: itemsError.hint,
            itemsToInsert: orderItemsToInsert
          });
          
          // ✅ حذف الطلب المُنشأ لأن order_items فشلت
          devLog.log('🗑️ حذف الطلب بسبب فشل order_items:', newOrder.id);
          await supabase.from('orders').delete().eq('id', newOrder.id);
          
          throw new Error(`فشل في إضافة منتجات الطلب: ${itemsError.message}`);
        }
        
        devLog.log(`✅ ============ تم إنشاء ${insertedItems?.length || 0} order_items بنجاح ============`);
        devLog.log('✅ البيانات المُدرجة:', insertedItems);
        devLog.log('🔒 سيتم حجز المنتجات الصادرة تلقائياً عبر التريجر auto_stock_management_trigger');
        
        // ✅ VALIDATION نهائي: التأكد من أن عدد الـ items المُدرجة يطابق المتوقع
        if (insertedItems.length !== orderItemsToInsert.length) {
          console.error('⚠️ تحذير: عدم تطابق في عدد order_items!', {
            expected: orderItemsToInsert.length,
            actual: insertedItems.length
          });
        }
      } else {
        devLog.log('⏭️ تخطي كتلة معالجة الاستبدال - الشرط لم يتحقق');
      }
      // ✅ للطلبات العادية فقط (ليس الإرجاع)
      else if (actualCartItems && actualCartItems.length > 0 && orderType !== 'return') {
        devLog.log(`📦 إنشاء order_items للطلب العادي: ${actualCartItems.length} منتجات`);
        
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
        
        devLog.log(`✅ تم إنشاء ${orderItemsToInsert.length} order_items للطلب العادي`);

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

      devLog.log('✅ اكتمل إنشاء الطلب بنجاح:', {
        success: true,
        trackingNumber: actualTrackingNumber,
        orderId: newOrder.id,
        orderType
      });

      devLog.log('✅ ============ اكتمل createOrder بنجاح ============');
      return { success: true, trackingNumber: actualTrackingNumber, orderId: newOrder.id };
    } catch (error) {
      console.error('❌ ============ خطأ في createOrder ============');
      console.error('❌ تفاصيل الخطأ الكاملة:', {
        error,
        message: error.message,
        stack: error.stack,
        name: error.name
      });
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
          sales_amount: updates.sales_amount,
          final_amount: updates.final_amount,
          discount: updates.discount,
          price_increase: updates.price_increase,
          price_change_type: updates.price_change_type,
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
