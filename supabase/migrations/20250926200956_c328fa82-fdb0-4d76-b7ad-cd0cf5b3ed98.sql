-- Remove the problematic trigger and function with CASCADE to avoid dependency issues
DROP TRIGGER IF EXISTS ai_order_notification_trigger ON public.ai_orders CASCADE;
DROP FUNCTION IF EXISTS public.notify_ai_order_webhook() CASCADE;