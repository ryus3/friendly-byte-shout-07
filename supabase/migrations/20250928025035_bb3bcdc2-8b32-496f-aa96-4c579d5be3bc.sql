-- إصلاح سريع للبوت: إزالة الدالة المعطلة واستخدام دالة بسيطة
DROP FUNCTION IF EXISTS public.extract_product_items_with_availability_check(text);

-- إرجاع استخدام الدالة القديمة مؤقتاً
CREATE OR REPLACE FUNCTION public.extract_product_items_with_availability_check(input_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- استخدام الدالة الأساسية مؤقتاً حتى لا يتعطل البوت
  RETURN extract_product_items_from_text(input_text);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error', 
      'message', '⚠️ حدث خطأ أثناء فحص توفر المنتجات. يرجى إعادة المحاولة.'
    );
END;
$function$;