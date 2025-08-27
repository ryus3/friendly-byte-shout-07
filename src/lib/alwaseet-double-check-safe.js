/**
 * نظام الفحص المزدوج الآمن للطلبات في الوسيط - نسخة محسنة
 */

import * as AlWaseetAPI from './alwaseet-api';

/**
 * فحص مزدوج آمن لتأكيد عدم وجود الطلب في الوسيط
 * @param {string} token - رمز المصادقة
 * @param {Object} order - بيانات الطلب المحلي
 * @returns {Promise<{exists: boolean, verified: boolean, error?: string}>}
 */
export const doubleCheckOrderDeletion = async (token, order) => {
  if (!token || !order) {
    return { exists: true, verified: false, error: 'معطيات غير صحيحة' };
  }

  console.log(`🔍 بدء الفحص المزدوج للطلب ${order.tracking_number}...`);

  try {
    // الفحص الأول: بـ tracking_number
    const firstCheck = await AlWaseetAPI.getOrderByQR(token, order.tracking_number).catch(() => null);
    console.log('🔍 الفحص الأول (tracking_number):', firstCheck ? 'موجود' : 'غير موجود');

    // تأخير قصير بين الفحصين
    await new Promise(resolve => setTimeout(resolve, 2000));

    // الفحص الثاني: بـ delivery_partner_order_id إذا كان متوفراً، وإلا بـ tracking_number مرة أخرى
    let secondCheck = null;
    if (order.delivery_partner_order_id) {
      secondCheck = await AlWaseetAPI.getOrderById(token, order.delivery_partner_order_id).catch(() => null);
      console.log('🔍 الفحص الثاني (delivery_partner_order_id):', secondCheck ? 'موجود' : 'غير موجود');
    } else {
      secondCheck = await AlWaseetAPI.getOrderByQR(token, order.tracking_number).catch(() => null);
      console.log('🔍 الفحص الثاني (tracking_number مرة أخرى):', secondCheck ? 'موجود' : 'غير موجود');
    }

    // تحليل النتائج
    const firstExists = firstCheck != null;
    const secondExists = secondCheck != null;

    // الطلب موجود إذا وُجد في أي من الفحصين
    const orderExists = firstExists || secondExists;

    console.log(`✅ الفحص المزدوج مكتمل للطلب ${order.tracking_number}:`, {
      firstExists,
      secondExists,
      finalResult: orderExists,
      verified: true
    });

    return {
      exists: orderExists,
      verified: true,
      details: {
        firstCheck: firstExists,
        secondCheck: secondExists,
        trackingNumber: order.tracking_number,
        deliveryPartnerId: order.delivery_partner_order_id
      }
    };

  } catch (error) {
    console.error('❌ خطأ في الفحص المزدوج:', error);
    
    // في حالة الخطأ، نعتبر الطلب موجوداً (للأمان)
    return {
      exists: true,
      verified: false,
      error: error.message
    };
  }
};

/**
 * فحص سريع لوجود الطلب (فحص واحد فقط)
 * @param {string} token - رمز المصادقة
 * @param {string} trackingNumber - رقم التتبع
 * @returns {Promise<boolean>}
 */
export const quickCheckOrderExists = async (token, trackingNumber) => {
  try {
    const order = await AlWaseetAPI.getOrderByQR(token, trackingNumber);
    return order != null;
  } catch (error) {
    console.error('❌ خطأ في الفحص السريع:', error);
    return true; // للأمان، نعتبر الطلب موجوداً في حالة الخطأ
  }
};