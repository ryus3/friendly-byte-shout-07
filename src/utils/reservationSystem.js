import { supabase } from '@/lib/customSupabaseClient';

/**
 * نظام إدارة حجز المخزون المتقدم
 * يتعامل مع حالات الطلبات المختلفة ويدير الحجوزات تلقائياً
 */

/**
 * التحقق من حالة إرجاع الطلب - هل يجب تحرير المخزون؟
 * @param {string} status - حالة الطلب الداخلية
 * @param {string} deliveryStatus - حالة التوصيل من شركة التوصيل
 * @param {string} deliveryPartner - شركة التوصيل
 * @returns {boolean} هل يجب تحرير المخزون؟
 */
export const shouldReleaseStock = (status, deliveryStatus, deliveryPartner, itemStatus = null) => {
  // للطلبات المحلية
  if (!deliveryPartner || deliveryPartner === 'محلي') {
    return status === 'completed' || status === 'delivered' || status === 'returned_in_stock';
  }

  // لطلبات الوسيط - دعم التسليم الجزئي
  if (deliveryPartner?.toLowerCase() === 'alwaseet') {
    const stateId = String(deliveryStatus);
    
    // ✅ نظام جديد: التحقق من حالة العنصر الفردية
    if (itemStatus) {
      // حالة 4 (مُسلّم) - تحرير المنتجات المُسلّمة فقط
      if (itemStatus === 'delivered' && stateId === '4') {
        return true;
      }
      
      // حالة 17 (مرتجع) - تحرير المنتجات المرتجعة
      if (itemStatus === 'returned' && stateId === '17') {
        return true;
      }
      
      // المنتجات في pending_return لا تُحرّر
      if (itemStatus === 'pending_return') {
        return false;
      }
    }
    
    try {
      // استخدام النظام الجديد للوسيط
      const { releasesStock } = require('@/lib/alwaseet-statuses');
      if (typeof releasesStock === 'function') {
        return releasesStock(deliveryStatus);
      }
    } catch (error) {
      console.warn('تعذر تحميل نظام الوسيط، سيتم استخدام النظام الافتراضي');
    }
    
    // النظام الافتراضي للوسيط - فقط الحالات 4 و 17 تحرر المخزون
    return stateId === '4' || stateId === '17';
  }

  // لشركات التوصيل الأخرى
  if (deliveryStatus) {
    const lowerStatus = deliveryStatus.toLowerCase();
    // الحالات التي تحرر المخزون
    const releasePatterns = [
      /تسليم|مسلم|deliver/i,
      /راجع.*المخزن|return.*stock/i,
      /تم.*الارجاع.*التاجر/i
    ];
    
    return releasePatterns.some(pattern => pattern.test(lowerStatus));
  }

  // الحالة الافتراضية
  return status === 'completed' || status === 'delivered' || status === 'returned_in_stock';
};

/**
 * التحقق من حالة حجز الطلب - هل يجب الاحتفاظ بالحجز؟
 * @param {string} status - حالة الطلب الداخلية
 * @param {string} deliveryStatus - حالة التوصيل من شركة التوصيل
 * @param {string} deliveryPartner - شركة التوصيل
 * @returns {boolean} هل يجب الاحتفاظ بالحجز؟
 */
export const shouldKeepReservation = (status, deliveryStatus, deliveryPartner) => {
  // إذا كان يجب تحرير المخزون، فلا نحتفظ بالحجز
  if (shouldReleaseStock(status, deliveryStatus, deliveryPartner)) {
    return false;
  }

  // الحالات التي تحتفظ بالحجز
  const reservedStatuses = ['pending', 'shipped', 'in_delivery', 'returned'];
  
  // للطلبات المعادة، نحتفظ بالحجز حتى يتم إرجاعها للمخزن
  if (status === 'returned') {
    return true;
  }

  return reservedStatuses.includes(status);
};

/**
 * تحديث حالة الحجز للطلب بناءً على حالته الحالية
 * @param {string} orderId - معرف الطلب
 * @param {string} status - حالة الطلب الجديدة
 * @param {string} deliveryStatus - حالة التوصيل
 * @param {string} deliveryPartner - شركة التوصيل
 * @returns {Promise<Object>} نتيجة العملية
 */
export const updateOrderReservationStatus = async (orderId, status, deliveryStatus, deliveryPartner) => {
  try {
    // جلب تفاصيل الطلب
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        delivery_status,
        delivery_partner,
        order_items!inner (
          product_id,
          variant_id,
          quantity,
          item_direction
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error(`فشل في جلب بيانات الطلب: ${orderError?.message || 'الطلب غير موجود'}`);
    }

    const shouldRelease = shouldReleaseStock(status, deliveryStatus, deliveryPartner);
    const shouldKeep = shouldKeepReservation(status, deliveryStatus, deliveryPartner);

    console.log(`🔄 تحديث حجز الطلب ${order.order_number}:`, {
      status,
      deliveryStatus,
      deliveryPartner,
      shouldRelease,
      shouldKeep
    });

    if (shouldRelease) {
      // تحرير المخزون المحجوز - فقط للمنتجات الصادرة (outgoing) أو العادية
      for (const item of order.order_items.filter(
        i => !i.item_direction || i.item_direction === 'outgoing'
      )) {
        const { error: releaseError } = await supabase.rpc('release_stock_item', {
          p_product_id: item.product_id,
          p_variant_id: item.variant_id,
          p_quantity: item.quantity
        });

        if (releaseError) {
          console.error(`خطأ في تحرير المخزون للعنصر ${item.product_id}:`, releaseError);
        } else {
          console.log(`✅ تم تحرير ${item.quantity} قطعة من المنتج ${item.product_id}`);
        }
      }

      return { success: true, action: 'released', message: 'تم تحرير المخزون المحجوز' };
    } 
    
    if (shouldKeep) {
      // التأكد من حجز المخزون - فقط للمنتجات الصادرة (outgoing) أو العادية
      for (const item of order.order_items.filter(
        i => !i.item_direction || i.item_direction === 'outgoing'
      )) {
        const { error: reserveError } = await supabase.rpc('reserve_stock_for_order', {
          p_product_id: item.product_id,
          p_variant_id: item.variant_id,
          p_quantity: item.quantity
        });

        if (reserveError) {
          console.warn(`تحذير: تعذر إعادة حجز المخزون للعنصر ${item.product_id}:`, reserveError);
        }
      }

      return { success: true, action: 'reserved', message: 'تم الاحتفاظ بحجز المخزون' };
    }

    return { success: true, action: 'no_change', message: 'لا يوجد تغيير مطلوب في حالة الحجز' };

  } catch (error) {
    console.error('خطأ في تحديث حالة حجز الطلب:', error);
    return { success: false, error: error.message };
  }
};

/**
 * فحص شامل لجميع الطلبات وتصحيح حالات الحجز
 * @returns {Promise<Object>} تقرير العملية
 */
export const auditAndFixReservations = async () => {
  try {
    console.log('🔍 بدء فحص شامل لحالات حجز المخزون...');

    // جلب جميع الطلبات النشطة
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        delivery_status,
        delivery_partner,
        order_items!inner (
          product_id,
          variant_id,
          quantity,
          item_direction
        )
      `)
      .in('status', ['pending', 'shipped', 'delivery', 'returned', 'completed', 'delivered']);

    if (ordersError) {
      throw new Error(`فشل في جلب الطلبات: ${ordersError.message}`);
    }

    let processed = 0;
    let released = 0;
    let reserved = 0;
    let errors = 0;

    for (const order of orders) {
      try {
        const result = await updateOrderReservationStatus(
          order.id,
          order.status,
          order.delivery_status,
          order.delivery_partner
        );

        if (result.success) {
          processed++;
          if (result.action === 'released') released++;
          if (result.action === 'reserved') reserved++;
        } else {
          errors++;
          console.error(`خطأ في معالجة الطلب ${order.order_number}:`, result.error);
        }
      } catch (error) {
        errors++;
        console.error(`خطأ في معالجة الطلب ${order.order_number}:`, error);
      }
    }

    const report = {
      success: true,
      summary: {
        totalOrders: orders.length,
        processed,
        released,
        reserved,
        errors
      },
      message: `تم فحص ${orders.length} طلب. تم تحرير ${released} طلب وحجز ${reserved} طلب. أخطاء: ${errors}`
    };

    console.log('✅ انتهى الفحص الشامل:', report);
    return report;

  } catch (error) {
    console.error('خطأ في الفحص الشامل:', error);
    return { success: false, error: error.message };
  }
};

/**
 * تحرير منتجات محددة من الطلب وتحديث حالتها
 * @param {string} orderId - معرف الطلب
 * @param {Array} deliveredItemIds - معرفات العناصر المُسلّمة
 * @returns {Promise<Object>} نتيجة العملية
 */
export const releaseDeliveredItems = async (orderId, deliveredItemIds) => {
  try {
    const { data: items, error } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .in('id', deliveredItemIds);

    if (error) throw error;

    for (const item of items) {
      // تحديث حالة العنصر
      await supabase
        .from('order_items')
        .update({
          item_status: 'delivered',
          quantity_delivered: item.quantity,
          delivered_at: new Date().toISOString()
        })
        .eq('id', item.id);

      // تحرير المخزون
      await supabase.rpc('release_stock_item', {
        p_product_id: item.product_id,
        p_variant_id: item.variant_id,
        p_quantity: item.quantity
      });
    }

    // تحديث العناصر الأخرى → pending_return
    const { data: allItems } = await supabase
      .from('order_items')
      .select('id')
      .eq('order_id', orderId);

    const undeliveredIds = allItems
      .filter(item => !deliveredItemIds.includes(item.id))
      .map(item => item.id);

    if (undeliveredIds.length > 0) {
      await supabase
        .from('order_items')
        .update({ item_status: 'pending_return' })
        .in('id', undeliveredIds);
    }

    return { success: true, delivered: deliveredItemIds.length };
  } catch (error) {
    console.error('خطأ في تحرير المنتجات المُسلّمة:', error);
    return { success: false, error: error.message };
  }
};

/**
 * إرجاع منتجات غير مُسلّمة للمخزون (حالة 17)
 * @param {string} orderId - معرف الطلب
 * @returns {Promise<Object>} نتيجة العملية
 */
export const returnUndeliveredItems = async (orderId) => {
  try {
    const { data: items, error } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .eq('item_status', 'pending_return');

    if (error) throw error;

    for (const item of items) {
      // تحديث حالة العنصر
      await supabase
        .from('order_items')
        .update({
          item_status: 'returned',
          quantity_returned: item.quantity,
          returned_at: new Date().toISOString()
        })
        .eq('id', item.id);

      // إرجاع للمخزون
      await supabase.rpc('return_stock_item', {
        p_product_id: item.product_id,
        p_variant_id: item.variant_id,
        p_quantity: item.quantity
      });
    }

    return { success: true, returned: items.length };
  } catch (error) {
    console.error('خطأ في إرجاع المنتجات:', error);
    return { success: false, error: error.message };
  }
};

export default {
  shouldReleaseStock,
  shouldKeepReservation,
  updateOrderReservationStatus,
  auditAndFixReservations,
  releaseDeliveredItems,
  returnUndeliveredItems
};