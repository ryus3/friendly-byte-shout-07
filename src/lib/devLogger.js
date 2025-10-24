// Development Logger - Only logs in development mode
// ⚡ تم تحسينه للأداء - تعطيل كامل في Production
const isDev = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

// في Production: تعطيل كامل لجميع الـ logs (إلا الأخطاء الحرجة)
const noOp = () => {};

export const devLog = {
  log: isDev ? console.log.bind(console) : noOp,
  info: isDev ? console.info.bind(console) : noOp,
  warn: isDev ? console.warn.bind(console) : noOp,
  error: console.error.bind(console), // الأخطاء دائماً مهمة
};

// ⚡ إضافة دالة لتعطيل console.log مباشرة في Production
if (isProduction) {
  // تعطيل console.log/info/warn في Production بالكامل
  const nativeConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn
  };
  
  console.log = noOp;
  console.info = noOp;
  console.warn = noOp;
  
  // حفظ النسخة الأصلية للاستخدام الطارئ
  console._native = nativeConsole;
}

// Export as default for convenience
export default devLog;
