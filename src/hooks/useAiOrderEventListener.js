// مستمع الأحداث المخصص للطلبات الذكية - معطل (الوظيفة منقولة لـ useReliableAiOrderNotifications)
import { useEffect } from 'react';

/**
 * هذا الـ hook معطل لمنع تكرار الإشعارات
 * الإشعارات تُدار حصرياً من useReliableAiOrderNotifications
 */
export const useAiOrderEventListener = (user) => {
  useEffect(() => {
    // معطل - لا شيء هنا
  }, [user]);

  return null;
};
