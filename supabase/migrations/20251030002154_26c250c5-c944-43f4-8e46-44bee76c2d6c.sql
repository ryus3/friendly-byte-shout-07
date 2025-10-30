-- إصلاح دالة extractphonefromtext لترجع jsonb مع دعم الأرقام العربية
DROP FUNCTION IF EXISTS public.extractphonefromtext(text);

CREATE OR REPLACE FUNCTION public.extractphonefromtext(input_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  converted_input text;
  phone_matches text[];
  phones_array text[] := ARRAY[]::text[];
  phone_match text;
BEGIN
  -- تحويل جميع الأرقام العربية إلى إنجليزية
  converted_input := input_text;
  converted_input := replace(converted_input, '٠', '0');
  converted_input := replace(converted_input, '١', '1');
  converted_input := replace(converted_input, '٢', '2');
  converted_input := replace(converted_input, '٣', '3');
  converted_input := replace(converted_input, '٤', '4');
  converted_input := replace(converted_input, '٥', '5');
  converted_input := replace(converted_input, '٦', '6');
  converted_input := replace(converted_input, '٧', '7');
  converted_input := replace(converted_input, '٨', '8');
  converted_input := replace(converted_input, '٩', '9');
  
  -- استخراج أرقام بنمط 07XXXXXXXXX
  phone_matches := ARRAY(SELECT (regexp_matches(converted_input, '07[0-9]{9}', 'g'))[1]);
  
  FOREACH phone_match IN ARRAY phone_matches
  LOOP
    IF substring(phone_match from 1 for 3) IN ('070', '071', '075', '076', '077', '078', '079') THEN
      IF NOT (phone_match = ANY(phones_array)) THEN
        phones_array := array_append(phones_array, phone_match);
      END IF;
    END IF;
  END LOOP;
  
  -- إرجاع النتيجة كـ jsonb
  IF array_length(phones_array, 1) >= 2 THEN
    RETURN jsonb_build_object(
      'primary', phones_array[1],
      'secondary', phones_array[2]
    );
  ELSIF array_length(phones_array, 1) = 1 THEN
    RETURN jsonb_build_object(
      'primary', phones_array[1],
      'secondary', null
    );
  ELSE
    RETURN jsonb_build_object(
      'primary', null,
      'secondary', null
    );
  END IF;
END;
$$;