// مستمع أحداث الطلبات الذكية القديم — تم تعطيله.
// كان ينتج إشعارات نصها "استلام طلب جديد من التليغرام يحتاج للمراجعة"
// حتى للطلبات القادمة من المساعد الذكي. الإشعارات الصحيحة تُنشأ الآن
// من Edge Function ai-order-notifications اعتماداً على source الفعلي.
import { useEffect } from 'react';

export const useAiOrderEventListener = (_user) => {
  useEffect(() => {}, []);
  return null;
};
