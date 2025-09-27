-- إضافة المزيد من المرادفات لمناطق بغداد الشائعة (بدون ON CONFLICT)
DO $$
DECLARE
    v_region_record RECORD;
    v_aliases TEXT[];
    v_alias TEXT;
BEGIN
    -- قائمة المرادفات التي نريد إضافتها
    v_aliases := ARRAY[
        'دورة صحة', 'الدورة الصحة', 'دوره صحه', 'دورة الصحة',
        'المنصور', 'منصور', 'المنصوور', 'منصوور',
        'الجادرية', 'جادرية', 'جادريه', 'الجادريه',
        'الكرادة', 'كرادة', 'كراده', 'الكراده',
        'الكاظمية', 'كاظمية', 'كاظميه', 'الكاظميه',
        'الاعظمية', 'اعظمية', 'اعظميه', 'الاعظميه',
        'الشعلة', 'شعلة', 'شعله', 'الشعله',
        'المعمل', 'معمل', 'المعامل', 'معامل',
        'بغداد الجديدة', 'بغداد جديدة', 'بغداد الجديده', 'بغداد جديده',
        'الزعفرانية', 'زعفرانية', 'زعفرانيه', 'الزعفرانيه',
        'الشالجية', 'شالجية', 'شالجيه', 'الشالجيه',
        'الطالبية', 'طالبية', 'طالبيه', 'الطالبيه',
        'العامرية', 'عامرية', 'عامريه', 'العامريه',
        'الحرية', 'حرية', 'حريه', 'الحريه',
        'المشتل', 'مشتل', 'المشاتل', 'مشاتل',
        'الرصافة', 'رصافة', 'رصافه', 'الرصافه',
        'الكرخ', 'كرخ',
        'الدورة', 'دورة', 'دوره', 'الدوره'
    ];

    -- التكرار عبر جميع مناطق بغداد
    FOR v_region_record IN 
        SELECT rc.id, rc.name 
        FROM regions_cache rc
        JOIN cities_cache cc ON rc.city_id = cc.id
        WHERE cc.name = 'بغداد' 
          AND rc.is_active = true
    LOOP
        -- إضافة مرادفات لكل منطقة
        FOREACH v_alias IN ARRAY v_aliases
        LOOP
            -- فحص إذا كان المرادف مشابه لاسم المنطقة
            IF lower(v_alias) SIMILAR TO '%' || lower(v_region_record.name) || '%' 
               OR lower(v_region_record.name) SIMILAR TO '%' || lower(v_alias) || '%' THEN
                
                -- إدراج المرادف فقط إذا لم يكن موجود
                INSERT INTO region_aliases (region_id, alias_name, normalized_name, confidence_score)
                SELECT v_region_record.id, v_alias, v_alias, 0.9
                WHERE NOT EXISTS (
                    SELECT 1 FROM region_aliases 
                    WHERE region_id = v_region_record.id 
                    AND alias_name = v_alias
                );
            END IF;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'تم إضافة المرادفات لمناطق بغداد بنجاح';
END $$;