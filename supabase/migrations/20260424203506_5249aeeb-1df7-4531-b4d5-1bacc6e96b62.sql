CREATE OR REPLACE FUNCTION public.extractphonefromtext(input_text text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  converted_input text;
  digits_stream text;
  phones_array text[] := ARRAY[]::text[];
  i integer;
  candidate text;
  normalized_phone text;
  prefix3 text;
  stream_len integer;
BEGIN
  IF input_text IS NULL OR length(input_text) = 0 THEN
    RETURN jsonb_build_object('primary', null, 'secondary', null);
  END IF;

  -- 1) تحويل الأرقام العربية والفارسية إلى إنجليزية
  converted_input := translate(input_text,
    '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
    '01234567890123456789'
  );

  -- 2) إزالة كل الأحرف غير الرقمية
  digits_stream := regexp_replace(converted_input, '[^0-9]', '', 'g');
  stream_len := length(digits_stream);

  IF stream_len < 10 THEN
    RETURN jsonb_build_object('primary', null, 'secondary', null);
  END IF;

  -- 3) المسح بنافذة منزلقة
  i := 1;
  WHILE i <= stream_len LOOP
    normalized_phone := NULL;

    -- صيغة 15 رقم: 00964 + 7 + 9 خانات (مجموع 10 خانات بعد 00964)
    IF i + 14 <= stream_len AND substring(digits_stream from i for 5) = '00964'
       AND substring(digits_stream from i + 5 for 1) = '7' THEN
      candidate := substring(digits_stream from i for 15);
      normalized_phone := '0' || substring(candidate from 6); -- '0' + 10 خانات = 11
      i := i + 15;
    -- صيغة 14 رقم: 0964 + 7 + 9 خانات
    ELSIF i + 13 <= stream_len AND substring(digits_stream from i for 4) = '0964'
       AND substring(digits_stream from i + 4 for 1) = '7' THEN
      candidate := substring(digits_stream from i for 14);
      normalized_phone := '0' || substring(candidate from 5);
      i := i + 14;
    -- صيغة 13 رقم: 964 + 7 + 9 خانات
    ELSIF i + 12 <= stream_len AND substring(digits_stream from i for 3) = '964'
       AND substring(digits_stream from i + 3 for 1) = '7' THEN
      candidate := substring(digits_stream from i for 13);
      normalized_phone := '0' || substring(candidate from 4);
      i := i + 13;
    -- صيغة محلية 11 رقم: 07XXXXXXXXX
    ELSIF i + 10 <= stream_len AND substring(digits_stream from i for 2) = '07' THEN
      candidate := substring(digits_stream from i for 11);
      normalized_phone := candidate;
      i := i + 11;
    -- صيغة محلية بدون 0 (10 خانات): 7XXXXXXXXX
    ELSIF i + 9 <= stream_len AND substring(digits_stream from i for 1) = '7' THEN
      candidate := substring(digits_stream from i for 10);
      normalized_phone := '0' || candidate;
      i := i + 10;
    ELSE
      i := i + 1;
      CONTINUE;
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
    RETURN jsonb_build_object('primary', phones_array[1], 'secondary', phones_array[2]);
  ELSIF array_length(phones_array, 1) = 1 THEN
    RETURN jsonb_build_object('primary', phones_array[1], 'secondary', null);
  ELSE
    RETURN jsonb_build_object('primary', null, 'secondary', null);
  END IF;
END;
$function$;