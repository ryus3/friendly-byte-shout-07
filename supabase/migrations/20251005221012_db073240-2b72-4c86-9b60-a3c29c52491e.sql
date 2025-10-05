-- تحديث دالة extract_actual_address لاستخراج العنوان بعد كلمة "قرب" فقط
CREATE OR REPLACE FUNCTION public.extract_actual_address(input_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  cleaned_text text;
  lines text[];
  line text;
  qarab_position integer;
BEGIN
  -- تنظيف النص
  cleaned_text := TRIM(input_text);
  
  -- تقسيم إلى سطور
  lines := string_to_array(cleaned_text, E'\n');
  
  -- البحث عن سطر يحتوي على "قرب"
  FOREACH line IN ARRAY lines LOOP
    qarab_position := POSITION('قرب' IN line);
    
    IF qarab_position > 0 THEN
      -- استخراج كل شيء من "قرب" إلى نهاية السطر
      RETURN TRIM(SUBSTRING(line FROM qarab_position));
    END IF;
  END LOOP;
  
  -- إذا لم نجد "قرب"، نرجع 'لم يُحدد'
  RETURN 'لم يُحدد';
END;
$function$;