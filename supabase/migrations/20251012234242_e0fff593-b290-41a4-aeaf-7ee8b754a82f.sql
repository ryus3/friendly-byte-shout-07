-- حذف السياسة الخطيرة فقط
DROP POLICY IF EXISTS "Allow all operations on telegram_pending_selections" ON public.telegram_pending_selections;