-- تحسين دالة extract_product_items_from_text لفهم أفضل للطلبات
CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(input_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_result jsonb := '[]';
  v_words text[];
  v_product_names text[] := ARRAY['برشلونة', 'ريال مدريد', 'مانشستر سيتي', 'مانشستر يونايتد', 'ليفربول', 'تشيلسي', 'آرسنال', 'توتنهام', 'باريس سان جيرمان', 'بايرن ميونخ', 'انتر ميلان', 'يوفنتوس', 'اي سي ميلان', 'اتلتيكو مدريد', 'بوروسيا دورتموند', 'نابولي', 'ليون', 'سبورتنغ', 'بورتو', 'روما', 'لاتسيو', 'فالنسيا', 'اشبيلية', 'بيتيس', 'فياريال', 'أتلتيك بلباو', 'ريال سوسيداد', 'سيلتا فيغو', 'ليفانتي', 'الاهلي', 'الزمالك', 'وست هام', 'نيوكاسل', 'ليستر سيتي', 'كريستال بالاس', 'برايتون', 'ولفرهامبتون', 'ساوثهامبتون', 'نوريتش سيتي', 'واتفورد', 'بورنموث', 'فولهام', 'شيفيلد يونايتد', 'أستون فيلا', 'بيرنلي', 'ليدز يونايتد', 'إيفرتون', 'هال سيتي', 'سوانزي سيتي', 'كارديف سيتي', 'ميدلسبرو', 'بلاكبيرن روفرز', 'بولتون واندرارز', 'ويغان أتلتيك', 'ستوك سيتي', 'ولفرهامبتون', 'بريستول سيتي', 'كوفنتري سيتي', 'بيرمنغهام سيتي', 'ديربي كاونتي', 'نوتنغهام فورست', 'شيفيلد وينزداي', 'ريدينغ', 'كوينز بارك رينجرز', 'ميلوول', 'لوتون تاون', 'روثرهام يونايتد', 'هدرزفيلد تاون', 'بلاكبول', 'بريستون نورث إند', 'بارنسلي', 'شارلتون أتلتيك', 'بورت فيل', 'أكرينغتون ستانلي', 'بورتسموث', 'أكسفورد يونايتد', 'ويكومب واندرارز', 'ساتن يونايتد', 'جيليغهام', 'شروزبري تاون', 'لنكولن سيتي', 'دونكاستر روفرز', 'ريكسهام', 'نوتس كاونتي', 'سولفورد سيتي', 'هارتليبولز يونايتد', 'كراولي تاون', 'برادفورد سيتي', 'كولتشستر يونايتد', 'نيوبورت كاونتي', 'ترانمير روفرز', 'إكسيتر سيتي', 'فورست غرين روفرز', 'مانسفيلد تاون', 'كارلايل يونايتد', 'ستيفيناج', 'سويندون تاون', 'هارو غيت تاون', 'ساتن يونايتد', 'باروو', 'كرو ألكساندرا', 'وولفورد', 'آلفا تاورز', 'أوديون سينما', 'بيتر وايت'];
  v_colors text[] := ARRAY['ازرق', 'احمر', 'اخضر', 'اصفر', 'اسود', 'ابيض', 'بنفسجي', 'برتقالي', 'وردي', 'رمادي', 'بني', 'ذهبي', 'فضي'];
  v_sizes text[] := ARRAY['s', 'm', 'l', 'xl', 'xxl', 'xxxl', 'صغير', 'وسط', 'كبير', 'ميديم', 'لارج', 'اكسات', 'اكس'];
  v_word text;
  v_found_product text;
  v_found_color text;
  v_found_size text;
  v_price numeric := 15000; -- سعر افتراضي
BEGIN
  -- تنظيف النص وتقسيمه
  v_words := string_to_array(lower(trim(input_text)), ' ');
  
  -- البحث عن المنتج
  FOREACH v_word IN ARRAY v_words
  LOOP
    -- البحث في أسماء المنتجات
    SELECT name INTO v_found_product
    FROM unnest(v_product_names) AS name
    WHERE lower(name) LIKE '%' || v_word || '%'
    LIMIT 1;
    
    IF v_found_product IS NOT NULL THEN
      EXIT;
    END IF;
  END LOOP;

  -- البحث عن اللون
  FOREACH v_word IN ARRAY v_words
  LOOP
    IF v_word = ANY(v_colors) THEN
      v_found_color := v_word;
      EXIT;
    END IF;
  END LOOP;

  -- البحث عن المقاس
  FOREACH v_word IN ARRAY v_words
  LOOP
    IF v_word = ANY(v_sizes) OR v_word ~ '^(s|m|l|xl|xxl|xxxl)$' THEN
      v_found_size := CASE 
        WHEN v_word = 'ميديم' THEN 'M'
        WHEN v_word = 'لارج' THEN 'L'
        WHEN v_word ~ '^x+l?$' THEN upper(v_word)
        ELSE v_word
      END;
      EXIT;
    END IF;
  END LOOP;

  -- إذا تم العثور على منتج، أنشئ عنصر
  IF v_found_product IS NOT NULL THEN
    v_result := jsonb_build_array(
      jsonb_build_object(
        'product_name', v_found_product,
        'color', COALESCE(v_found_color, 'ازرق'),
        'size', COALESCE(v_found_size, 'M'),
        'quantity', 1,
        'unit_price', v_price,
        'total_price', v_price
      )
    );
  END IF;

  RETURN v_result;
END;
$function$;