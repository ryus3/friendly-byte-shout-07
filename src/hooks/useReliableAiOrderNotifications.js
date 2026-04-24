// نظام إشعارات الطلبات الذكية القديم — تم تعطيله.
// الإشعارات الموثوقة الآن تُنشأ من Edge Function (ai-order-notifications)
// وتعتمد على حقل source الحقيقي (ai_assistant / telegram) لتفادي الخلط.
import { useEffect } from 'react';

export const useReliableAiOrderNotifications = (_user) => {
  useEffect(() => {
    // intentionally disabled
  }, []);
  return null;
};
