/**
 * تطبيع رقم الهاتف العراقي - إزالة الأصفار الزائدة والمسافات
 * @param {string} phone - رقم الهاتف الخام
 * @returns {string} - رقم الهاتف المطبع أو 'غير محدد'
 */
export const normalizePhone = (phone) => {
  if (!phone) return 'غير محدد';
  
  // إزالة المسافات والرموز الخاصة
  let cleaned = phone.toString().replace(/[\s\-\(\)\+]/g, '');
  
  // إزالة 964 إذا كان موجوداً
  if (cleaned.startsWith('964')) {
    cleaned = cleaned.substring(3);
  }
  
  // إزالة 0 من البداية إذا كان موجوداً
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // التأكد من أن الرقم 10 أو 11 خانة
  if (cleaned.length >= 10 && cleaned.length <= 11) {
    return cleaned;
  }
  
  return phone; // إرجاع الرقم الأصلي إذا لم يكن صالحاً
};

/**
 * تنسيق رقم الهاتف للعرض
 * @param {string} phone - رقم الهاتف
 * @returns {string} - رقم الهاتف منسق
 */
export const formatPhoneForDisplay = (phone) => {
  const normalized = normalizePhone(phone);
  if (normalized === 'غير محدد') return normalized;
  
  // إضافة صفر في البداية لأرقام العراق
  if (normalized.length === 10) {
    return '0' + normalized;
  }
  
  return normalized;
};

/**
 * تنسيق رقم الهاتف بالصيغة الدولية
 * @param {string} phone - رقم الهاتف
 * @returns {string} - رقم الهاتف بالصيغة الدولية
 */
export const formatPhoneInternational = (phone) => {
  const normalized = normalizePhone(phone);
  if (normalized === 'غير محدد') return normalized;
  
  return `+964${normalized}`;
};

/**
 * التحقق من صحة رقم الهاتف العراقي
 * @param {string} phone - رقم الهاتف
 * @returns {boolean} - هل الرقم صحيح أم لا
 */
export const isValidIraqiPhone = (phone) => {
  const normalized = normalizePhone(phone);
  return normalized !== 'غير محدد' && normalized.length >= 10 && normalized.length <= 11;
};

/**
 * استخراج أرقام الهواتف من النص
 * @param {string} text - النص المراد البحث فيه
 * @returns {Array} - مصفوفة بأرقام الهواتف الموجودة
 */
export const extractPhonesFromText = (text) => {
  if (!text) return [];
  
  // البحث عن أنماط أرقام الهواتف العراقية
  const phonePatterns = [
    /(?:\+964|964|0)?[0-9]{10,11}/g,
    /(?:هاتف|رقم|موبايل|جوال)\s*[:=]?\s*([0-9\s\-\+]{10,15})/gi
  ];
  
  const foundPhones = [];
  
  phonePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const normalized = normalizePhone(match);
        if (isValidIraqiPhone(normalized) && !foundPhones.includes(normalized)) {
          foundPhones.push(normalized);
        }
      });
    }
  });
  
  return foundPhones;
};