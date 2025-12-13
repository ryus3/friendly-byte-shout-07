/**
 * 🚀 Clean Console - تعطيل console.log في Production
 * يُفعّل تلقائياً في بيئة الإنتاج لتحسين الأداء
 */

const isProduction = import.meta.env.PROD;

// حفظ النسخة الأصلية
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  debug: console.debug,
  trace: console.trace,
};

// دالة فارغة للاستبدال
const noop = () => {};

/**
 * تفعيل تنظيف الكونسول في Production
 */
export const enableCleanConsole = () => {
  if (isProduction) {
    console.log = noop;
    console.info = noop;
    console.warn = noop;
    console.debug = noop;
    console.trace = noop;
    // نحتفظ بـ console.error للأخطاء الحرجة
  }
};

/**
 * استعادة الكونسول الأصلي (للتطوير فقط)
 */
export const restoreConsole = () => {
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.debug = originalConsole.debug;
  console.trace = originalConsole.trace;
};

// تفعيل تلقائي عند الاستيراد
enableCleanConsole();

export default { enableCleanConsole, restoreConsole };
