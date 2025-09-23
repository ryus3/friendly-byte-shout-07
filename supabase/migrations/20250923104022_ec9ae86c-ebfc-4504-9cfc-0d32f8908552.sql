-- Fix the corrupted chat_id for RYU559 specifically
-- Convert 4.99943724e+08 to 499943724
UPDATE public.telegram_employee_codes 
SET telegram_chat_id = 499943724
WHERE employee_code = 'RYU559' 
  AND telegram_chat_id::text = '4.99943724e+08';

-- Also fix any other chat_ids that might be in scientific notation
-- This function will convert scientific notation to proper bigint
CREATE OR REPLACE FUNCTION convert_scientific_to_bigint(sci_text text)
RETURNS bigint
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Convert scientific notation like "4.99943724e+08" to bigint
  RETURN floor(sci_text::numeric)::bigint;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$function$;

-- Update all rows with scientific notation
UPDATE public.telegram_employee_codes 
SET telegram_chat_id = convert_scientific_to_bigint(telegram_chat_id::text)
WHERE telegram_chat_id IS NOT NULL 
  AND telegram_chat_id::text ~ '^[0-9\.]+e\+[0-9]+$';