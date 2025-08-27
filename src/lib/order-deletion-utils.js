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
 * التحقق من إمكانية الحذف التلقائي للطلب
 * @param {Object} order - بيانات الطلب
 * @returns {boolean} - هل يمكن حذف الطلب تلقائياً
 */
export const canAutoDeleteOrder = (order) => {
  if (!order) {
    console.warn('🚫 لا يمكن فحص طلب فارغ');
    return false;
  }

  // شروط صارمة للحذف التلقائي الآمن
  const isValidForDeletion = (
    order.status === 'pending' &&                     // فقط الطلبات قيد التجهيز
    order.delivery_partner === 'alwaseet' &&          // فقط طلبات الوسيط
    !order.receipt_received &&                        // لم يتم استلام إيصال
    order.created_at &&                               // لديه تاريخ إنشاء
    new Date() - new Date(order.created_at) > 10 * 60 * 1000  // أقدم من 10 دقائق
  );

  console.log('🔍 فحص إمكانية الحذف التلقائي:', {
    orderId: order.id,
    trackingNumber: order.tracking_number,
    status: order.status,
    deliveryPartner: order.delivery_partner,
    receiptReceived: order.receipt_received,
    ageInMinutes: order.created_at ? Math.round((new Date() - new Date(order.created_at)) / 60000) : 'غير محدد',
    canDelete: isValidForDeletion
  });

  return isValidForDeletion;
};

/**
 * التحقق من إمكانية حذف الطلب (للحذف اليدوي)
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

  const isLocalOrder = !order.external_id;
  
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
 * التحقق من أن الطلب قبل استلام المندوب للوسيط
 * @param {Object} order - بيانات الطلب
 * @returns {boolean}
 */
export const isPrePickupForWaseet = (order) => {
  if (!order || order.delivery_partner !== 'alwaseet') return false;
  
  // إذا كان الطلب pending وبدون استلام فاتورة، فهو قبل الاستلام
  if (order.status === 'pending' && !order.receipt_received) {
    return true;
  }
  
  // فحص حالات التسليم النصية أيضاً
  const deliveryStatus = (order.delivery_status || '').toLowerCase().trim();
  return DELETABLE_DELIVERY_STATUSES.some(status => 
    deliveryStatus.includes(status.toLowerCase())
  );
};

/**
 * التحقق من أن الطلب قبل استلام المندوب (للطلبات الخارجية)
 * @param {Object} order - بيانات الطلب
 * @returns {boolean}
 */
export const isBeforePickup = (order) => {
  if (!order || !order.external_id) return false;
  
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
  const isLocalOrder = !order.external_id;
  const orderNumber = order.order_number || order.id;
  
  if (isLocalOrder) {
    return `هل أنت متأكد من حذف الطلب المحلي ${orderNumber}؟`;
  }
  
  return `هل أنت متأكد من حذف الطلب الخارجي ${orderNumber}؟\nحالة التسليم: ${order.delivery_status || 'غير محددة'}`;
};