import { useMemo } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useEmployeeDeliveryAccounts } from '@/hooks/useEmployeeDeliveryAccounts';

/**
 * Hook لتحديد ما إذا كان المستخدم يمكنه رؤية الطلب ومزامنته
 */
export const useOrderVisibility = (order) => {
  const { user } = useAuth();
  const { hasActiveAccount, getEmployeeToken } = useEmployeeDeliveryAccounts();

  return useMemo(() => {
    if (!order || !user) {
      return {
        canView: false,
        canSync: false,
        canDelete: false,
        reason: 'المستخدم غير مسجل الدخول'
      };
    }

    const isManager = user.email === 'ryusbrand@gmail.com' || user.id === '91484496-b887-44f7-9e5d-be9db5567604';
    const isOwner = order.created_by === user.id;
    const hasEmployeeAccount = hasActiveAccount();
    const employeeToken = getEmployeeToken(order.created_by);

    // المدير
    if (isManager) {
      return {
        canView: true,
        canSync: true, // يمكن للمدير مزامنة جميع الطلبات
        canDelete: true,
        reason: 'مدير النظام',
        syncToken: getEmployeeToken(user.id) || employeeToken // يستخدم حسابه أو حساب صاحب الطلب
      };
    }

    // الموظف وطلبه الخاص
    if (isOwner) {
      return {
        canView: true,
        canSync: hasEmployeeAccount,
        canDelete: hasEmployeeAccount,
        reason: hasEmployeeAccount ? 'طلب المستخدم مع حساب متصل' : 'طلب المستخدم بدون حساب',
        syncToken: getEmployeeToken(user.id)
      };
    }

    // الموظف وطلب آخر
    return {
      canView: false,
      canSync: false,
      canDelete: false,
      reason: 'ليس طلب المستخدم',
      syncToken: null
    };
  }, [order, user, hasActiveAccount, getEmployeeToken]);
};

export default useOrderVisibility;