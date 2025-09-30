-- دالة استخراج رقم الهاتف من النص
CREATE OR REPLACE FUNCTION public.extractphonefromtext(input_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  cleaned_text text;
  phone_match text;
  normalized_phone text;
BEGIN
  -- تنظيف النص من المسافات والرموز الخاصة
  cleaned_text := regexp_replace(input_text, '[^\d+]', '', 'g');
  
  -- محاولة استخراج رقم بتنسيق +9647XXXXXXXXX أو 009647XXXXXXXXX
  phone_match := substring(cleaned_text from '(00)?9647[0-9]{9}');
  IF phone_match IS NOT NULL THEN
    -- تحويل إلى 07XXXXXXXXX
    normalized_phone := '0' || substring(phone_match from '[7-9][0-9]{9}$');
    -- التحقق من البادئة العراقية
    IF substring(normalized_phone from 1 for 3) IN ('070', '071', '075', '076', '077', '078', '079') THEN
      RETURN normalized_phone;
    END IF;
  END IF;
  
  -- محاولة استخراج رقم بتنسيق 9647XXXXXXXXX
  phone_match := substring(cleaned_text from '9647[0-9]{9}');
  IF phone_match IS NOT NULL THEN
    normalized_phone := '0' || substring(phone_match from '[7-9][0-9]{9}$');
    IF substring(normalized_phone from 1 for 3) IN ('070', '071', '075', '076', '077', '078', '079') THEN
      RETURN normalized_phone;
    END IF;
  END IF;
  
  -- محاولة استخراج رقم بتنسيق 07XXXXXXXXX مباشرة
  phone_match := substring(input_text from '07[0-9]{9}');
  IF phone_match IS NOT NULL THEN
    IF substring(phone_match from 1 for 3) IN ('070', '071', '075', '076', '077', '078', '079') THEN
      RETURN phone_match;
    END IF;
  END IF;
  
  -- إذا لم نجد رقم صحيح، نبحث عن أي رقم من 11 خانة يبدأ بـ 07
  phone_match := substring(input_text from '07[0-9]{9}');
  IF phone_match IS NOT NULL THEN
    RETURN phone_match;
  END IF;
  
  -- إذا لم نجد أي رقم، نرجع قيمة افتراضية
  RETURN 'غير محدد';
END;
$$;