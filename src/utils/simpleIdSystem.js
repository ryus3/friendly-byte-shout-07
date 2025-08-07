/**
 * نظام معرفات بسيط وموحد
 * يحل مشكلة UUID المعقد ويجعل النظام أبسط وأسرع
 */

/**
 * إنشاء معرف موظف تلقائي (EMP001, EMP002, ...)
 * @returns {Promise<string>} - معرف الموظف الجديد
 */
export const generateEmployeeCode = async () => {
  const { supabase } = await import('@/lib/customSupabaseClient');
  
  try {
    // الحصول على آخر رقم موظف
    const { data, error } = await supabase
      .from('profiles')
      .select('employee_code')
      .like('employee_code', 'EMP%')
      .order('employee_code', { ascending: false })
      .limit(1);
    
    if (error) throw error;
    
    let nextNumber = 1;
    
    if (data && data.length > 0) {
      const lastCode = data[0].employee_code;
      const lastNumber = parseInt(lastCode.replace('EMP', ''));
      nextNumber = lastNumber + 1;
    }
    
    // تنسيق الرقم (EMP001, EMP002, ...)
    return `EMP${nextNumber.toString().padStart(3, '0')}`;
    
  } catch (error) {
    console.error('خطأ في إنشاء معرف الموظف:', error);
    // fallback إلى تاريخ مع رقم عشوائي
    const timestamp = Date.now().toString().slice(-4);
    return `EMP${timestamp}`;
  }
};

/**
 * الحصول على معرف الموظف الموحد (أولوية للـ employee_code)
 * @param {Object} user - كائن المستخدم
 * @returns {string|null} - معرف الموظف
 */
export const getSimpleEmployeeId = (user) => {
  if (!user) return null;
  
  // الأولوية للـ employee_code البسيط
  if (user.employee_code) {
    return user.employee_code;
  }
  
  // fallback للـ UUID (مؤقت حتى التحديث)
  return user.user_id || user.id || null;
};

/**
 * التحقق من أن المعرف هو employee_code وليس UUID
 * @param {string} id - المعرف المراد فحصه
 * @returns {boolean} - هل هو employee_code بسيط
 */
export const isSimpleEmployeeCode = (id) => {
  if (!id || typeof id !== 'string') return false;
  
  // employee_code يبدأ بـ EMP ويتبعه أرقام
  return /^EMP\d{3,}$/.test(id);
};

/**
 * تحويل UUID إلى employee_code إذا أمكن
 * @param {string} userId - معرف المستخدم (UUID أو employee_code)
 * @returns {Promise<string|null>} - employee_code أو null
 */
export const convertToEmployeeCode = async (userId) => {
  if (!userId) return null;
  
  // إذا كان employee_code بالفعل، إرجعه كما هو
  if (isSimpleEmployeeCode(userId)) {
    return userId;
  }
  
  // إذا كان UUID، ابحث عن employee_code المطابق
  try {
    const { supabase } = await import('@/lib/customSupabaseClient');
    
    const { data, error } = await supabase
      .from('profiles')
      .select('employee_code')
      .eq('user_id', userId)
      .single();
    
    if (!error && data?.employee_code) {
      return data.employee_code;
    }
    
  } catch (error) {
    console.warn('لا يمكن تحويل UUID إلى employee_code:', error);
  }
  
  return null;
};

/**
 * إنشاء فلتر موحد باستخدام employee_code
 * @param {Object} user - كائن المستخدم
 * @param {boolean} isAdmin - هل المستخدم مدير
 * @param {string} columnName - اسم العمود (created_by, employee_id, ...)
 * @returns {Object} - كائن الفلترة
 */
export const createSimpleFilter = (user, isAdmin = false, columnName = 'created_by') => {
  // المدير يرى كل شيء
  if (isAdmin) return {};
  
  const employeeId = getSimpleEmployeeId(user);
  if (!employeeId) return { [columnName]: 'NO_USER' }; // لن يجد أي شيء
  
  return { [columnName]: employeeId };
};

/**
 * تحديث جميع الجداول لاستخدام employee_code بدلاً من UUID
 * @param {Object} user - المستخدم الحالي
 */
export const migrateToSimpleIds = async (user) => {
  if (!user?.employee_code || !user?.user_id) {
    console.warn('لا يمكن التحديث: بيانات المستخدم ناقصة');
    return;
  }
  
  const { supabase } = await import('@/lib/customSupabaseClient');
  const { employee_code, user_id } = user;
  
  console.log(`🔄 تحديث جميع السجلات من UUID إلى employee_code: ${employee_code}`);
  
  try {
    // تحديث الطلبات
    await supabase
      .from('orders')
      .update({ created_by: employee_code })
      .eq('created_by', user_id);
    
    // تحديث المنتجات
    await supabase
      .from('products')
      .update({ created_by: employee_code })
      .eq('created_by', user_id);
    
    // تحديث الأرباح
    await supabase
      .from('profits')
      .update({ employee_id: employee_code })
      .eq('employee_id', user_id);
    
    // تحديث المشتريات
    await supabase
      .from('purchases')
      .update({ created_by: employee_code })
      .eq('created_by', user_id);
    
    // تحديث الإشعارات
    await supabase
      .from('notifications')
      .update({ user_id: employee_code })
      .eq('user_id', user_id);
    
    console.log(`✅ تم تحديث جميع السجلات إلى employee_code: ${employee_code}`);
    
  } catch (error) {
    console.error('❌ خطأ في تحديث السجلات:', error);
  }
};

/**
 * فحص ما إذا كان النظام يحتاج تحديث للمعرفات البسيطة
 * @param {Object} user - المستخدم الحالي
 * @returns {Promise<boolean>} - هل يحتاج تحديث
 */
export const needsSimpleIdMigration = async (user) => {
  if (!user?.employee_code || !user?.user_id) return false;
  
  try {
    const { supabase } = await import('@/lib/customSupabaseClient');
    
    // فحص إذا كانت هناك سجلات تستخدم UUID بدلاً من employee_code
    const { data: ordersWithUUID } = await supabase
      .from('orders')
      .select('id')
      .eq('created_by', user.user_id)
      .limit(1);
    
    return ordersWithUUID && ordersWithUUID.length > 0;
    
  } catch (error) {
    return false;
  }
};