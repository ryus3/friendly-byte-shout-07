-- إصلاح دالة توليد رموز التليغرام لتوليد أحرف إنجليزية فقط
CREATE OR REPLACE FUNCTION public.generate_unified_telegram_code(p_full_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  name_prefix TEXT;
  random_suffix TEXT;
  new_code TEXT;
  code_exists BOOLEAN;
  counter INTEGER := 0;
  transliterated_name TEXT;
BEGIN
  -- ترجمة الأسماء العربية للإنجليزية
  transliterated_name := CASE 
    WHEN p_full_name ~ '[\u0621-\u064A]' THEN
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
      p_full_name,
      'محمد', 'MHD'), 'احمد', 'AHM'), 'علي', 'ALI'), 'حسن', 'HSN'), 'حسين', 'HSE'),
      'عبدالله', 'ABD'), 'عبد', 'ABD'), 'فاطمة', 'FAT'), 'زينب', 'ZNB'), 'مريم', 'MRM'),
      'سارة', 'SAR'), 'نور', 'NOR'), 'أمير', 'AMR'), 'خالد', 'KHD'), 'عمر', 'OMR'),
      'يوسف', 'YSF'), 'إبراهيم', 'IBR'), 'موسى', 'MSA'), 'عيسى', 'ESA'), 'داود', 'DWD'),
      'سليمان', 'SLM'), 'يعقوب', 'YQB'), 'إسحاق', 'ISH'), 'إسماعيل', 'ISM'), 'هارون', 'HRN'),
      'زكريا', 'ZKR'), 'يحيى', 'YHY'), 'عبدالرحمن', 'ABR'), 'عبدالعزيز', 'ABZ'), 'عبدالرحيم', 'ABO')
    ELSE p_full_name
  END;
  
  -- استخراج أول 3 أحرف إنجليزية من الاسم المترجم
  name_prefix := UPPER(LEFT(REGEXP_REPLACE(transliterated_name, '[^A-Za-z]', '', 'g'), 3));
  
  -- التأكد من وجود أحرف كافية
  IF LENGTH(name_prefix) < 3 THEN
    name_prefix := LPAD(name_prefix, 3, 'X');
  END IF;
  
  LOOP
    -- توليد لاحقة عشوائية (4 أحرف/أرقام إنجليزية)
    random_suffix := SUBSTRING(UPPER(MD5(RANDOM()::text || NOW()::text)), 1, 4);
    new_code := name_prefix || random_suffix;
    
    -- فحص إذا كان الرمز موجود مسبقاً
    SELECT EXISTS(
      SELECT 1 FROM public.telegram_employee_codes 
      WHERE employee_code = new_code
    ) INTO code_exists;
    
    -- إذا لم يكن موجود، استخدمه
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
    
    counter := counter + 1;
    
    -- حماية من حلقة لا نهائية
    IF counter > 100 THEN
      -- استخدم رمز عشوائي كحل أخير
      new_code := 'EMP' || SUBSTRING(UPPER(MD5(RANDOM()::text)), 1, 4);
      RETURN new_code;
    END IF;
  END LOOP;
END;
$function$;

-- إصلاح دالة تسجيل الإيرادات لاستخدام رقم التتبع
CREATE OR REPLACE FUNCTION public.record_order_revenue_on_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  main_cash_id UUID;
  actual_revenue NUMERIC;
  display_number TEXT;
BEGIN
  -- عند تحديد أن الفاتورة استُلمت
  IF NEW.receipt_received = true AND OLD.receipt_received = false AND NEW.status = 'completed' THEN
    
    -- الحصول على معرف القاصة الرئيسية
    SELECT id INTO main_cash_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
    
    -- حساب الإيراد الفعلي (بدون رسوم التوصيل)
    actual_revenue := NEW.total_amount - NEW.delivery_fee;
    
    -- استخدام رقم التتبع إذا كان متوفر، وإلا رقم الطلب
    display_number := COALESCE(NULLIF(NEW.tracking_number, ''), NEW.order_number);
    
    -- إضافة الإيراد للقاصة الرئيسية
    IF main_cash_id IS NOT NULL AND actual_revenue > 0 THEN
      PERFORM public.update_cash_source_balance(
        main_cash_id,
        actual_revenue,
        'in',
        'order_revenue',
        NEW.id,
        'إيراد الطلب ' || display_number || ' (بدون رسوم التوصيل)',
        NEW.receipt_received_by
      );
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- تحديث رمز عبدالله الحالي ليكون موحد
UPDATE public.telegram_employee_codes 
SET employee_code = 'ABD' || SUBSTRING(UPPER(MD5(RANDOM()::text)), 1, 4),
    updated_at = now()
WHERE employee_code = 'عبدل250';