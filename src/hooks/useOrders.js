import React, { useState, useCallback, useMemo } from 'react';
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
      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        throw new Error('لم يتم تحديد طلبات للحذف');
      }

      console.log('🗑️ بدء حذف الطلبات:', orderIds);

      // ✅ الخطوة 1: جلب تفاصيل الطلبات قبل الحذف (لاسترداد المخزون)
      const { data: ordersToDelete, error: fetchError } = await supabase
        .from('orders')
        .select('id, tracking_number, order_number, order_items(product_id, variant_id, quantity)')
        .in('id', orderIds);

      if (fetchError) {
        console.error('❌ خطأ في جلب تفاصيل الطلبات:', fetchError);
        throw fetchError;
      }

      console.log('📦 الطلبات المراد حذفها:', ordersToDelete);

      // ✅ الخطوة 2: حذف الطلبات من قاعدة البيانات
      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .in('id', orderIds);

      if (deleteError) {
        console.error('❌ خطأ في حذف الطلبات:', deleteError);
        throw deleteError;
      }

      console.log('✅ تم حذف الطلبات من قاعدة البيانات');

      // ✅ الخطوة 3: استرداد المخزون
      if (onStockUpdate && ordersToDelete) {
        for (const order of ordersToDelete) {
          if (order.order_items && Array.isArray(order.order_items)) {
            for (const item of order.order_items) {
              console.log(`📦 استرداد مخزون: منتج ${item.product_id}, كمية ${item.quantity}`);
              await onStockUpdate(item.product_id, item.variant_id, item.quantity, 'add');
            }
          }
        }
        console.log('✅ تم استرداد المخزون');
      }

      // ✅ الخطوة 4: تحديث state المحلي
      setOrders(prev => prev.filter(o => !orderIds.includes(o.id)));

      // ✅ الخطوة 5: إرسال حدث للمكونات الأخرى
      window.dispatchEvent(new CustomEvent('ordersUpdated', { 
        detail: { deletedIds: orderIds } 
      }));

      // ✅ الخطوة 6: إشعار المستخدم
      if (addNotification) {
        addNotification(
          `تم حذف ${orderIds.length} طلب${orderIds.length > 1 ? '' : ''} بنجاح`,
          'success'
        );
      }

      console.log('✅ اكتمل حذف الطلبات بنجاح');
      return { success: true };

    } catch (error) {
      console.error('❌ Error in deleteOrders:', error);
      
      if (addNotification) {
        addNotification(
          `فشل حذف الطلبات: ${error.message}`,
          'error'
        );
      }
      
      return { success: false, error: error.message };
    }
  }, [onStockUpdate, addNotification]);

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
