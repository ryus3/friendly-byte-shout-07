import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

/**
 * فحص صحة التاريخ
 * @param {any} date - التاريخ المراد فحصه
 * @returns {boolean} - صحيح إذا كان التاريخ صالحاً
 */
export const isValidDate = (date) => {
  if (!date) return false;
  const dateObj = new Date(date);
  return !isNaN(dateObj.getTime());
};

/**
 * تنسيق التاريخ بشكل آمن
 * @param {any} date - التاريخ المراد تنسيقه
 * @param {string} formatString - صيغة التنسيق
 * @param {object} options - خيارات إضافية
 * @returns {string} - التاريخ المنسق أو "غير محدد"
 */
export const safeFormatDate = (date, formatString = 'dd/MM/yyyy', options = { locale: ar }) => {
  if (!isValidDate(date)) {
    return 'غير محدد';
  }
  
  try {
    return format(new Date(date), formatString, options);
  } catch (error) {
    console.warn('خطأ في تنسيق التاريخ:', { date, formatString, error });
    return 'غير محدد';
  }
};

/**
 * إنشاء كائن تاريخ آمن
 * @param {any} date - التاريخ المراد إنشاؤه
 * @returns {Date|null} - كائن التاريخ أو null إذا كان غير صالح
 */
export const safeCreateDate = (date) => {
  if (!date) return null;
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    console.warn('تاريخ غير صالح:', date);
    return null;
  }
  
  return dateObj;
};

/**
 * مقارنة التواريخ بشكل آمن
 * @param {any} date1 - التاريخ الأول
 * @param {any} date2 - التاريخ الثاني
 * @returns {number} - نتيجة المقارنة (-1, 0, 1) أو null إذا كان أحد التواريخ غير صالح
 */
export const safeCompareDates = (date1, date2) => {
  const d1 = safeCreateDate(date1);
  const d2 = safeCreateDate(date2);
  
  if (!d1 || !d2) return null;
  
  if (d1 < d2) return -1;
  if (d1 > d2) return 1;
  return 0;
};

/**
 * فحص ما إذا كان التاريخ ضمن نطاق معين
 * @param {any} date - التاريخ المراد فحصه
 * @param {any} startDate - تاريخ البداية
 * @param {any} endDate - تاريخ النهاية
 * @returns {boolean} - صحيح إذا كان ضمن النطاق
 */
export const isDateWithinRange = (date, startDate, endDate) => {
  const dateObj = safeCreateDate(date);
  const startObj = safeCreateDate(startDate);
  const endObj = safeCreateDate(endDate);
  
  if (!dateObj || !startObj || !endObj) return false;
  
  return dateObj >= startObj && dateObj <= endObj;
};