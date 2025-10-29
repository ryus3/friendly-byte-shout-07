-- حذف الدالة القديمة وإعادة إنشائها بنوع إرجاع jsonb
DROP FUNCTION IF EXISTS public.extractphonefromtext(text);

-- إنشاء دالة extractphonefromtext لدعم الأرقام العربية ورقمين هاتف
CREATE OR REPLACE FUNCTION public.extractphonefromtext(input_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  cleaned_text text;
  phone_match text;
  normalized_phone text;
  phones_array text[] := ARRAY[]::text[];
  phone_matches text[];
BEGIN
  -- تحويل الأرقام العربية إلى إنجليزية أولاً
  cleaned_text := input_text;
  cleaned_text := replace(cleaned_text, '٠', '0');
  cleaned_text := replace(cleaned_text, '١', '1');
  cleaned_text := replace(cleaned_text, '٢', '2');
  cleaned_text := replace(cleaned_text, '٣', '3');
  cleaned_text := replace(cleaned_text, '٤', '4');
  cleaned_text := replace(cleaned_text, '٥', '5');
  cleaned_text := replace(cleaned_text, '٦', '6');
  cleaned_text := replace(cleaned_text, '٧', '7');
  cleaned_text := replace(cleaned_text, '٨', '8');
  cleaned_text := replace(cleaned_text, '٩', '9');
  
  -- تنظيف النص من المسافات والرموز الخاصة (بعد التحويل)
  cleaned_text := regexp_replace(cleaned_text, '[^\d+]', '', 'g');
  
  -- استخراج جميع الأرقام بتنسيق +9647XXXXXXXXX أو 009647XXXXXXXXX
  phone_matches := ARRAY(SELECT (regexp_matches(cleaned_text, '(00)?9647[0-9]{9}', 'g'))[1]);
  FOREACH phone_match IN ARRAY phone_matches
  LOOP
    normalized_phone := '0' || substring(phone_match from '[7-9][0-9]{9}$');
    IF substring(normalized_phone from 1 for 3) IN ('070', '071', '075', '076', '077', '078', '079') THEN
      IF NOT (normalized_phone = ANY(phones_array)) THEN
        phones_array := array_append(phones_array, normalized_phone);
      END IF;
    END IF;
  END LOOP;
  
  -- استخراج جميع الأرقام بتنسيق 9647XXXXXXXXX
  phone_matches := ARRAY(SELECT (regexp_matches(cleaned_text, '9647[0-9]{9}', 'g'))[1]);
  FOREACH phone_match IN ARRAY phone_matches
  LOOP
    normalized_phone := '0' || substring(phone_match from '[7-9][0-9]{9}$');
    IF substring(normalized_phone from 1 for 3) IN ('070', '071', '075', '076', '077', '078', '079') THEN
      IF NOT (normalized_phone = ANY(phones_array)) THEN
        phones_array := array_append(phones_array, normalized_phone);
      END IF;
    END IF;
  END LOOP;
  
  -- استخراج جميع الأرقام بتنسيق 07XXXXXXXXX مباشرة من النص الأصلي (مع دعم الأرقام العربية)
  phone_matches := ARRAY(SELECT (regexp_matches(input_text, '0[٧7][٠-٩0-9]{9}', 'g'))[1]);
  FOREACH phone_match IN ARRAY phone_matches
  LOOP
    -- تحويل الأرقام العربية إلى إنجليزية
    phone_match := replace(phone_match, '٠', '0');
    phone_match := replace(phone_match, '١', '1');
    phone_match := replace(phone_match, '٢', '2');
    phone_match := replace(phone_match, '٣', '3');
    phone_match := replace(phone_match, '٤', '4');
    phone_match := replace(phone_match, '٥', '5');
    phone_match := replace(phone_match, '٦', '6');
    phone_match := replace(phone_match, '٧', '7');
    phone_match := replace(phone_match, '٨', '8');
    phone_match := replace(phone_match, '٩', '9');
    
    IF substring(phone_match from 1 for 3) IN ('070', '071', '075', '076', '077', '078', '079') THEN
      IF NOT (phone_match = ANY(phones_array)) THEN
        phones_array := array_append(phones_array, phone_match);
      END IF;
    END IF;
  END LOOP;
  
  -- إرجاع النتيجة
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
      'primary', 'غير محدد',
      'secondary', null
    );
  END IF;
END;
$$;