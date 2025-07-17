/**
 * @deprecated استخدم useCleanPermissions بدلاً من هذا
 * هذا الملف محفوظ للتوافق فقط - سيتم إزالته قريباً
 */
import useCleanPermissions from './useCleanPermissions';

export const usePermissionBasedData = () => {
  console.warn('usePermissionBasedData is deprecated. Please use useCleanPermissions instead.');
  return useCleanPermissions();
};

export default usePermissionBasedData;