/**
 * دوال مساعدة لمزامنة الوسيط مع فصل الحسابات
 */

import * as AlWaseetAPI from '@/lib/alwaseet-api';

/**
 * جلب طلبات الوسيط مع استخدام التوكن المناسب
 * @param {string} userToken - توكن المستخدم
 * @param {function} getEmployeeToken - دالة للحصول على توكن موظف محدد
 * @param {string} forUserId - معرف المستخدم (اختياري) للبحث في حساب محدد
 */
export const getMerchantOrdersWithProperToken = async (userToken, getEmployeeToken = null, forUserId = null) => {
  try {
    // إذا كان هناك معرف مستخدم محدد وتوكن الموظف متاح
    if (forUserId && getEmployeeToken) {
      const employeeToken = getEmployeeToken(forUserId);
      if (employeeToken) {
        console.log(`🔍 جلب طلبات الموظف ${forUserId} من حسابه الخاص`);
        return await AlWaseetAPI.getMerchantOrders(employeeToken);
      }
    }
    
    // استخدام التوكن الافتراضي
    if (userToken) {
      console.log('🔍 جلب طلبات باستخدام التوكن المحدد');
      return await AlWaseetAPI.getMerchantOrders(userToken);
    }
    
    console.warn('⚠️ لا يوجد توكن متاح لجلب طلبات الوسيط');
    return [];
  } catch (error) {
    console.error('❌ خطأ في جلب طلبات الوسيط:', error);
    return [];
  }
};

/**
 * تحديد ما إذا كان الطلب يتطلب توكن المالك للمزامنة
 * @param {Object} order - بيانات الطلب
 * @param {Object} currentUser - المستخدم الحالي
 */
export const requiresOwnerToken = (order, currentUser) => {
  // المدير يمكنه مزامنة جميع الطلبات
  if (currentUser?.email === 'ryusbrand@gmail.com' || 
      currentUser?.id === '91484496-b887-44f7-9e5d-be9db5567604') {
    return false;
  }
  
  // للموظفين: فقط طلباتهم الخاصة
  return order.created_by !== currentUser?.id;
};

/**
 * تحديد ما إذا كان يمكن حذف الطلب تلقائياً
 * @param {Object} order - بيانات الطلب
 * @param {Object} currentUser - المستخدم الحالي
 */
export const canAutoDeleteOrder = (order, currentUser) => {
  // منع الحذف إذا لم يكن هذا طلب المستخدم الحالي
  if (requiresOwnerToken(order, currentUser)) {
    console.log(`🔒 منع حذف تلقائي للطلب ${order.tracking_number} - ليس طلب المستخدم الحالي`);
    return false;
  }
  
  // منع الحذف للطلبات المستلمة الإيصال
  if (order.receipt_received) {
    console.log(`🔒 منع حذف تلقائي للطلب ${order.tracking_number} - تم استلام الإيصال`);
    return false;
  }
  
  // منع الحذف للطلبات المكتملة
  if (order.status === 'completed') {
    console.log(`🔒 منع حذف تلقائي للطلب ${order.tracking_number} - طلب مكتمل`);
    return false;
  }
  
  return true;
};

/**
 * تسجيل عملية مزامنة للمراجعة اللاحقة
 * @param {string} operation - نوع العملية
 * @param {Object} orderInfo - معلومات الطلب
 * @param {Object} result - نتيجة العملية
 */
export const logSyncOperation = (operation, orderInfo, result) => {
  const logData = {
    operation,
    timestamp: new Date().toISOString(),
    tracking_number: orderInfo.tracking_number,
    order_id: orderInfo.id,
    user_id: orderInfo.created_by,
    result: result.success,
    details: result
  };
  
  console.log(`📝 سجل المزامنة [${operation}]:`, logData);
  
  // يمكن إضافة حفظ في قاعدة البيانات هنا لاحقاً
  return logData;
};