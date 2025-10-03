import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// مرادفات ذكية لمناطق السماوة
const samawahRegionAliases: Record<string, Array<{alias: string, confidence: number}>> = {
  "السماوة المركز": [
    { alias: "السماوة", confidence: 1.0 },
    { alias: "المركز", confidence: 0.9 },
    { alias: "مركز السماوة", confidence: 1.0 },
    { alias: "وسط المدينة", confidence: 0.8 },
    { alias: "وسط السماوة", confidence: 0.9 },
    { alias: "سماوة مركز", confidence: 0.9 },
  ],
  "الرميثة": [
    { alias: "الرميثه", confidence: 1.0 },
    { alias: "رميثة", confidence: 1.0 },
    { alias: "رميثه", confidence: 0.9 },
    { alias: "الرميته", confidence: 0.8 },
    { alias: "روميثة", confidence: 0.7 },
  ],
  "الخضر": [
    { alias: "الخضر", confidence: 1.0 },
    { alias: "خضر", confidence: 0.9 },
    { alias: "الخظر", confidence: 0.8 },
    { alias: "خظر", confidence: 0.7 },
  ],
  "السلمان": [
    { alias: "السلمان", confidence: 1.0 },
    { alias: "سلمان", confidence: 0.9 },
    { alias: "السليمان", confidence: 0.7 },
  ],
  "الوركاء": [
    { alias: "الوركاء", confidence: 1.0 },
    { alias: "وركاء", confidence: 0.9 },
    { alias: "الوركا", confidence: 0.8 },
    { alias: "وركا", confidence: 0.7 },
  ],
  "بزايز الاثير": [
    { alias: "بزايز", confidence: 0.9 },
    { alias: "بزايز الاثير", confidence: 1.0 },
    { alias: "بزايز الآثير", confidence: 0.9 },
    { alias: "الاثير", confidence: 0.8 },
    { alias: "الآثير", confidence: 0.8 },
  ],
  "حي الامير": [
    { alias: "حي الامير", confidence: 1.0 },
    { alias: "الامير", confidence: 0.9 },
    { alias: "حي الأمير", confidence: 1.0 },
    { alias: "الأمير", confidence: 0.9 },
  ],
  "حي الجهاد": [
    { alias: "حي الجهاد", confidence: 1.0 },
    { alias: "الجهاد", confidence: 0.9 },
    { alias: "جهاد", confidence: 0.8 },
  ],
  "حي الثقافة": [
    { alias: "حي الثقافة", confidence: 1.0 },
    { alias: "الثقافة", confidence: 0.9 },
    { alias: "ثقافة", confidence: 0.8 },
    { alias: "حي الثقافه", confidence: 0.9 },
  ],
  "حي الجمهورية": [
    { alias: "حي الجمهورية", confidence: 1.0 },
    { alias: "الجمهورية", confidence: 0.9 },
    { alias: "جمهورية", confidence: 0.8 },
    { alias: "حي الجمهوريه", confidence: 0.9 },
  ],
  "حي الحسين": [
    { alias: "حي الحسين", confidence: 1.0 },
    { alias: "الحسين", confidence: 0.9 },
    { alias: "حسين", confidence: 0.8 },
  ],
  "حي العروبة": [
    { alias: "حي العروبة", confidence: 1.0 },
    { alias: "العروبة", confidence: 0.9 },
    { alias: "عروبة", confidence: 0.8 },
    { alias: "حي العروبه", confidence: 0.9 },
  ],
  "حي المعلمين": [
    { alias: "حي المعلمين", confidence: 1.0 },
    { alias: "المعلمين", confidence: 0.9 },
    { alias: "معلمين", confidence: 0.8 },
  ],
  "حي النصر": [
    { alias: "حي النصر", confidence: 1.0 },
    { alias: "النصر", confidence: 0.9 },
    { alias: "نصر", confidence: 0.8 },
  ],
  "حي الوحدة": [
    { alias: "حي الوحدة", confidence: 1.0 },
    { alias: "الوحدة", confidence: 0.9 },
    { alias: "وحدة", confidence: 0.8 },
    { alias: "حي الوحده", confidence: 0.9 },
  ],
  "حي الاسكان": [
    { alias: "حي الاسكان", confidence: 1.0 },
    { alias: "الاسكان", confidence: 0.9 },
    { alias: "اسكان", confidence: 0.8 },
    { alias: "حي الإسكان", confidence: 1.0 },
    { alias: "الإسكان", confidence: 0.9 },
  ],
  "المنطقة الصناعية": [
    { alias: "المنطقة الصناعية", confidence: 1.0 },
    { alias: "الصناعية", confidence: 0.9 },
    { alias: "صناعية", confidence: 0.8 },
    { alias: "المنطقه الصناعيه", confidence: 0.9 },
  ],
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // الحصول على id مدينة السماوة
    const { data: samawahCity, error: cityError } = await supabase
      .from('cities_cache')
      .select('id')
      .eq('name', 'السماوة')
      .single();

    if (cityError || !samawahCity) {
      throw new Error('لم يتم العثور على مدينة السماوة');
    }

    const samawahCityId = samawahCity.id;

    // الحصول على جميع مناطق السماوة
    const { data: regions, error: regionsError } = await supabase
      .from('regions_cache')
      .select('id, name')
      .eq('city_id', samawahCityId);

    if (regionsError) {
      throw regionsError;
    }

    // الحصول على المرادفات الموجودة لتجنب التكرار
    const { data: existingAliases } = await supabase
      .from('region_aliases')
      .select('alias_name, region_id');

    const existingAliasSet = new Set(
      (existingAliases || []).map(a => `${a.region_id}_${a.alias_name.toLowerCase()}`)
    );

    let totalAdded = 0;
    const aliasesToInsert = [];

    // إضافة المرادفات لكل منطقة
    for (const region of regions || []) {
      const regionAliases = samawahRegionAliases[region.name] || [];
      
      for (const aliasObj of regionAliases) {
        const key = `${region.id}_${aliasObj.alias.toLowerCase()}`;
        
        // تجنب المرادفات المكررة
        if (!existingAliasSet.has(key)) {
          aliasesToInsert.push({
            region_id: region.id,
            alias_name: aliasObj.alias,
            normalized_name: aliasObj.alias.toLowerCase().trim(),
            confidence_score: aliasObj.confidence,
          });
          existingAliasSet.add(key);
          totalAdded++;
        }
      }
    }

    // إدراج المرادفات الجديدة
    if (aliasesToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('region_aliases')
        .insert(aliasesToInsert);

      if (insertError) {
        throw insertError;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalAdded,
        message: `تمت إضافة ${totalAdded} مرادف جديد لمناطق السماوة`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error populating Samawah region aliases:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
