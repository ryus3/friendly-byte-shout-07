/**
 * Hook موحد لإدارة بيانات المستخدم
 * يحل مشكلة التناقضات في معرفات المستخدمين
 */

import { useMemo } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { 
  getUserUUID, 
  getEmployeeCode, 
  createUserFilter, 
  createProfitFilter,
  createSettlementInvoiceFilter,
  logUserIdInconsistency
} from '@/utils/userIdUtils';

export const useUnifiedUserData = () => {
  const { user } = useAuth();
  const { isAdmin, hasPermission } = usePermissions();

  // تسجيل أي تناقضات في المعرفات
  useMemo(() => {
    if (user) {
      logUserIdInconsistency(user);
    }
  }, [user]);

  // معرف المستخدم الموحد
  const userUUID = useMemo(() => getUserUUID(user), [user]);
  
  // معرف الموظف
  const employeeCode = useMemo(() => getEmployeeCode(user), [user]);

  // فلاتر البيانات الموحدة
  const dataFilters = useMemo(() => ({
    // فلتر عام للطلبات والمنتجات
    general: createUserFilter(user, isAdmin),
    
    // فلتر خاص بالأرباح
    profits: createProfitFilter(user, isAdmin),
    
    // فلتر فواتير التسوية
    settlements: user ? createSettlementInvoiceFilter(user) : {}
  }), [user, isAdmin]);

  // بيانات المستخدم المنظمة
  const userData = useMemo(() => {
    if (!user) return null;
    
    return {
      uuid: userUUID,
      employeeCode,
      fullName: user.full_name,
      username: user.username,
      email: user.email,
      isAdmin,
      isActive: user.is_active
    };
  }, [user, userUUID, employeeCode, isAdmin]);

  // دوال مساعدة للاستعلامات
  const queryHelpers = useMemo(() => ({
    // تحديد ما إذا كان المستخدم يستطيع رؤية البيانات
    canViewData: (dataCreatedBy) => {
      if (isAdmin) return true;
      return dataCreatedBy === userUUID;
    },
    
    // تحديد ما إذا كان المستخدم يستطيع تعديل البيانات
    canEditData: (dataCreatedBy) => {
      if (isAdmin) return true;
      return dataCreatedBy === userUUID;
    },
    
    // إنشاء شروط قاعدة البيانات للطلبات
    getOrdersQuery: () => {
      if (isAdmin) return {};
      return { created_by: userUUID };
    },
    
    // إنشاء شروط قاعدة البيانات للأرباح
    getProfitsQuery: () => {
      if (isAdmin) return {};
      return { employee_id: userUUID };
    }
  }), [isAdmin, userUUID]);

  return {
    // بيانات المستخدم
    user: userData,
    userUUID,
    employeeCode,
    isAdmin,
    
    // فلاتر البيانات
    filters: dataFilters,
    
    // دوال مساعدة
    ...queryHelpers,
    
    // حالة المستخدم
    isLoggedIn: !!user,
    hasValidUUID: !!userUUID
  };
};