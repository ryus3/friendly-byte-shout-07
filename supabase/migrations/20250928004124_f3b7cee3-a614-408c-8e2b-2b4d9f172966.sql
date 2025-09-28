-- Drop the broken detailed function
DROP FUNCTION IF EXISTS public.process_telegram_order_detailed(text, bigint, bigint, text);

-- Also drop any other variations that might exist
DROP FUNCTION IF EXISTS public.process_telegram_order_detailed(text, bigint);
DROP FUNCTION IF EXISTS public.process_telegram_order_detailed;