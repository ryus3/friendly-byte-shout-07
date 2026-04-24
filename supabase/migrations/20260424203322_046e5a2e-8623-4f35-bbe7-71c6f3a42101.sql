CREATE OR REPLACE FUNCTION public.extractphonefromtext(input_text text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  converted_input text;
  digits_only text;
  phone_matches text[];
  phones_array text[] := ARRAY[]::text[];
  phone_match text;
  normalized_phone text;
  prefix3 text;
BEGIN
  -- 1) تحويل الأرقام العربية إلى إنجليزية
  converted_input := input_text;
  converted_input := translate(converted_input,
    '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
    '01234567890123456789'
  );

  -- 2) تطبيع: الاحتفاظ فقط بالأرقام والمسافات (إزالة + و - و () وغيرها)
  --    ثم إزالة كل الفراغات لاستخراج تسلسل أرقام نقي
  digits_only := regexp_replace(converted_input, '[^0-9]+', ' ', 'g');
  -- نضع نسخة بدون أي فاصل لاستخراج كل التسلسلات الطويلة
  digits_only := regexp_replace(digits_only, '\s+', ' ', 'g');

  -- 3) استخراج كل التسلسلات الرقمية الطويلة (10 أرقام أو أكثر) - تشمل الصيغ الدولية
  phone_matches := ARRAY(
    SELECT (regexp_matches(digits_only, '[0-9]{10,15}', 'g'))[1]
  );

  FOREACH phone_match IN ARRAY phone_matches
  LOOP
    normalized_phone := NULL;

    -- صيغة دولية: 00964 7XXXXXXXXX (14 رقم)
    IF length(phone_match) = 14 AND substring(phone_match from 1 for 5) = '00964' THEN
      normalized_phone := '0' || substring(phone_match from 6);
    -- صيغة دولية: 964 7XXXXXXXXX (12 رقم)
    ELSIF length(phone_match) = 12 AND substring(phone_match from 1 for 3) = '964' THEN
      normalized_phone := '0' || substring(phone_match from 4);
    -- صيغة محلية: 07XXXXXXXXX (11 رقم)
    ELSIF length(phone_match) = 11 AND substring(phone_match from 1 for 1) = '0' THEN
      normalized_phone := phone_match;
    -- صيغة محلية بدون 0: 7XXXXXXXXX (10 أرقام)
    ELSIF length(phone_match) = 10 AND substring(phone_match from 1 for 1) = '7' THEN
      normalized_phone := '0' || phone_match;
    END IF;

    IF normalized_phone IS NOT NULL AND length(normalized_phone) = 11 THEN
      prefix3 := substring(normalized_phone from 1 for 3);
      IF prefix3 IN ('070','071','072','073','074','075','076','077','078','079') THEN
        IF NOT (normalized_phone = ANY(phones_array)) THEN
          phones_array := array_append(phones_array, normalized_phone);
        END IF;
      END IF;
    END IF;
  END LOOP;

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
$function$;