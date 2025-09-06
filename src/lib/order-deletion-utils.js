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
 * @param {Object} currentUser - المستخدم الحالي (اختياري للتحقق من المدير)
 * @returns {boolean} - هل يمكن حذف الطلب
 */
export const canDeleteOrder = (order, currentUser = null) => {
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
    receiptReceived: order.receipt_received,
    isExternal: !!order.external_id,
    isManagerOrder: order.created_by === '91484496-b887-44f7-9e5d-be9db5567604'
  });

  const isLocalOrder = !order.external_id;
  const isManagerOrder = order.created_by === '91484496-b887-44f7-9e5d-be9db5567604';
  
  if (isLocalOrder) {
    // الطلبات المحلية: فقط إذا كانت في انتظار
    const canDelete = order.status === 'pending';
    console.log('📝 طلب محلي - يمكن الحذف:', canDelete);
    return canDelete;
  }

  // للطلبات الخارجية: فحص الحالات المختلفة
  const deliveryStatus = (order.delivery_status || '').toLowerCase().trim();
  const orderStatus = (order.status || '').toLowerCase().trim();
  
  // استثناء: المدير - يمكن حذف طلباته حتى لو كانت مستلمة أو مكتملة إذا كانت "راجعة للتاجر"
  if (isManagerOrder) {
    // إذا كانت الحالة تدل على الإرجاع، يمكن الحذف حتى لو كانت completed أو receipt_received
    const isReturnedToMerchant = deliveryStatus.includes('ارجاع') || 
                                deliveryStatus.includes('راجع') || 
                                deliveryStatus.includes('تاجر') ||
                                deliveryStatus === '17'; // الحالة 17 = تم الارجاع الى التاجر
    
    if (isReturnedToMerchant) {
      console.log('🏢 طلب المدير راجع للتاجر - مسموح بالحذف');
      return true;
    }
  }
  
  // لجميع الطلبات الخارجية: لا يحذف إذا كانت مستلمة أو مكتملة (ما عدا طلبات المدير المراجعة)
  if (order.receipt_received || order.status === 'completed') {
    console.log('🚫 لا يمكن حذف طلب مستلم أو مكتمل');
    return false;
  }
  
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