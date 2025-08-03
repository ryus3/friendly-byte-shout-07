import { useUnifiedPermissionsSystem } from './useUnifiedPermissionsSystem';

/**
 * Hook موحد نهائي للصلاحيات - واجهة بسيطة للنظام الموحد
 * يعيد توجيه لنظام الصلاحيات الموحد الجديد
 */
export const usePermissions = () => {
  return useUnifiedPermissionsSystem();
};

export default usePermissions;