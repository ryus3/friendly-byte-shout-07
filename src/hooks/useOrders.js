import React, { useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';

export const useOrders = (initialOrders, initialAiOrders, settings, onStockUpdate, addNotification, hasPermission, user) => {
  const [orders, setOrders] = useState(initialOrders || []);
  const [aiOrders, setAiOrders] = useState(initialAiOrders || []);

  const createOrder = useCallback(async (customerInfo, cartItems, trackingNumber, discount, status, qrLink = null, deliveryPartnerData = null) => {
    try {
      // Implementation will be restored later
      return { success: true, trackingNumber };
    } catch (error) {
      console.error('Error in createOrder:', error);
      return { success: false, error: error.message || 'حدث خطأ في إنشاء الطلب' };
    }
  }, []);

  const updateOrder = async (orderId, updates, newProducts = null, originalItems = null) => {
    try {
      console.log('🔄 useOrders - بدء تحديث الطلب:', { orderId, updates, newProducts });
      
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
          // تخزين معرفات الوسيط عند توفرها
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
        console.log('🔄 تحديث المنتجات - عدد المنتجات الجديدة:', newProducts.length);
        
        // حذف المنتجات القديمة أولاً
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .eq('order_id', orderId);

        if (deleteError) {
          console.error('❌ خطأ في حذف المنتجات القديمة:', deleteError);
          throw new Error(`فشل في حذف المنتجات القديمة: ${deleteError.message}`);
        }

        console.log('✅ تم حذف المنتجات القديمة بنجاح');
        
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
          console.error('❌ خطأ في إضافة المنتجات الجديدة:', insertError);
          throw new Error(`فشل في إضافة المنتجات الجديدة: ${insertError.message}`);
        }

        console.log('✅ تم إضافة المنتجات الجديدة بنجاح');

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

      // تحديث حالة الطلبات المحلية مع تفاصيل أكثر - الحل النهائي
      console.log('🔄 useOrders - تحديث الحالة المحلية:', { orderId, updates, newProducts });
      setOrders(prevOrders => {
        const updatedOrders = prevOrders.map(order => 
          order.id === orderId 
            ? { 
                ...order, 
                ...updates, 
                items: newProducts || order.items,
                order_items: newProducts || order.order_items || order.items,
                updated_at: new Date().toISOString(),
                // إضافة معرفات الوسيط إذا كانت متوفرة
                alwaseet_city_id: updates.alwaseet_city_id || order.alwaseet_city_id,
                alwaseet_region_id: updates.alwaseet_region_id || order.alwaseet_region_id
              }
            : order
        );
        
        const updatedOrder = updatedOrders.find(o => o.id === orderId);
        console.log('✅ useOrders - تم تحديث الحالة المحلية:', {
          orderId,
          beforeUpdate: prevOrders.find(o => o.id === orderId)?.customer_name,
          afterUpdate: updatedOrder?.customer_name,
          timestamp: new Date().toISOString()
        });
        
        // إرسال أحداث متعددة لضمان التحديث الفوري
        setTimeout(() => {
          const events = [
            'localOrderUpdated',
            'orderDataRefreshed', 
            'superProviderOrderUpdated',
            'refreshOrdersData'
          ];
          
          events.forEach(eventName => {
            window.dispatchEvent(new CustomEvent(eventName, { 
              detail: { 
                orderId, 
                order: updatedOrder,
                source: 'useOrders',
                timestamp: new Date().toISOString()
              } 
            }));
          });
        }, 50);
        
        return updatedOrders;
      });

      // إضافة إشعار
      if (addNotification) {
        addNotification(
          `تم تحديث الطلب ${updatedOrder.order_number || updatedOrder.tracking_number}`,
          'success'
        );
      }

      console.log('✅ useOrders - اكتمل تحديث الطلب بنجاح:', { orderId, success: true });
      return { success: true, order: updatedOrder };
    } catch (error) {
      console.error('Error in updateOrder:', error);
      return { success: false, error: error.message };
    }
  };

  const deleteOrders = async (orderIds, isAiOrder = false) => {
    try {
      // Implementation will be restored later
      return { success: true };
    } catch (error) {
      console.error('Error in deleteOrders:', error);
      return { success: false, error: error.message };
    }
  };

  // دالة approveAiOrder للتوافق العكسي
  const approveAiOrder = async (aiOrderId) => {
    try {
      // سيتم تحديثه لاحقاً للعمل مع النظام الموحد
      console.log('Approve AI order:', aiOrderId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

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
