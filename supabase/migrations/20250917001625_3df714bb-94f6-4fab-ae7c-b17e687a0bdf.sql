-- إصلاح الدالة لتجنب التحذير الأمني
CREATE OR REPLACE FUNCTION public.normalize_arabic_text(input_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN input_text IS NULL THEN ''
    ELSE LOWER(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(TRIM(input_text), 'أ', 'ا'),
              'إ', 'ا'
            ),
            'آ', 'ا'
          ),
          'ة', 'ه'
        ),
        'ي', 'ى'
      )
    )
  END;
$$;