-- حذف الـ Trigger الذي يُنشئ إشعارات متكررة
-- المشكلة: الـ Trigger يُطلق لكل صف يتم تحديثه إلى 'settlement_requested'
-- مما يُنتج إشعاراً منفصلاً لكل طلب بدلاً من إشعار واحد للمجموعة

DROP TRIGGER IF EXISTS trg_notify_settlement_request ON public.profits;