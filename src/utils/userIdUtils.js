/**
 * مساعد موحد لمعالجة معرفات المستخدمين
 * يحل مشكلة التناقض بين user.id و user.user_id
 */

/**
 * الحصول على UUID الموحد للمستخدم
 * @param {Object} user - كائن المستخدم
 * @returns {string|null} - UUID المستخدم الموحد
 */
export const getUserUUID = (user) => {
  if (!user) return null;
  
  // الأولوية للـ user_id (UUID من Supabase Auth)
  return user.user_id || user.id || null;
};

/**
 * الحصول على employee_code للمستخدم
 * @param {Object} user - كائن المستخدم
 * @returns {string|null} - معرف الموظف الصغير
 */
export const getEmployeeCode = (user) => {
  if (!user) return null;
  return user.employee_code || null;
};

/**
 * التحقق من صحة UUID
 * @param {string} uuid - المعرف المراد فحصه
 * @returns {boolean} - هل هو UUID صحيح
 */
export const isValidUUID = (uuid) => {
  if (!uuid || typeof uuid !== 'string') return false;
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * إنشاء كائن فلترة موحد للمستخدم
 * @param {Object} user - كائن المستخدم
 * @param {boolean} isAdmin - هل المستخدم مدير
 * @returns {Object} - كائن الفلترة
 */
export const createUserFilter = (user, isAdmin = false) => {
  const userUUID = getUserUUID(user);
  
  // المدير يرى كل شيء
  if (isAdmin) return {};
  
  // الموظف يرى بياناته فقط
  return userUUID ? { created_by: userUUID } : {};
};

/**
 * إنشاء كائن فلترة للأرباح
 * @param {Object} user - كائن المستخدم
 * @param {boolean} isAdmin - هل المستخدم مدير
 * @returns {Object} - كائن فلترة الأرباح
 */
export const createProfitFilter = (user, isAdmin = false) => {
  const userUUID = getUserUUID(user);
  
  // المدير يرى كل شيء
  if (isAdmin) return {};
  
  // الموظف يرى أرباحه فقط
  return userUUID ? { employee_id: userUUID } : {};
};

/**
 * إنشاء بيانات موحدة للإدراج في قاعدة البيانات
 * @param {Object} user - كائن المستخدم
 * @returns {Object} - بيانات المستخدم الموحدة
 */
export const createUserInsertData = (user) => {
  const userUUID = getUserUUID(user);
  
  if (!userUUID) {
    throw new Error('معرف المستخدم غير صحيح');
  }
  
  return {
    created_by: userUUID,
    user_id: userUUID
  };
};

/**
 * البحث في فواتير التسوية - يفضل employee_code ثم employee_id
 * @param {Object} user - كائن المستخدم
 * @returns {Object} - شروط البحث
 */
export const createSettlementInvoiceFilter = (user) => {
  const employeeCode = getEmployeeCode(user);
  const userUUID = getUserUUID(user);
  
  // أولوية للبحث بـ employee_code إذا كان متوفر
  if (employeeCode) {
    return { employee_code: employeeCode };
  }
  
  // البحث بـ UUID كبديل
  if (userUUID) {
    return { employee_id: userUUID };
  }
  
  throw new Error('لا يوجد معرف صحيح للموظف');
};

/**
 * تسجيل تحذير عند وجود تناقض في المعرفات
 * @param {Object} user - كائن المستخدم
 */
export const logUserIdInconsistency = (user) => {
  if (!user) return;
  
  const hasUserId = !!user.user_id;
  const hasId = !!user.id;
  const areEqual = user.user_id === user.id;
  
  if (hasUserId && hasId && !areEqual) {
    console.warn('⚠️ تناقض في معرفات المستخدم:', {
      user_id: user.user_id,
      id: user.id,
      full_name: user.full_name,
      username: user.username
    });
  }
};