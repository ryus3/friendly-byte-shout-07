import devLog from '@/lib/devLogger';
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
    devLog.warn('🚫 لا يمكن فحص طلب فارغ');
    return false;
  }

  // تسجيل لمراقبة المنطق
  devLog.log('🔍 فحص إمكانية حذف الطلب:', {
    orderId: order.id,
    orderNumber: order.order_number,
    status: order.status,
    deliveryStatus: order.delivery_status,
    isExternal: !!order.external_id
  });

  // ✅ كشف الطلب الخارجي عبر الحقول الفعلية في DB:
  //    delivery_partner_order_id أو tracking_number أو delivery_partner != 'محلي'
  const partner = (order.delivery_partner || '').toString().toLowerCase().trim();
  const hasPartnerId = !!(order.delivery_partner_order_id || order.tracking_number || order.external_id || order.qr_id);
  const isExternalPartner = partner && partner !== 'محلي' && partner !== 'local';
  const isLocalOrder = !hasPartnerId && !isExternalPartner;

  if (isLocalOrder) {
    // الطلبات المحلية: فقط إذا كانت في انتظار
    const canDelete = order.status === 'pending';
    devLog.log('📝 طلب محلي - يمكن الحذف:', canDelete);
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
  
  devLog.log('🚚 طلب خارجي - تفاصيل الحذف:', {
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
  if (!order) return false;
  const hasPartnerId = !!(order.delivery_partner_order_id || order.tracking_number || order.external_id || order.qr_id);
  if (!hasPartnerId) return false;

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