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
      description: `فاتورة بيع #${data.id}`,
      related_order_id: data.id,
      user_id: data.created_by,
      related_data: { customer_name: data.customerinfo.name }
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
    const tableName = 'orders'; // استخدام جدول واحد فقط
    if (!isAiOrder && !hasPermission('delete_local_orders')) {
        toast({ title: "غير مصرح به", description: "ليس لديك صلاحية حذف الطلبات.", variant: "destructive" });
        return;
    }
    const { error } = await supabase.from(tableName).delete().in('id', orderIds);
    if (error) {
      toast({ title: "خطأ", description: "فشل حذف الطلبات.", variant: "destructive" });
    } else {
      if (isAiOrder) {
        setAiOrders(prev => prev.filter(o => !orderIds.includes(o.id)));
      } else {
        setOrders(prev => prev.filter(o => !orderIds.includes(o.id)));
      }
      toast({ title: "نجاح", description: `تم حذف ${orderIds.length} طلبات بنجاح.` });
    }
  };
  
  const approveAiOrder = async (orderId) => {
     const aiOrder = aiOrders.find(o => o.id === orderId);
     if (!aiOrder) return;

    const result = await createOrder(
        aiOrder.customerinfo,
        aiOrder.items,
        null, // No tracking number for AI order initially
        aiOrder.total - aiOrder.items.reduce((sum, item) => sum + item.total, 0), // discount
        'pending'
    );

    if (result.success) {
      // إزالة من قائمة الطلبات الذكية (محلياً فقط)
      setAiOrders(prev => prev.filter(o => o.id !== orderId));
      toast({ title: "نجاح", description: "تمت الموافقة على الطلب الذكي وتحويله لطلب عادي." });
    } else {
      toast({ title: "خطأ", description: "فشل تحويل الطلب الذكي.", variant: "destructive" });
    }
  };

  return { orders, setOrders, aiOrders, setAiOrders, createOrder, updateOrder, deleteOrders, approveAiOrder };
};
