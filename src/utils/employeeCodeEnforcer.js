import devLog from '@/lib/devLogger';
/**
 * نظام إجبار استخدام employee_code في كل مكان
 * يمنع استخدام UUID ويوجه لاستخدام employee_code
 */

// قائمة الحقول المحظورة
const FORBIDDEN_ID_FIELDS = [
  'user.id',
  'user.user_id', 
  'currentUser.id',
  'currentUser.user_id'
];

// قائمة الحقول المسموحة
const ALLOWED_ID_FIELDS = [
  'user.employee_code',
  'currentUser.employee_code',
  'employee_code'
];

/**
 * التحقق من صحة استخدام معرف المستخدم
 */
export const validateUserIdUsage = (codeString) => {
  const violations = [];
  
  // البحث عن الاستخدامات المحظورة
  FORBIDDEN_ID_FIELDS.forEach(forbiddenField => {
    if (codeString.includes(forbiddenField)) {
      violations.push({
        type: 'forbidden_id_usage',
        field: forbiddenField,
        message: `🚫 استخدام ${forbiddenField} محظور! استخدم user.employee_code بدلاً منه`,
        suggestion: forbiddenField.replace('.id', '.employee_code').replace('.user_id', '.employee_code')
      });
    }
  });
  
  return violations;
};

/**
 * تحويل تلقائي من UUID إلى employee_code
 */
export const convertToEmployeeCode = (user) => {
  if (!user) return null;
  
  // إذا كان employee_code موجود، استخدمه
  if (user.employee_code) {
    return user.employee_code;
  }
  
  // إذا لم يكن موجود، عرض تحذير وإرجاع null
  console.error('🚫 المستخدم بدون employee_code:', {
    id: user.id,
    user_id: user.user_id,
    full_name: user.full_name,
    message: 'يجب إضافة employee_code لهذا المستخدم'
  });
  
  return null;
};

/**
 * إنشاء فلتر موحد - إصلاح مؤقت لاستخدام UUID
 */
export const createEmployeeCodeFilter = (user, isAdmin = false, fieldName = 'created_by') => {
  // المديرون يرون كل شيء
  if (isAdmin) {
    return {};
  }
  
  // إصلاح مؤقت: استخدام UUID حتى يتم تحديث قاعدة البيانات
  const userUUID = user?.user_id || user?.id;
  const employeeCode = user?.employee_code;
  
  if (!userUUID) {
    console.error('🚫 فشل في إنشاء فلتر - المستخدم بدون معرف صحيح');
    return { [fieldName]: 'INVALID_USER' }; // فلتر لن يجد أي نتائج
  }
  
  devLog.log('🔧 إنشاء فلتر مؤقت باستخدام UUID:', userUUID);
  
  return { [fieldName]: userUUID };
};

/**
 * فحص البيانات للتأكد من استخدام employee_code
 */
export const validateDataConsistency = (data, tableName) => {
  if (!data || !Array.isArray(data)) return [];
  
  const issues = [];
  
  data.forEach((item, index) => {
    // فحص الحقول المطلوبة
    if (tableName === 'orders' && !item.created_by?.startsWith('EMP')) {
      issues.push({
        table: tableName,
        index,
        issue: 'created_by غير صحيح',
        current: item.created_by,
        expected: 'EMP001 (employee_code format)'
      });
    }
    
    if (tableName === 'profits' && !item.employee_id?.startsWith('EMP')) {
      issues.push({
        table: tableName,
        index,
        issue: 'employee_id غير صحيح',
        current: item.employee_id,
        expected: 'EMP001 (employee_code format)'
      });
    }
  });
  
  return issues;
};

/**
 * تطبيق نظام employee_code على البيانات
 */
export const enforceEmployeeCodeSystem = () => {
  // منع استخدام الحقول المحظورة
  const originalConsoleError = console.error;
  
  // اعتراض محاولات استخدام UUID
  window.addEventListener('error', (event) => {
    if (event.message?.includes('user.id') || event.message?.includes('user.user_id')) {
      console.error('🚫 Employee Code Enforcer: محاولة استخدام UUID محظورة!');
      console.error('✅ استخدم user.employee_code بدلاً من ذلك');
    }
  });
  
  devLog.log('✅ Employee Code Enforcer: تم تفعيل نظام إجبار employee_code');
};

export default {
  validateUserIdUsage,
  convertToEmployeeCode,
  createEmployeeCodeFilter,
  validateDataConsistency,
  enforceEmployeeCodeSystem
};