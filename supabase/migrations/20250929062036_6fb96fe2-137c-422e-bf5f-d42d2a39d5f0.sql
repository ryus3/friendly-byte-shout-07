-- أولاً: حذف الدالة الموجودة لإعادة إنشائها بالمعاملات الجديدة
DROP FUNCTION IF EXISTS public.smart_search_region(text, integer);

-- إضافة دالة البحث الذكي عن المناطق مع مرادفات شاملة لبغداد ونظام "هل تقصد؟"
CREATE OR REPLACE FUNCTION public.smart_search_region(search_text text, preferred_city_id integer DEFAULT NULL)
RETURNS TABLE(region_id integer, region_name text, city_id integer, city_name text, match_type text, confidence numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  normalized_search text;
  synonyms_map jsonb;
BEGIN
  normalized_search := lower(trim(regexp_replace(search_text, '[^\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFFa-zA-Z0-9\s]', '', 'g')));
  
  -- خريطة مرادفات شاملة لجميع مناطق بغداد الشائعة
  synonyms_map := '{
    "كرادة": ["كرادة داخل", "الكرادة", "كرادة شرقية", "كرادة غربية", "كراده", "كرادة مريم"],
    "كرادة داخل": ["كرادة", "الكرادة", "كراده"],
    "كرادة شرقية": ["كرادة", "الكرادة الشرقية", "كراده شرقيه"],
    "كرادة مريم": ["كرادة", "كراده مريم", "مريم"],
    "العدل": ["العدل", "عدل", "منطقة العدل", "حي العدل"],
    "الجادرية": ["جادرية", "الجادريه", "جادريه"],
    "الكاظمية": ["كاظمية", "الكاظميه", "كاظميه", "شارع الكاظمية"],
    "الاعظمية": ["اعظمية", "الاعظميه", "اعظميه", "شارع الاعظمية"],
    "الدورة": ["دورة", "الدوره", "دوره", "منطقة الدورة"],
    "الشعلة": ["شعلة", "الشعله", "شعله", "حي الشعلة"],
    "الحرية": ["حرية", "الحريه", "حريه", "حي الحرية"],
    "الشعب": ["شعب", "حي الشعب", "منطقة الشعب"],
    "الطالبية": ["طالبية", "الطالبيه", "طالبيه"],
    "الغدير": ["غدير", "الغدير", "منطقة الغدير"],
    "الزعفرانية": ["زعفرانية", "الزعفرانيه", "زعفرانيه"],
    "الراشدية": ["راشدية", "الراشديه", "راشديه"],
    "النهروان": ["نهروان", "النهروان"],
    "الجهاد": ["جهاد", "حي الجهاد", "منطقة الجهاد"],
    "العامرية": ["عامرية", "العامريه", "عامريه"],
    "الغزالية": ["غزالية", "الغزاليه", "غزاليه"],
    "الشرطة الخامسة": ["شرطة خامسة", "الشرطه الخامسه", "شرطه خامسه", "شرطة 5"],
    "الشرطة الرابعة": ["شرطة رابعة", "الشرطه الرابعه", "شرطه رابعه", "شرطة 4"],
    "الرشيد": ["رشيد", "شارع الرشيد", "منطقة الرشيد"],
    "المثنى": ["مثنى", "المثنى", "حي المثنى"],
    "الجعيفر": ["جعيفر", "الجعيفر"],
    "أبو دشير": ["ابو دشير", "ابودشير", "أبودشير", "ابو دشیر"],
    "الدوكان": ["دوكان", "الدوكان"],
    "التاجي": ["تاجي", "التاجي", "منطقة التاجي"],
    "المدائن": ["مدائن", "المدائن"],
    "اليوسفية": ["يوسفية", "اليوسفيه", "يوسفيه"],
    "الصدر": ["صدر", "مدينة الصدر", "الثورة"],
    "الثورة": ["ثورة", "مدينة الثورة", "الصدر"],
    "الحبيبية": ["حبيبية", "الحبيبيه", "حبيبيه"],
    "الوشاش": ["وشاش", "الوشاش"],
    "الصباح": ["صباح", "حي الصباح"],
    "البياع": ["بياع", "البياع"],
    "الجميعة": ["جميعة", "الجميعه", "جميعه"],
    "الكسرة": ["كسرة", "الكسره", "كسره"],
    "القادسية": ["قادسية", "القادسيه", "قادسيه"],
    "الجامعة": ["جامعة", "الجامعه", "جامعه", "منطقة الجامعة"],
    "المنصور": ["منصور", "المنصور", "حي المنصور"],
    "اليرموك": ["يرموك", "اليرموك"],
    "الموصل الجديدة": ["موصل جديدة", "الموصل الجديده"],
    "زيونة": ["زيونه", "زيونة"],
    "المعمل": ["معمل", "المعمل"],
    "الزوراء": ["زوراء", "الزوراء"],
    "الرستمية": ["رستمية", "الرستميه", "رستميه"],
    "الانتفاضة": ["انتفاضة", "الانتفاضه", "انتفاضه"],
    "المعالي": ["معالي", "المعالي"],
    "الوحدة": ["وحدة", "الوحده", "وحده", "حي الوحدة"],
    "السيدية": ["سيدية", "السيديه", "سيديه"],
    "المهدية": ["مهدية", "المهديه", "مهديه"],
    "المواصلات": ["مواصلات", "المواصلات"],
    "سبع البور": ["سبع بور", "سبع البور"],
    "النصر": ["نصر", "النصر", "حي النصر"],
    "الأمين": ["امين", "الامين", "حي الأمين"],
    "العلوية": ["علوية", "العلويه", "علويه"],
    "القاهرة": ["قاهرة", "القاهره", "قاهره", "شارع القاهرة"],
    "بغداد الجديدة": ["بغداد جديدة", "بغداد الجديده", "نيو بغداد", "نيوبغداد"],
    "الزيتون": ["زيتون", "الزيتون"],
    "الفحامة": ["فحامة", "الفحامه", "فحامه"],
    "الكمالية": ["كمالية", "الكماليه", "كماليه"],
    "التحرير": ["تحرير", "التحرير", "ساحة التحرير"],
    "الباب الشرقي": ["باب شرقي", "الباب الشرقي"],
    "الباب المعظم": ["باب معظم", "الباب المعظم"],
    "الشواكة": ["شواكة", "الشواكه", "شواكه"],
    "الفضل": ["فضل", "الفضل"],
    "الصاحب": ["صاحب", "الصاحب"],
    "الميدان": ["ميدان", "الميدان"],
    "الطيران": ["طيران", "الطيران", "مطار"],
    "الآرامل": ["آرامل", "الآرامل", "ارامل"],
    "القادسية": ["قادسية", "القادسيه", "قادسيه"],
    "الرحمانية": ["رحمانية", "الرحمانيه", "رحمانيه"],
    "البلديات": ["بلديات", "البلديات"],
    "الجناين": ["جناين", "الجناين"],
    "البتاويين": ["بتاويين", "البتاوين", "بتاوين"],
    "عقدة الصقور": ["عقدة صقور", "عقده الصقور", "عقده صقور"],
    "حي الجامعة": ["جامعة", "الجامعه", "جامعه"],
    "حي البنوك": ["بنوك", "البنوك", "حي البنوك"],
    "حي المهندسين": ["مهندسين", "المهندسين"],
    "حي الطب": ["طب", "الطب", "كلية الطب"],
    "حي المعلمين": ["معلمين", "المعلمين"],
    "حي العدالة": ["عدالة", "العداله", "عداله"],
    "حي دمشق": ["دمشق", "دمشق بغداد"],
    "حي بابل": ["بابل", "بابل بغداد"],
    "حي الأطباء": ["اطباء", "الاطباء"],
    "حي القضاة": ["قضاة", "القضاه", "قضاه"],
    "حي السفراء": ["سفراء", "السفراء"],
    "حي الدبلوماسيين": ["دبلوماسيين", "الدبلوماسيين"],
    "مقديشيو": ["مقديشو", "مقديشيو"],
    "الصابئة": ["صابئة", "الصابئه", "صابئه"]
  }'::jsonb;
  
  RETURN QUERY
  WITH search_results AS (
    -- البحث المباشر بالاسم الكامل
    SELECT 
      rc.id as region_id,
      rc.name as region_name,
      rc.city_id,
      cc.name as city_name,
      'exact' as match_type,
      1.0 as confidence
    FROM regions_cache rc
    JOIN cities_cache cc ON rc.city_id = cc.id
    WHERE rc.is_active = true
      AND cc.is_active = true
      AND lower(rc.name) = normalized_search
      AND (preferred_city_id IS NULL OR rc.city_id = preferred_city_id)
      
    UNION ALL
    
    -- البحث بالمرادفات
    SELECT 
      rc.id as region_id,
      rc.name as region_name,
      rc.city_id,
      cc.name as city_name,
      'synonym' as match_type,
      0.95 as confidence
    FROM regions_cache rc
    JOIN cities_cache cc ON rc.city_id = cc.id
    CROSS JOIN jsonb_each_text(synonyms_map) as syn(canonical, variants)
    WHERE rc.is_active = true
      AND cc.is_active = true
      AND lower(rc.name) = syn.canonical
      AND syn.variants::jsonb ? normalized_search
      AND (preferred_city_id IS NULL OR rc.city_id = preferred_city_id)
      
    UNION ALL
    
    -- البحث الجزئي في بداية الاسم
    SELECT 
      rc.id as region_id,
      rc.name as region_name,
      rc.city_id,
      cc.name as city_name,
      'prefix' as match_type,
      0.8 as confidence
    FROM regions_cache rc
    JOIN cities_cache cc ON rc.city_id = cc.id
    WHERE rc.is_active = true
      AND cc.is_active = true
      AND lower(rc.name) LIKE normalized_search || '%'
      AND lower(rc.name) != normalized_search
      AND (preferred_city_id IS NULL OR rc.city_id = preferred_city_id)
      
    UNION ALL
    
    -- البحث الجزئي في أي مكان
    SELECT 
      rc.id as region_id,
      rc.name as region_name,
      rc.city_id,
      cc.name as city_name,
      'partial' as match_type,
      0.6 as confidence
    FROM regions_cache rc
    JOIN cities_cache cc ON rc.city_id = cc.id
    WHERE rc.is_active = true
      AND cc.is_active = true
      AND lower(rc.name) LIKE '%' || normalized_search || '%'
      AND lower(rc.name) NOT LIKE normalized_search || '%'
      AND lower(rc.name) != normalized_search
      AND (preferred_city_id IS NULL OR rc.city_id = preferred_city_id)
      
    UNION ALL
    
    -- البحث التقريبي للكلمات المشابهة
    SELECT 
      rc.id as region_id,
      rc.name as region_name,
      rc.city_id,
      cc.name as city_name,
      'fuzzy' as match_type,
      0.4 as confidence
    FROM regions_cache rc
    JOIN cities_cache cc ON rc.city_id = cc.id
    WHERE rc.is_active = true
      AND cc.is_active = true
      AND levenshtein(lower(rc.name), normalized_search) <= 2
      AND lower(rc.name) NOT LIKE '%' || normalized_search || '%'
      AND (preferred_city_id IS NULL OR rc.city_id = preferred_city_id)
  )
  SELECT DISTINCT ON (sr.region_id)
    sr.region_id,
    sr.region_name,
    sr.city_id,
    sr.city_name,
    sr.match_type,
    sr.confidence
  FROM search_results sr
  ORDER BY sr.region_id, sr.confidence DESC, sr.region_name
  LIMIT 5;
END;
$function$;

-- إضافة extension للبحث التقريبي إذا لم يكن موجوداً
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;