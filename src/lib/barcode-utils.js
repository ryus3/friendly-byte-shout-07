/**
 * مكتبة شاملة لإدارة الباركود في النظام
 * تدعم جميع أنواع المنتجات: ملابس، أحذية، فري سايز، مواد عامة
 */

/**
 * تحديد نوع المنتج بناءً على الخصائص
 */
export const detectProductType = (colorName, sizeName, departmentName = '') => {
  const dept = (departmentName || '').toLowerCase();
  const color = (colorName || '').toLowerCase();
  const size = (sizeName || '').toLowerCase();
  
  // فري سايز
  if (size.includes('فري') || size.includes('free') || size === 'onesize' || size === 'os') {
    return 'freesize';
  }
  
  // مواد عامة (بدون لون وقياس)
  if ((!color || color === 'default' || color === 'بدون') && 
      (!size || size === 'default' || size === 'بدون')) {
    return 'general';
  }
  
  // أحذية
  if (dept.includes('حذاء') || dept.includes('أحذية') || dept.includes('shoes') || 
      size.match(/^\d+(\.\d+)?$/) || // أرقام القياسات
      ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45'].includes(size)) {
    return 'shoes';
  }
  
  // ملابس (الافتراضي)
  return 'clothing';
};

/**
 * توليد باركود ذكي حسب نوع المنتج
 */
export const generateSmartBarcode = (productName, colorName = 'DEFAULT', sizeName = 'DEFAULT', productId = null, departmentName = '') => {
  try {
    const productType = detectProductType(colorName, sizeName, departmentName);
    
    // تنظيف النصوص
    const cleanString = (str, maxLength = 3) => {
      if (!str || typeof str !== 'string' || str.toLowerCase() === 'default' || str.toLowerCase() === 'بدون') return '';
      const cleaned = str.replace(/\s+/g, '').replace(/[^\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z0-9]/g, '');
      return cleaned.length > 0 ? cleaned.substring(0, maxLength).toUpperCase() : '';
    };
    
    // بناء الباركود حسب النوع
    let barcode = '';
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.random().toString(36).substring(2, 3).toUpperCase();
    
    switch (productType) {
      case 'freesize':
        // فري سايز: اسم المنتج + لون + FS + وقت
        barcode = `${cleanString(productName, 4)}${cleanString(colorName, 2)}FS${timestamp}${random}`;
        break;
        
      case 'general':
        // مواد عامة: اسم المنتج + GEN + وقت + رقم عشوائي أكبر
        barcode = `${cleanString(productName, 6)}GEN${timestamp}${Math.random().toString(36).substring(2, 4).toUpperCase()}`;
        break;
        
      case 'shoes':
        // أحذية: اسم المنتج + لون + قياس + SH + وقت
        barcode = `${cleanString(productName, 3)}${cleanString(colorName, 2)}${cleanString(sizeName, 2)}SH${timestamp}${random}`;
        break;
        
      case 'clothing':
      default:
        // ملابس: النمط التقليدي
        barcode = `${cleanString(productName, 3)}${cleanString(colorName, 2)}${cleanString(sizeName, 2)}CL${timestamp}${random}`;
        break;
    }
    
    // تأمين حد أدنى من الطول والمحتوى
    if (barcode.length < 8) {
      const productCode = cleanString(productName, 4) || 'PROD';
      barcode = `${productCode}${timestamp}${Math.random().toString(36).substring(2, 3).toUpperCase()}`;
    }
    
    // التأكد من أن الباركود لا يتجاوز 20 حرف
    const finalBarcode = barcode.length > 20 ? barcode.substring(0, 20) : barcode;
    
    return finalBarcode;
  } catch (error) {
    return generateFallbackBarcode(productName);
  }
};

/**
 * باركود احتياطي في حالة الفشل
 */
const generateFallbackBarcode = (productName) => {
  const cleanName = (productName || 'PRODUCT').replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase() || 'PROD';
  return `${cleanName}${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 2).toUpperCase()}`;
};

/**
 * الدالة المحسنة لتوليد باركود فريد (متوافقة مع الكود القديم)
 */
export const generateUniqueBarcode = (productName, colorName, sizeName, productId = null, departmentName = '') => {
  return generateSmartBarcode(productName, colorName, sizeName, productId, departmentName);
};

/**
 * التحقق من صحة الباركود
 */
export const validateBarcode = (barcode) => {
  if (!barcode || typeof barcode !== 'string') return false;
  
  // الباركود يجب أن يكون بين 8-20 حرف ويحتوي على أحرف وأرقام فقط
  const barcodeRegex = /^[A-Z0-9]{8,20}$/;
  return barcodeRegex.test(barcode);
};

/**
 * البحث عن منتج بالباركود
 */
export const findProductByBarcode = (barcode, products) => {
  if (!barcode || !products || !Array.isArray(products)) return null;
  
  // البحث في باركود المنتج الرئيسي
  for (const product of products) {
    if (product.barcode === barcode) {
      return {
        product,
        variant: null,
        productId: product.id,
        variantId: null,
        type: 'product'
      };
    }
    
    // البحث في باركود المتغيرات
    if (product.variants && Array.isArray(product.variants)) {
      for (const variant of product.variants) {
        if (variant.barcode === barcode) {
          return {
            product,
            variant,
            productId: product.id,
            variantId: variant.id,
            type: 'variant'
          };
        }
      }
    }
  }
  
  return null;
};

/**
 * تحليل نوع الباركود
 */
export const analyzeBarcodeType = (barcode) => {
  if (!validateBarcode(barcode)) {
    return { isValid: false, type: 'unknown' };
  }
  
  if (barcode.includes('FS')) return { isValid: true, type: 'freesize' };
  if (barcode.includes('GEN')) return { isValid: true, type: 'general' };
  if (barcode.includes('SH')) return { isValid: true, type: 'shoes' };
  if (barcode.includes('CL')) return { isValid: true, type: 'clothing' };
  
  return { isValid: true, type: 'unknown' };
};

/**
 * تنسيق الباركود للعرض
 */
export const formatBarcodeForDisplay = (barcode) => {
  if (!barcode) return 'غير محدد';
  
  // إضافة مسافات كل 4 أحرف لسهولة القراءة
  return barcode.replace(/(.{4})/g, '$1 ').trim();
};

/**
 * التحقق من فرادة الباركود
 */
export const isBarcodeUnique = (barcode, products, excludeVariantId = null, excludeProductId = null) => {
  if (!barcode || !products || !Array.isArray(products)) return false;
  
  for (const product of products) {
    // فحص باركود المنتج الرئيسي
    if (product.id !== excludeProductId && product.barcode === barcode) {
      return false;
    }
    
    // فحص باركود المتغيرات
    if (product.variants && Array.isArray(product.variants)) {
      for (const variant of product.variants) {
        if (variant.id !== excludeVariantId && variant.barcode === barcode) {
          return false;
        }
      }
    }
  }
  
  return true;
};

/**
 * اقتراح باركود بديل إذا كان مكرراً
 */
export const suggestAlternativeBarcode = (originalBarcode, products) => {
  if (isBarcodeUnique(originalBarcode, products)) {
    return originalBarcode;
  }
  
  let counter = 1;
  let alternativeBarcode;
  
  do {
    // إضافة رقم متسلسل في النهاية
    const suffix = counter.toString().padStart(2, '0');
    alternativeBarcode = originalBarcode.substring(0, 18) + suffix;
    counter++;
  } while (!isBarcodeUnique(alternativeBarcode, products) && counter < 100);
  
  return alternativeBarcode;
};
