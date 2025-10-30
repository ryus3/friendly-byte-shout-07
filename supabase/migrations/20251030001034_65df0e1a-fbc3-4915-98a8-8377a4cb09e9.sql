-- حذف وإعادة إنشاء دالة extractphonefromtext مع دعم الأرقام العربية
DROP FUNCTION IF EXISTS extractphonefromtext(text);

CREATE FUNCTION extractphonefromtext(input_text text)
RETURNS TABLE(primary_phone text, secondary_phone text) AS $$
DECLARE
  cleaned_text text;
  converted_input text;
  phone_matches text[];
BEGIN
  -- تحويل جميع الأرقام العربية إلى إنجليزية في النص الأصلي
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
  
  -- إزالة المسافات والفواصل والرموز غير المرغوبة من النص المحول
  cleaned_text := regexp_replace(converted_input, '[^\u0600-\u06FF0-9a-zA-Z\s\-\.\n]', '', 'g');
  
  -- البحث عن أرقام الهواتف العراقية (تبدأ بـ 07 ومكونة من 11 رقم) في النص المحول
  phone_matches := ARRAY(SELECT (regexp_matches(cleaned_text, '07[0-9]{9}', 'g'))[1]);
  
  -- إرجاع النتائج
  IF array_length(phone_matches, 1) >= 2 THEN
    -- إذا وجدنا رقمين أو أكثر
    primary_phone := phone_matches[1];
    secondary_phone := phone_matches[2];
  ELSIF array_length(phone_matches, 1) = 1 THEN
    -- إذا وجدنا رقم واحد فقط
    primary_phone := phone_matches[1];
    secondary_phone := NULL;
  ELSE
    -- لم نجد أي رقم
    primary_phone := NULL;
    secondary_phone := NULL;
  END IF;
  
  RETURN QUERY SELECT primary_phone, secondary_phone;
END;
$$ LANGUAGE plpgsql;