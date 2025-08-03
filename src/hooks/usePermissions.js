import { useUnifiedPermissionsSystem } from './useUnifiedPermissionsSystem.jsx';

/**
 * Hook موحد نهائي للصلاحيات - واجهة بسيطة للنظام الموحد
 * يعيد توجيه لنظام الصلاحيات الموحد الجديد
 */
export const usePermissions = () => {
  return useUnifiedPermissionsSystem();
};

export default usePermissions;