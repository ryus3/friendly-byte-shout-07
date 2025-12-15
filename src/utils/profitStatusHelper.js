/**
 * دالة مساعدة لتحديد حالة الربح وخصائصه
 * @param {string} profitStatus - حالة الربح من قاعدة البيانات
 * @returns {object} معلومات الحالة مع النص والنوع المناسب للعرض
 */
export const getStatusInfo = (profitStatus) => {
  const status = profitStatus || 'pending';
  
  switch (status) {
    case 'pending':
      return {
        text: 'بانتظار الفاتورة',
        variant: 'warning',
        canSelect: false // لا يمكن المحاسبة حتى تُستلم الفاتورة
      };
    case 'invoice_received':
      return {
        text: 'جاهز للمحاسبة',
        variant: 'success',
        canSelect: true
      };
    case 'settlement_requested':
      return {
        text: 'تم طلب تحاسب',
        variant: 'settlement',
        canSelect: true
      };
    case 'settled':
      return {
        text: 'مدفوع',
        variant: 'success',
        canSelect: false
      };
    case 'no_rule_settled':
      return {
        text: 'بدون ربح',
        variant: 'muted',
        canSelect: false // لا يمكن التحديد للتحاسب لأنه لا يوجد ربح
      };
    default:
      return {
        text: 'معلق',
        variant: 'warning',
        canSelect: true
      };
  }
};

/**
 * فحص إمكانية طلب التحاسب للطلب
 * @param {string} profitStatus - حالة الربح
 * @returns {boolean} true إذا كان يمكن طلب التحاسب
 */
export const canRequestSettlement = (profitStatus) => {
  const status = profitStatus || 'pending';
  return ['pending', 'invoice_received', 'settlement_requested'].includes(status);
};

/**
 * فحص ما إذا كانت الحالة معلقة (تحتاج تحاسب)
 * @param {string} profitStatus - حالة الربح
 * @returns {boolean} true إذا كانت الحالة معلقة
 */
export const isPendingStatus = (profitStatus) => {
  const status = profitStatus || 'pending';
  return ['pending', 'invoice_received', 'settlement_requested'].includes(status);
};