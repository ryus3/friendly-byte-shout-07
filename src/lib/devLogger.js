// ⚡ Development Logger - Maximum Performance Optimized
// تعطيل كامل في Production مع أداء أقصى

const isProduction = import.meta.env.PROD;

// ⚡ No-op functions for production - inline for maximum speed
const noOp = () => {};
const noOpWithReturn = () => undefined;

// ⚡ Optimized devLog object
export const devLog = isProduction ? {
  log: noOp,
  info: noOp,
  warn: noOp,
  error: console.error.bind(console), // الأخطاء الحرجة فقط
  debug: noOp,
  table: noOp,
  group: noOp,
  groupEnd: noOp,
  time: noOp,
  timeEnd: noOp,
} : {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug?.bind(console) || console.log.bind(console),
  table: console.table?.bind(console) || noOp,
  group: console.group?.bind(console) || noOp,
  groupEnd: console.groupEnd?.bind(console) || noOp,
  time: console.time?.bind(console) || noOp,
  timeEnd: console.timeEnd?.bind(console) || noOp,
};

// ⚡ Override native console in production IMMEDIATELY
if (isProduction) {
  // حفظ النسخة الأصلية للطوارئ فقط
  const _nativeError = console.error;
  
  // تعطيل كامل لجميع الـ console methods
  console.log = noOp;
  console.info = noOp;
  console.warn = noOp;
  console.debug = noOp;
  console.table = noOp;
  console.group = noOp;
  console.groupEnd = noOp;
  console.time = noOp;
  console.timeEnd = noOp;
  console.trace = noOp;
  console.dir = noOp;
  console.dirxml = noOp;
  console.count = noOp;
  console.countReset = noOp;
  console.assert = noOp;
  console.profile = noOp;
  console.profileEnd = noOp;
  
  // الإبقاء على error فقط للأخطاء الحرجة
  console.error = _nativeError;
  
  // للاستخدام الطارئ فقط
  console._native = { error: _nativeError };
}

export default devLog;
