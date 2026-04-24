// نظام احتياطي قديم لإشعارات الطلبات الذكية — تم تعطيله.
// كان يضيف إشعارات بنص "استلام طلب جديد من التليغرام يحتاج للمراجعة"
// حتى لطلبات المساعد الذكي. الإشعارات الموثوقة الآن تأتي من
// Edge Function ai-order-notifications وتحترم source الفعلي للطلب.
import { useEffect } from 'react';

export const useAiOrderFallbackChecker = (_user) => {
  useEffect(() => {}, []);
  return null;
};
