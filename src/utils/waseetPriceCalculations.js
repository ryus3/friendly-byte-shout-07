/**
 * 🎯 دالة موحدة لحساب الأسعار من API الوسيط
 * تضمن الاتساق في جميع ملفات المزامنة
 */

/**
 * حساب الأسعار من بيانات طلب الوسيط
 * @param {Object} waseetOrder - الطلب من API الوسيط
 * @param {Object} localOrder - الطلب المحلي من قاعدة البيانات
 * @returns {Object} الأسعار المحسوبة والتحديثات المطلوبة
 */
export const calculateWaseetPrices = (waseetOrder, localOrder) => {
  // 1. جلب الأسعار من الوسيط
  const waseetTotalPrice = parseFloat(waseetOrder.total_price || waseetOrder.price || '0');
  const waseetDeliveryFee = parseFloat(waseetOrder.delivery_price || '0');

  // 2. فصل سعر المنتجات من السعر الشامل (المنتجات = الشامل - التوصيل)
  const productsPriceFromWaseet = waseetTotalPrice - waseetDeliveryFee;

  // 3. الأسعار المحلية الحالية
  const localTotalAmount = parseFloat(localOrder.total_amount || '0');  // سعر المنتجات
  const localDeliveryFee = parseFloat(localOrder.delivery_fee || '0');
  const localFinalAmount = parseFloat(localOrder.final_amount || '0');  // الشامل

  // 4. السعر الأصلي للمنتجات عند الإنشاء (من final_amount - delivery_fee)
  const originalProductsPrice = localFinalAmount - localDeliveryFee;

  // 5. حساب الفرق (بين السعر الأصلي والسعر الجديد من الوسيط)
  const priceDiff = originalProductsPrice - productsPriceFromWaseet;

  // 6. التحقق من صحة البيانات
  const validation = {
    isValid: true,
    warnings: [],
    errors: []
  };

  if (waseetTotalPrice > 0 && waseetTotalPrice < waseetDeliveryFee) {
    validation.warnings.push('⚠️ السعر الشامل أقل من رسوم التوصيل!');
    validation.isValid = false;
  }

  if (productsPriceFromWaseet < 0) {
    validation.errors.push('❌ سعر المنتجات سالب! لن يتم التحديث');
    validation.isValid = false;
  }

  if (waseetTotalPrice === 0) {
    validation.warnings.push('⚠️ السعر الشامل = 0');
  }

  // 7. تحديد ما إذا كان هناك حاجة لتحديث السعر
  const needsPriceUpdate = productsPriceFromWaseet !== localTotalAmount && waseetTotalPrice > 0;

  // 8. حساب التحديثات المطلوبة
  const updates = {};

  if (needsPriceUpdate && validation.isValid) {
    updates.total_amount = productsPriceFromWaseet;      // سعر المنتجات
    updates.sales_amount = productsPriceFromWaseet;      // مماثل
    updates.delivery_fee = waseetDeliveryFee;            // رسوم التوصيل
    updates.final_amount = productsPriceFromWaseet + waseetDeliveryFee;  // الشامل

    // حساب الزيادة/الخصم بناءً على السعر الأصلي
    if (priceDiff > 0) {
      // الفرق إيجابي = خصم (السعر الجديد أقل من الأصلي)
      updates.discount = priceDiff;
      updates.price_increase = 0;
      updates.price_change_type = 'discount';
    } else if (priceDiff < 0) {
      // الفرق سالب = زيادة (السعر الجديد أعلى من الأصلي)
      updates.price_increase = Math.abs(priceDiff);
      updates.discount = 0;
      updates.price_change_type = 'increase';
    } else {
      // لا تغيير في السعر
      updates.price_increase = 0;
      updates.discount = 0;
      updates.price_change_type = null;
    }
  }

  // 9. إرجاع كل شيء
  return {
    // البيانات المحسوبة
    waseetTotalPrice,
    waseetDeliveryFee,
    productsPriceFromWaseet,
    localTotalAmount,
    localDeliveryFee,
    localFinalAmount,
    originalProductsPrice,
    priceDiff,
    
    // التحقق والتحديثات
    validation,
    needsPriceUpdate,
    updates,
    
    // للـ logging
    summary: {
      waseet: {
        total: waseetTotalPrice,
        delivery: waseetDeliveryFee,
        products: productsPriceFromWaseet
      },
      local: {
        total_amount: localTotalAmount,
        delivery_fee: localDeliveryFee,
        final_amount: localFinalAmount,
        original_products: originalProductsPrice
      },
      comparison: {
        price_diff: priceDiff,
        needs_update: needsPriceUpdate,
        change_type: updates.price_change_type || 'no_change'
      }
    }
  };
};

/**
 * طباعة تفاصيل الحساب للتصحيح
 */
export const logPriceCalculation = (calculation, orderId) => {
  console.log(`💰 تحليل الأسعار للطلب ${orderId}:`, calculation.summary);
  
  if (calculation.validation.warnings.length > 0) {
    calculation.validation.warnings.forEach(w => console.warn(w));
  }
  
  if (calculation.validation.errors.length > 0) {
    calculation.validation.errors.forEach(e => console.error(e));
  }
  
  if (calculation.needsPriceUpdate) {
    console.log('📝 التحديثات المطلوبة:', calculation.updates);
  } else {
    console.log('✅ لا حاجة لتحديث السعر');
  }
};
