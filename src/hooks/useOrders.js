import React, { useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

export const useOrders = (initialOrders, initialAiOrders, settings, onStockUpdate, addNotification, hasPermission, user) => {
  const [orders, setOrders] = useState(initialOrders);
  const [aiOrders, setAiOrders] = useState(initialAiOrders);

  // إنشاء رقم تتبع للطلبات المحلية
  const generateLocalTrackingNumber = () => {
    return `${settings?.sku_prefix || 'RYUS'}-${Date.now().toString().slice(-6)}`;
  };

  // إنشاء طلب جديد
  const createOrder = useCallback(async (customerInfo, cartItems, trackingNumber, discount, status, qrLink = null, deliveryPartnerData = null) => {
    try {
      // تحديد نوع الطلب
      const isLocalOrder = !deliveryPartnerData?.delivery_partner || deliveryPartnerData?.delivery_partner === 'محلي';
      
      // رقم التتبع
      let finalTrackingNumber = trackingNumber;
      if (isLocalOrder) {
        // للطلبات المحلية: إنشاء رقم RYUS دائماً
        finalTrackingNumber = generateLocalTrackingNumber();
      } else {
        // للطلبات الخارجية: يجب أن يأتي رقم التتبع من الشركة
        if (!finalTrackingNumber) {
          return { success: false, error: 'رقم التتبع مطلوب لطلبات شركات التوصيل' };
        }
      }

      // إنشاء رقم الطلب
      const { data: orderNumber, error: orderNumberError } = await supabase.rpc('generate_order_number');
      if (orderNumberError) {
        console.error('Error generating order number:', orderNumberError);
        return { success: false, error: 'فشل في إنشاء رقم الطلب' };
      }

      // حساب المبالغ
      const subtotal = cartItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
      const deliveryFee = isLocalOrder ? (settings?.deliveryFee || 0) : (deliveryPartnerData?.delivery_fee || 0);
      const total = subtotal - (discount || 0) + deliveryFee;

      // بيانات الطلب
      const newOrder = {
        order_number: orderNumber,
        customer_name: customerInfo.name,
        customer_phone: customerInfo.phone,
        customer_address: customerInfo.address,
        customer_city: customerInfo.city,
        customer_province: customerInfo.province,
        total_amount: subtotal,
        discount: discount || 0,
        delivery_fee: deliveryFee,
        final_amount: total,
        status: 'pending', // دائماً قيد التجهيز في البداية
        delivery_status: 'pending',
        payment_status: 'pending',
        tracking_number: finalTrackingNumber,
        delivery_partner: isLocalOrder ? 'محلي' : deliveryPartnerData.delivery_partner,
        notes: customerInfo.notes,
        created_by: user?.user_id || user?.id,
      };

      // حجز المنتجات في المخزون - مباشرة بدون دوال قاعدة البيانات
      for (const item of cartItems) {
        const { data: currentInventory, error: fetchError } = await supabase
          .from('inventory')
          .select('quantity, reserved_quantity')
          .eq('product_id', item.productId)
          .eq('variant_id', item.variantId)
          .single();

        if (fetchError || !currentInventory) {
          return { success: false, error: `المنتج غير موجود في المخزون` };
        }

        const availableQuantity = currentInventory.quantity - currentInventory.reserved_quantity;
        if (availableQuantity < item.quantity) {
          return { success: false, error: `الكمية المتاحة غير كافية للمنتج ${item.productName || 'غير محدد'}` };
        }

        // تحديث الكمية المحجوزة
        const { error: reserveError } = await supabase
          .from('inventory')
          .update({ 
            reserved_quantity: currentInventory.reserved_quantity + item.quantity 
          })
          .eq('product_id', item.productId)
          .eq('variant_id', item.variantId);

        if (reserveError) {
          return { success: false, error: `فشل في حجز المخزون للمنتج ${item.productName || 'غير محدد'}` };
        }
      }

      // إنشاء الطلب
      const { data: createdOrder, error: orderError } = await supabase
        .from('orders')
        .insert(newOrder)
        .select()
        .single();

      if (orderError) {
        // إلغاء حجز المخزون في حالة فشل إنشاء الطلب
        for (const item of cartItems) {
          const { data: currentInventory } = await supabase
            .from('inventory')
            .select('reserved_quantity')
            .eq('product_id', item.productId)
            .eq('variant_id', item.variantId)
            .single();

          if (currentInventory) {
            await supabase
              .from('inventory')
              .update({ 
                reserved_quantity: Math.max(0, currentInventory.reserved_quantity - item.quantity)
              })
              .eq('product_id', item.productId)
              .eq('variant_id', item.variantId);
          }
        }
        console.error('Error creating order:', orderError);
        return { success: false, error: orderError.message };
      }

      // إنشاء عناصر الطلب
      const orderItems = cartItems.map(item => ({
        order_id: createdOrder.id,
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.quantity * item.price
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
        // نحذف الطلب ونلغي حجز المخزون
        await supabase.from('orders').delete().eq('id', createdOrder.id);
        for (const item of cartItems) {
          const { data: currentInventory } = await supabase
            .from('inventory')
            .select('reserved_quantity')
            .eq('product_id', item.productId)
            .eq('variant_id', item.variantId)
            .single();

          if (currentInventory) {
            await supabase
              .from('inventory')
              .update({ 
                reserved_quantity: Math.max(0, currentInventory.reserved_quantity - item.quantity)
              })
              .eq('product_id', item.productId)
              .eq('variant_id', item.variantId);
          }
        }
        return { success: false, error: 'فشل في إنشاء عناصر الطلب' };
      }

      // إضافة سجل الخصم إذا كان هناك خصم
      if (discount > 0) {
        const { error: discountError } = await supabase
          .from('order_discounts')
          .insert({
            order_id: createdOrder.id,
            discount_amount: discount,
            applied_by: user?.user_id || user?.id,
            affects_employee_profit: true,
            discount_reason: 'خصم من خلال نظام الطلب السريع'
          });

        if (discountError) {
          console.error('Error recording discount:', discountError);
          // نستمر حتى لو فشل تسجيل الخصم
        }
      }
      addNotification({
        type: 'new_order',
        title: `طلب ${isLocalOrder ? 'محلي' : 'توصيل'} جديد`,
        message: `تم إنشاء طلب جديد برقم ${finalTrackingNumber} بواسطة ${user?.full_name || 'موظف'}`,
        user_id: null, // للجميع
        link: `/my-orders?trackingNumber=${finalTrackingNumber}`,
        color: isLocalOrder ? 'green' : 'blue',
        icon: 'ShoppingCart'
      });

      // إضافة للقائمة
      setOrders(prev => [createdOrder, ...prev]);
      
      return { success: true, trackingNumber: finalTrackingNumber, orderId: createdOrder.id };

    } catch (error) {
      console.error('Error in createOrder:', error);
      return { success: false, error: error.message || 'حدث خطأ في إنشاء الطلب' };
    }
  }, [settings, addNotification, user]);

  // تحديث حالة الطلب
  const updateOrder = async (orderId, updates) => {
    try {
      const originalOrder = orders.find(o => o.id === orderId);
      if (!originalOrder) {
        return { success: false, error: 'الطلب غير موجود' };
      }

      // التحقق من الصلاحيات - يمكن التعديل فقط في الحالات المسموحة
      const allowedEditStates = ['pending', 'shipped', 'needs_processing'];
      if (!allowedEditStates.includes(originalOrder.status)) {
        return { success: false, error: 'لا يمكن تعديل هذا الطلب في حالته الحالية' };
      }

      const { data: updatedOrder, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();

      if (error) {
        console.error('Error updating order:', error);
        return { success: false, error: error.message };
      }

      // معالجة تغيير الحالة
      if (updates.status && updates.status !== originalOrder.status) {
        await handleStatusChange(originalOrder, updatedOrder);
      }

      setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
      
      toast({ 
        title: "تم التحديث", 
        description: "تم تحديث الطلب بنجاح",
        variant: "success" 
      });

      return { success: true, data: updatedOrder };

    } catch (error) {
      console.error('Error in updateOrder:', error);
      return { success: false, error: error.message };
    }
  };

  // معالجة تغيير الحالة
  const handleStatusChange = async (originalOrder, updatedOrder) => {
    try {
      console.log('Handling status change:', originalOrder.status, '->', updatedOrder.status);
      
      // 1. pending (قيد التجهيز) - المخزون محجوز
      // لا حاجة لتغيير شيء هنا، المخزون محجوز من البداية
      
      // 2. shipped (تم الشحن) - مبيعات معلقة، تحتاج معالجة
      if (updatedOrder.status === 'shipped' && originalOrder.status !== 'shipped') {
        console.log('Processing shipped status...');
        
        // تغيير الحالة إلى "تحتاج معالجة" لجعل المستخدم يعرف أن هناك خطوة أخرى
        await supabase
          .from('orders')
          .update({ status: 'needs_processing' })
          .eq('id', updatedOrder.id);
          
        // تحديث الطلب في الحالة المحلية
        updatedOrder.status = 'needs_processing';
        
        // تحديث حالة الأرباح إلى معلقة
        const { error: profitError } = await supabase
          .from('profits')
          .update({ status: 'pending_sale' })
          .eq('order_id', updatedOrder.id);
          
        if (profitError) {
          console.error('Error updating profit status:', profitError);
        }
        
        toast({
          title: "تم الشحن",
          description: "تم تغيير حالة الطلب إلى 'تحتاج معالجة'. يمكنك الآن تحديثها إلى 'تم التوصيل'.",
          variant: "success"
        });
      }
      
      // 3. delivered (تم التوصيل) - خصم فعلي من المخزون، أرباح معلقة
      if (updatedOrder.status === 'delivered' && originalOrder.status !== 'delivered') {
        console.log('Processing delivered status...');
        
        try {
          await finalizeStock(updatedOrder.id);
          console.log('Stock finalized successfully');
        } catch (stockError) {
          console.error('Error finalizing stock:', stockError);
          throw new Error('فشل في خصم المخزون');
        }
        
        // لا نحسب الأرباح هنا - ستحسب عند استلام الفاتورة
        toast({
          title: "تم التوصيل",
          description: "تم تسجيل الطلب كموصل. يمكن الآن استلام الفاتورة من نافذة الأرباح المعلقة.",
          variant: "success"
        });
      }
      
      // 4. إذا تم إلغاء الطلب، نلغي حجز المخزون
      if (updatedOrder.status === 'cancelled' && originalOrder.status !== 'cancelled') {
        console.log('Processing cancelled status...');
        
        try {
          await releaseStock(updatedOrder.id);
          console.log('Stock released successfully');
        } catch (stockError) {
          console.error('Error releasing stock:', stockError);
        }
        
        // حذف سجل الأرباح إذا كان موجوداً
        const { error: deleteProfitError } = await supabase
          .from('profits')
          .delete()
          .eq('order_id', updatedOrder.id);
          
        if (deleteProfitError) {
          console.error('Error deleting profit record:', deleteProfitError);
        }
      }
    } catch (error) {
      console.error('Error in handleStatusChange:', error);
      throw error;
    }
    
    // أسماء الحالات الموحدة للنظامين
    const statusNames = {
      'pending': 'قيد التجهيز',
      'shipped': 'تم الشحن', 
      'needs_processing': 'تحتاج معالجة',
      'delivered': 'تم التوصيل',
      'returned': 'راجع',
      'cancelled': 'ملغي'
    };

    addNotification({
      type: 'order_status_update',
      title: 'تحديث حالة الطلب',
      message: `تم تغيير حالة طلبك رقم ${updatedOrder.tracking_number} إلى "${statusNames[updatedOrder.status]}"`,
      user_id: updatedOrder.created_by,
      link: `/my-orders?trackingNumber=${updatedOrder.tracking_number}`,
      color: updatedOrder.status === 'delivered' ? 'green' : 'blue',
      icon: 'Package'
    });
  };

  // إنهاء المخزون (خصم فعلي عند التسليم)
  const finalizeStock = async (orderId) => {
    try {
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('product_id, variant_id, quantity')
        .eq('order_id', orderId);

      for (const item of orderItems || []) {
        // خصم من المخزون الفعلي وإلغاء الحجز - مباشرة بدون دوال
        const { data: currentInventory, error: fetchError } = await supabase
          .from('inventory')
          .select('quantity, reserved_quantity')
          .eq('product_id', item.product_id)
          .eq('variant_id', item.variant_id)
          .single();

        if (!fetchError && currentInventory) {
          await supabase
            .from('inventory')
            .update({ 
              quantity: currentInventory.quantity - item.quantity,
              reserved_quantity: currentInventory.reserved_quantity - item.quantity
            })
            .eq('product_id', item.product_id)
            .eq('variant_id', item.variant_id);
        }
      }
    } catch (error) {
      console.error('Error finalizing stock:', error);
    }
  };

  // إلغاء حجز المخزون (عند الإلغاء)
  const releaseStock = async (orderId) => {
    try {
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('product_id, variant_id, quantity')
        .eq('order_id', orderId);

      for (const item of orderItems || []) {
        // إلغاء الحجز فقط - مباشرة بدون دوال
        const { data: currentInventory, error: fetchError } = await supabase
          .from('inventory')
          .select('reserved_quantity')
          .eq('product_id', item.product_id)
          .eq('variant_id', item.variant_id)
          .single();

        if (!fetchError && currentInventory) {
          await supabase
            .from('inventory')
            .update({ 
              reserved_quantity: Math.max(0, currentInventory.reserved_quantity - item.quantity)
            })
            .eq('product_id', item.product_id)
            .eq('variant_id', item.variant_id);
        }
      }
    } catch (error) {
      console.error('Error releasing stock:', error);
    }
  };

  // حذف الطلبات
  const deleteOrders = async (orderIds, isAiOrder = false) => {
    try {
      if (isAiOrder) {
        // حذف طلبات الذكاء الاصطناعي
        const { error } = await supabase.from('ai_orders').delete().in('id', orderIds);
        if (error) throw error;
        
        setAiOrders(prev => prev.filter(o => !orderIds.includes(o.id)));
      } else {
        // حذف الطلبات العادية - فقط قيد التجهيز (للنظامين)
        const ordersToDelete = orders.filter(o => 
          orderIds.includes(o.id) && 
          o.status === 'pending'
        );
        
        if (ordersToDelete.length === 0) {
          toast({ 
            title: "تنبيه", 
            description: "يمكن حذف الطلبات في مرحلة 'قيد التجهيز' فقط",
            variant: "destructive" 
          });
          return;
        }

        const deleteIds = ordersToDelete.map(o => o.id);
        
        // إلغاء حجز المخزون أولاً
        for (const order of ordersToDelete) {
          await releaseStock(order.id);
        }
        
        // حذف الطلبات
        const { error } = await supabase.from('orders').delete().in('id', deleteIds);
        if (error) throw error;
        
        setOrders(prev => prev.filter(o => !deleteIds.includes(o.id)));
        
        toast({ 
          title: "تم الحذف", 
          description: `تم حذف ${deleteIds.length} طلب بنجاح`,
          variant: "success" 
        });
      }
    } catch (error) {
      console.error('Error deleting orders:', error);
      toast({ 
        title: "خطأ", 
        description: "فشل في حذف الطلبات",
        variant: "destructive" 
      });
    }
  };

  // الموافقة على طلب ذكي (سيتم تطويره لاحقاً)
  const approveAiOrder = async (orderId) => {
    // TODO: تطوير نظام الطلبات الذكية
    console.log('Approve AI order:', orderId);
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