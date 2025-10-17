/**
 * نظام موحد لمنطق حذف الطلبات
 */

// قائمة حالات التسليم المسموح حذفها للطلبات الخارجية
const DELETABLE_DELIVERY_STATUSES = [
  'فعال',
  'active', 
  'في انتظار استلام المندوب',
  'waiting for pickup',
  'pending pickup',
  'جديد',
  'new',
  'معطل',
  'غير فعال',
  'disabled',
  'inactive'
];

/**
 * التحقق من إمكانية حذف الطلب
 * @param {Object} order - بيانات الطلب
 * @returns {boolean} - هل يمكن حذف الطلب
 */
export const canDeleteOrder = (order) => {
  if (!order) {
    console.warn('🚫 لا يمكن فحص طلب فارغ');
    return false;
  }

  // تسجيل لمراقبة المنطق
  console.log('🔍 فحص إمكانية حذف الطلب:', {
    orderId: order.id,
    orderNumber: order.order_number,
    status: order.status,
    deliveryStatus: order.delivery_status,
    isExternal: !!order.external_id
  });

  // ✅ الطلب محلي = لا يملك معرف شركة توصيل أو شركة التوصيل هي "محلي"
  const isLocalOrder = !order.delivery_partner_order_id || 
                       !order.delivery_partner || 
                       order.delivery_partner === 'محلي' ||
                       (order.delivery_partner && order.delivery_partner.toLowerCase() === 'local');
  
  if (isLocalOrder) {
    // الطلبات المحلية: فقط إذا كانت في انتظار
    const canDelete = order.status === 'pending';
    console.log('📝 طلب محلي - يمكن الحذف:', canDelete);
    return canDelete;
  }

  // الطلبات الخارجية: فحص حالة التسليم
  const deliveryStatus = (order.delivery_status || '').toLowerCase().trim();
  const orderStatus = (order.status || '').toLowerCase().trim();
  
  // مسموح حذف الطلبات في حالة pending أو في حالات تسليم محددة
  const canDeleteByStatus = orderStatus === 'pending';
  const canDeleteByDelivery = DELETABLE_DELIVERY_STATUSES.some(status => 
    deliveryStatus.includes(status.toLowerCase())
  );
  
  const canDelete = canDeleteByStatus || canDeleteByDelivery;
  
  console.log('🚚 طلب خارجي - تفاصيل الحذف:', {
    orderStatus,
    deliveryStatus,
    canDeleteByStatus,
    canDeleteByDelivery,
    finalResult: canDelete
  });
  
  return canDelete;
};

/**
 * التحقق من أن الطلب قبل استلام المندوب (للطلبات الخارجية)
 * @param {Object} order - بيانات الطلب
 * @returns {boolean}
 */
export const isBeforePickup = (order) => {
  // ✅ فحص الطلبات الخارجية بواسطة delivery_partner_order_id
  if (!order || !order.delivery_partner_order_id) return false;
  
  const deliveryStatus = (order.delivery_status || '').toLowerCase().trim();
  return DELETABLE_DELIVERY_STATUSES.some(status => 
    deliveryStatus.includes(status.toLowerCase())
  );
};

/**
 * رسائل التأكيد المناسبة لكل نوع طلب
 * @param {Object} order - بيانات الطلب
 * @returns {string}
 */
export const getDeleteConfirmationMessage = (order) => {
  // ✅ استخدام نفس منطق الفحص الجديد
  const isLocalOrder = !order.delivery_partner_order_id || 
                       !order.delivery_partner || 
                       order.delivery_partner === 'محلي' ||
                       (order.delivery_partner && order.delivery_partner.toLowerCase() === 'local');
  const orderNumber = order.order_number || order.id;
  
  if (isLocalOrder) {
    return `هل أنت متأكد من حذف الطلب المحلي ${orderNumber}؟`;
  }
  
  return `هل أنت متأكد من حذف الطلب الخارجي ${orderNumber}؟\nحالة التسليم: ${order.delivery_status || 'غير محددة'}`;
};