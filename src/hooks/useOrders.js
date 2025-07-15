import React, { useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

export const useOrders = (initialOrders, initialAiOrders, settings, onStockUpdate, addNotification, hasPermission, user) => {
  const [orders, setOrders] = useState(initialOrders);
  const [aiOrders, setAiOrders] = useState(initialAiOrders);

  const generateTrackingNumber = () => {
    return `${settings.sku_prefix || 'RYUS'}-${Date.now().toString().slice(-6)}`;
  };

  const createOrder = useCallback(async (customerInfo, cartItems, trackingNumber, discount, status, qrLink = null, deliveryPartnerData = null) => {
    let finalTrackingNumber = trackingNumber;
    if (!finalTrackingNumber) {
      finalTrackingNumber = generateTrackingNumber();
    }
  
    const subtotal = cartItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const deliveryFee = settings?.deliveryFee || 0;
    const total = subtotal - (discount || 0) + deliveryFee;

    const newOrder = {
      customerinfo: customerInfo,
      items: cartItems,
      subtotal,
      deliveryfee: deliveryFee,
      discount: discount || 0,
      total,
      status: status || 'pending',
      shipping_company: trackingNumber ? 'Al-Waseet' : 'local',
      trackingnumber: finalTrackingNumber,
      notes: customerInfo.notes,
      created_by: user?.id,
      profitStatus: 'unsettled',
      qr_link: qrLink,
      delivery_partner_data: deliveryPartnerData,
    };
    
    // Reserve stock
    const stockReservations = cartItems.map(item =>
        supabase.rpc('update_reserved_stock', {
            p_product_id: item.productId,
            p_sku: item.sku,
            p_quantity_change: item.quantity
        })
    );
    await Promise.all(stockReservations);

    const { data, error } = await supabase.from('orders').insert(newOrder).select().single();

    if (error) {
      // Revert stock reservation on failure
      const stockReversions = cartItems.map(item =>
        supabase.rpc('update_reserved_stock', {
            p_product_id: item.productId,
            p_sku: item.sku,
            p_quantity_change: -item.quantity
        })
      );
      await Promise.all(stockReversions);
      console.error('Error creating order:', error);
      return { success: false, error: error.message };
    }

    // تسجيل العملية في الإشعارات بدلاً من جدول منفصل
    const { error: finError } = await supabase.from('notifications').insert({
      type: 'sale_transaction',
      title: 'عملية بيع جديدة',
      message: `تم تسجيل عملية بيع بقيمة ${data.total}`,
      data: {
        type: 'sale',
        amount: data.total,
        order_id: data.id
      }
    });
    if (finError) console.error("Error creating financial transaction:", finError);
    
    // Notify admin
    addNotification({
      type: 'new_order',
      title: 'طلب جديد',
      message: `تم إنشاء طلب جديد برقم ${data.trackingnumber} بواسطة ${user?.full_name || 'موظف'}.`,
      user_id: null, // Send to all admins
      link: `/my-orders?trackingNumber=${data.trackingnumber}`,
      color: 'blue',
      icon: 'ShoppingCart'
    });

    setOrders(prev => [data, ...prev]);
    return { success: true, trackingNumber: finalTrackingNumber };
  }, [settings, addNotification, user]);

  const updateOrder = async (orderId, updates) => {
    const originalOrder = orders.find(o => o.id === orderId);
    if (!originalOrder) return;

    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      toast({ title: "خطأ", description: "فشل تحديث الطلب.", variant: "destructive" });
      console.error('Error updating order:', error);
      return { success: false, error };
    }
    
    // Check if status is part of the updates
    if (updates.status && updates.status !== originalOrder.status) {
        onStockUpdate(originalOrder, data);
        // Notify employee of status change
        addNotification({
          type: 'order_status_update',
          title: `تحديث حالة طلبك`,
          message: `تم تغيير حالة طلبك رقم ${data.trackingnumber} إلى "${updates.status}".`,
          user_id: data.created_by,
          link: `/my-orders?trackingNumber=${data.trackingnumber}`,
          color: 'blue',
          icon: 'ShoppingCart'
        });
    }

    setOrders(prevOrders => prevOrders.map(o => (o.id === orderId ? data : o)));

    toast({ title: "نجاح", description: `تم تحديث الطلب بنجاح.` });
    return { success: true, data };
  };

  const deleteOrders = async (orderIds, isAiOrder = false) => {
    const tableName = isAiOrder ? 'ai_orders' : 'orders';
    if (!isAiOrder && !hasPermission('delete_local_orders')) {
        toast({ title: "غير مصرح به", description: "ليس لديك صلاحية حذف الطلبات.", variant: "destructive" });
        return;
    }
    
    try {
      const { error } = await supabase.from(tableName).delete().in('id', orderIds);
      if (error) throw error;
      
      if (isAiOrder) {
        setAiOrders(prev => prev.filter(o => !orderIds.includes(o.id)));
      } else {
        setOrders(prev => prev.filter(o => !orderIds.includes(o.id)));
      }
      toast({ title: "نجاح", description: `تم حذف ${orderIds.length} طلبات بنجاح.` });
    } catch (error) {
      console.error('Error deleting orders:', error);
      toast({ title: "خطأ", description: "فشل حذف الطلبات.", variant: "destructive" });
    }
  };
  
  const approveAiOrder = async (orderId) => {
    const aiOrder = aiOrders.find(o => o.id === orderId);
    if (!aiOrder) return;

    try {
      // إنشاء رقم تتبع للطلب
      const trackingNumber = `AI-${Date.now().toString().slice(-8)}`;
      
      // تحديث حالة الطلب الذكي إلى "معتمد"
      const { error: updateError } = await supabase
        .from('ai_orders')
        .update({ 
          status: 'approved',
          processed_at: new Date().toISOString(),
          processed_by: user?.id 
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      // إنشاء طلب جديد في جدول الطلبات العادية
      const { data: orderNumber } = await supabase.rpc('generate_order_number');
      
      // تحديد نوع التوصيل من بيانات الطلب الذكي
      const isLocalDelivery = aiOrder.order_data?.delivery_type !== 'توصيل' || !aiOrder.customer_address;
      const deliveryFee = isLocalDelivery ? 0 : (settings?.deliveryFee || 5000);
      
      const orderData = {
        order_number: orderNumber,
        customer_name: aiOrder.customer_name,
        customer_phone: aiOrder.customer_phone,
        customer_address: aiOrder.customer_address,
        customer_city: aiOrder.customer_city || 'بغداد',
        customer_province: aiOrder.customer_province || 'بغداد',
        total_amount: aiOrder.total_amount - deliveryFee, // المبلغ بدون أجرة التوصيل
        final_amount: aiOrder.total_amount,
        delivery_fee: deliveryFee,
        status: 'processing',
        delivery_status: 'pending',
        payment_status: 'pending',
        tracking_number: trackingNumber,
        delivery_partner: isLocalDelivery ? 'محلي' : 'الوسيط',
        created_by: user?.id,
        notes: `طلب مُحوَّل من الذكاء الاصطناعي - المصدر: ${aiOrder.source}${aiOrder.order_data?.original_text ? '\nالنص الأصلي: ' + aiOrder.order_data.original_text : ''}`
      };

      const { data: newOrder, error: createError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (createError) throw createError;

      // إنشاء عناصر الطلب مع التأكد من استخدام المنتج والمتغير الصحيح
      const orderItems = [];
      for (const item of aiOrder.items) {
        // التأكد من أن المنتج والمتغير موجودان
        if (item.product_id && item.variant_id) {
          orderItems.push({
            order_id: newOrder.id,
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity: item.quantity || 1,
            unit_price: item.price || 0,
            total_price: (item.price || 0) * (item.quantity || 1)
          });
        }
      }

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // حجز المخزون للمنتجات
      for (const item of aiOrder.items) {
        if (item.product_id) {
          const { error: stockError } = await supabase
            .from('inventory')
            .update({
              reserved_quantity: supabase.raw('reserved_quantity + ?', [item.quantity || 1])
            })
            .eq('product_id', item.product_id)
            .eq('variant_id', item.variant_id || null);

          if (stockError) {
            console.error('Error reserving stock:', stockError);
          }
        }
      }

      // إزالة من قائمة الطلبات الذكية
      setAiOrders(prev => prev.filter(o => o.id !== orderId));
      
      // إضافة إلى قائمة الطلبات العادية
      setOrders(prev => [...prev, { ...newOrder, items: orderItems }]);
      
      // إنشاء إشعار للموظف
      await supabase.from('notifications').insert({
        type: 'order_approved',
        title: 'تمت الموافقة على الطلب',
        message: `تمت الموافقة على الطلب الذكي وتحويله إلى طلب رقم ${orderNumber}`,
        user_id: aiOrder.created_by,
        data: {
          order_id: newOrder.id,
          order_number: orderNumber,
          customer_name: aiOrder.customer_name,
          ai_order_id: orderId
        }
      });

      // تشغيل حساب الأرباح
      await supabase.rpc('calculate_order_profit', { order_id_input: newOrder.id });

      toast({ title: "نجاح", description: `تمت الموافقة على الطلب وتحويله إلى طلب رقم ${orderNumber}` });
      
      onStockUpdate?.();
    } catch (error) {
      console.error('Error approving AI order:', error);
      toast({ title: "خطأ", description: error.message || "فشل الموافقة على الطلب الذكي.", variant: "destructive" });
      throw error;
    }
  };

  return { orders, setOrders, aiOrders, setAiOrders, createOrder, updateOrder, deleteOrders, approveAiOrder };
};
