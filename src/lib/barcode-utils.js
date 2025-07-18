/**
 * مكتبة مساعدة لإدارة الباركود في النظام
 */

/**
 * توليد باركود فريد للمتغير
 * @param {string} productName - اسم المنتج
 * @param {string} colorName - اسم اللون
 * @param {string} sizeName - اسم الحجم
 * @param {string} productId - معرف المنتج (اختياري)
 * @returns {string} الباركود الفريد
 */
export const generateUniqueBarcode = (productName, colorName, sizeName, productId = null) => {
  try {
    console.log('🔧 بدء توليد الباركود:', { productName, colorName, sizeName, productId });
    
    // تنظيف النصوص وإزالة المسافات والرموز الخاصة
    const cleanString = (str) => {
      if (!str || typeof str !== 'string') return 'DEF';
      // إزالة المسافات والرموز الخاصة والاحتفاظ بالأحرف والأرقام فقط
      const cleaned = str.replace(/\s+/g, '').replace(/[^\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z0-9]/g, '');
      // أخذ أول 3 أحرف أو "DEF" كافتراضي
      return cleaned.length > 0 ? cleaned.substring(0, 3).toUpperCase() : 'DEF';
    };
    
    // إنشاء أجزاء الباركود
    const productCode = cleanString(productName) || 'PRD';
    const colorCode = cleanString(colorName) || 'CLR';  
    const sizeCode = cleanString(sizeName) || 'SZ';
    
    console.log('📝 أجزاء الباركود:', { productCode, colorCode, sizeCode });
    
    // إضافة جزء فريد لضمان عدم التكرار
    const timestamp = Date.now().toString().slice(-4); // آخر 4 أرقام من الوقت
    const randomCode = Math.random().toString(36).substring(2, 4).toUpperCase(); // 2 أحرف عشوائية
    
    // تكوين الباركود النهائي
    const barcode = `${productCode}${colorCode}${sizeCode}${timestamp}${randomCode}`;
    
    console.log('✅ الباركود المولد:', barcode);
    
    // التأكد من أن الباركود لا يتجاوز 20 حرف
    const finalBarcode = barcode.length > 20 ? barcode.substring(0, 20) : barcode;
    
    console.log('🎯 الباركود النهائي:', finalBarcode);
    return finalBarcode;
  } catch (error) {
    console.error('❌ خطأ في توليد الباركود:', error);
    // إرجاع باركود افتراضي في حالة الخطأ
    const fallbackBarcode = `PRD${Date.now().toString().slice(-8)}${Math.random().toString(36).substring(2, 4).toUpperCase()}`;
    console.log('🆘 باركود احتياطي:', fallbackBarcode);
    return fallbackBarcode;
  }
};

/**
 * التحقق من صحة الباركود
 * @param {string} barcode - الباركود للتحقق منه
 * @returns {boolean} true إذا كان الباركود صالح
 */
export const validateBarcode = (barcode) => {
  if (!barcode || typeof barcode !== 'string') return false;
  
  // الباركود يجب أن يكون بين 8-20 حرف ويحتوي على أحرف وأرقام فقط
  const barcodeRegex = /^[A-Z0-9]{8,20}$/;
  return barcodeRegex.test(barcode);
};

/**
 * البحث عن منتج بالباركود
 * @param {string} barcode - الباركود للبحث عنه
 * @param {Array} products - قائمة المنتجات
 * @returns {Object|null} المنتج والمتغير إذا وُجد
 */
export const findProductByBarcode = (barcode, products) => {
  if (!barcode || !products || !Array.isArray(products)) return null;
  
  for (const product of products) {
    if (product.variants && Array.isArray(product.variants)) {
      for (const variant of product.variants) {
        if (variant.barcode === barcode) {
          return {
            product,
            variant,
            productId: product.id,
            variantId: variant.id
          };
        }
      }
    }
  }
  
  return null;
};

/**
 * استخراج معلومات من الباركود (إذا كان يتبع نمط معين)
 * @param {string} barcode - الباركود لاستخراج المعلومات منه
 * @returns {Object} معلومات مستخرجة من الباركود
 */
export const parseBarcode = (barcode) => {
  if (!validateBarcode(barcode)) {
    return {
      isValid: false,
      productCode: null,
      colorCode: null,
      sizeCode: null,
      timestamp: null
    };
  }
  
  try {
    // محاولة استخراج المعلومات بناءً على النمط المستخدم
    const productCode = barcode.substring(0, 3);
    const colorCode = barcode.substring(3, 5);
    const sizeCode = barcode.substring(5, 7);
    const timestamp = barcode.substring(7, 11);
    
    return {
      isValid: true,
      productCode,
      colorCode,
      sizeCode,
      timestamp,
      fullBarcode: barcode
    };
  } catch (error) {
    console.error('خطأ في تحليل الباركود:', error);
    return {
      isValid: false,
      productCode: null,
      colorCode: null,
      sizeCode: null,
      timestamp: null
    };
  }
};

/**
 * تنسيق الباركود للعرض
 * @param {string} barcode - الباركود للتنسيق
 * @returns {string} الباركود منسق للعرض
 */
export const formatBarcodeForDisplay = (barcode) => {
  if (!barcode) return 'غير محدد';
  
  // إضافة مسافات كل 4 أحرف لسهولة القراءة
  return barcode.replace(/(.{4})/g, '$1 ').trim();
};

/**
 * التحقق من فرادة الباركود في قائمة المنتجات
 * @param {string} barcode - الباركود للتحقق من فرادته
 * @param {Array} products - قائمة المنتجات الحالية
 * @param {string} excludeVariantId - معرف المتغير المستثنى (عند التحديث)
 * @returns {boolean} true إذا كان الباركود فريد
 */
export const isBarcodeUnique = (barcode, products, excludeVariantId = null) => {
  if (!barcode || !products || !Array.isArray(products)) return false;
  
  for (const product of products) {
    if (product.variants && Array.isArray(product.variants)) {
      for (const variant of product.variants) {
        if (variant.id !== excludeVariantId && variant.barcode === barcode) {
          return false; // الباركود موجود مسبقاً
        }
      }
    }
  }
  
  return true; // الباركود فريد
};