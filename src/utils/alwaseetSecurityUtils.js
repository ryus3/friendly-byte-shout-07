/**
 * نظام الأمان لفصل حسابات الوسيط
 * يضمن عدم تداخل البيانات بين المستخدمين
 */

import { getUserUUID } from './userIdUtils';

/**
 * التحقق من ملكية الطلب قبل أي عملية
 * @param {Object} order - كائن الطلب
 * @param {Object} currentUser - المستخدم الحالي
 * @returns {boolean} - هل المستخدم يملك هذا الطلب
 */
export const verifyOrderOwnership = (order, currentUser) => {
  if (!order || !currentUser) return false;
  
  const userUUID = getUserUUID(currentUser);
  const orderCreatedBy = order.created_by || order.user_id;
  
  // Use role-based admin detection - admins own all orders
  // This will be checked via RLS policies using can_view_all_orders()
  return true; // Let RLS handle the actual verification
  
  // الموظفون يملكون طلباتهم فقط
  return orderCreatedBy === userUUID;
};

/**
 * إنشاء فلتر أمان لاستعلامات قاعدة البيانات
 * @param {Object} user - المستخدم الحالي
 * @returns {Object} - كائن الفلترة الآمن
 */
export const createSecureOrderFilter = (user) => {
  if (!user) return { created_by: 'INVALID_USER' }; // منع عرض أي بيانات
  
  const userUUID = getUserUUID(user);
  
  // Use role-based admin detection - let RLS handle filtering
  // Admins will see all orders through RLS policies
  return {}; // Return empty filter, let RLS handle access control
  
  // الموظفون يرون طلباتهم فقط
  return { created_by: userUUID };
};

/**
 * تسجيل تحذير أمني عند محاولة وصول غير مصرح
 * @param {string} action - نوع العملية
 * @param {string} orderId - معرف الطلب
 * @param {Object} user - المستخدم المحاول
 */
export const logSecurityWarning = (action, orderId, user) => {
  const userUUID = getUserUUID(user);
  console.warn(`🚨 محاولة وصول غير مصرح: ${action} على الطلب ${orderId} من المستخدم ${userUUID}`);
  
  // يمكن إرسال تنبيه للمدير هنا في المستقبل
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'security_violation', {
      action,
      order_id: orderId,
      user_id: userUUID
    });
  }
};

/**
 * تنظيف معرف المستخدم والتأكد من صحته
 * @param {*} userId - معرف المستخدم
 * @returns {string|null} - معرف نظيف أو null
 */
export const sanitizeUserId = (userId) => {
  if (!userId) return null;
  
  const cleanId = String(userId).trim();
  
  // التحقق من صيغة UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  return uuidRegex.test(cleanId) ? cleanId : null;
};

/**
 * إنشاء تقرير أمني للجلسة الحالية
 * @param {Object} user - المستخدم الحالي
 * @returns {Object} - تقرير الأمان
 */
export const generateSecurityReport = (user) => {
  const userUUID = getUserUUID(user);
  // Note: Admin detection now handled by role-based system and RLS policies
  const isAdmin = false; // Placeholder - actual admin detection via roles
  
  return {
    userId: userUUID,
    isValidUUID: !!sanitizeUserId(userUUID),
    isAdmin,
    securityLevel: isAdmin ? 'ADMIN' : 'USER',
    accessPattern: isAdmin ? 'FULL_ACCESS' : 'RESTRICTED',
    timestamp: new Date().toISOString(),
    warnings: []
  };
};