-- إضافة عداد الغياب من الشريك (للكشف الآمن عن الحذف من قبل شركة التوصيل)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS partner_missed_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.orders.partner_missed_count IS
'عدد المرات المتتالية التي لم يُعد فيها الشريك (الوسيط/مدن) هذا الطلب في رد API. يستخدم عدّاد 2-strike قبل وضع الطلب كملغى من الشريك.';