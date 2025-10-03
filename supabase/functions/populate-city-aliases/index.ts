import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// قاموس المرادفات الشائعة للمدن العراقية
const iraqCitiesCommonAliases: Record<number, {
  name: string;
  alwaseet_id: number;
  aliases: Array<{ text: string; confidence: number; type: string }>;
}> = {
  1: {
    name: "بغداد",
    alwaseet_id: 1,
    aliases: [
      { text: "baghdad", confidence: 1.0, type: "english" },
      { text: "Baghdad", confidence: 1.0, type: "english" },
      { text: "بقداد", confidence: 0.9, type: "misspelling" },
      { text: "بغدد", confidence: 0.9, type: "misspelling" },
      { text: "بغدا", confidence: 0.9, type: "misspelling" },
      { text: "بقدد", confidence: 0.8, type: "misspelling" },
      { text: "العاصمة", confidence: 1.0, type: "alternative" },
      { text: "عاصمة", confidence: 0.9, type: "alternative" },
      { text: "bgd", confidence: 0.7, type: "abbreviation" },
    ]
  },
  2: {
    name: "البصرة",
    alwaseet_id: 2,
    aliases: [
      { text: "basra", confidence: 1.0, type: "english" },
      { text: "Basra", confidence: 1.0, type: "english" },
      { text: "البصره", confidence: 0.9, type: "misspelling" },
      { text: "بصرة", confidence: 1.0, type: "alternative" },
      { text: "بصره", confidence: 0.9, type: "misspelling" },
      { text: "الفيحاء", confidence: 1.0, type: "alternative" },
      { text: "فيحاء", confidence: 0.9, type: "alternative" },
    ]
  },
  3: {
    name: "نينوى",
    alwaseet_id: 3,
    aliases: [
      { text: "nineveh", confidence: 1.0, type: "english" },
      { text: "Nineveh", confidence: 1.0, type: "english" },
      { text: "ninawa", confidence: 1.0, type: "english" },
      { text: "Ninawa", confidence: 1.0, type: "english" },
      { text: "نينوا", confidence: 0.9, type: "misspelling" },
      { text: "نينوئ", confidence: 0.8, type: "misspelling" },
      { text: "الموصل", confidence: 1.0, type: "alternative" },
      { text: "موصل", confidence: 1.0, type: "alternative" },
      { text: "الحدباء", confidence: 0.9, type: "alternative" },
    ]
  },
  4: {
    name: "أربيل",
    alwaseet_id: 4,
    aliases: [
      { text: "erbil", confidence: 1.0, type: "english" },
      { text: "Erbil", confidence: 1.0, type: "english" },
      { text: "arbil", confidence: 1.0, type: "english" },
      { text: "Arbil", confidence: 1.0, type: "english" },
      { text: "اربيل", confidence: 1.0, type: "alternative" },
      { text: "اربل", confidence: 0.9, type: "misspelling" },
      { text: "أربل", confidence: 0.9, type: "misspelling" },
      { text: "هولير", confidence: 0.9, type: "kurdish" },
      { text: "هەولێر", confidence: 0.9, type: "kurdish" },
    ]
  },
  5: {
    name: "السليمانية",
    alwaseet_id: 5,
    aliases: [
      { text: "sulaymaniyah", confidence: 1.0, type: "english" },
      { text: "Sulaymaniyah", confidence: 1.0, type: "english" },
      { text: "sulaimaniya", confidence: 1.0, type: "english" },
      { text: "Sulaimaniya", confidence: 1.0, type: "english" },
      { text: "سليمانيه", confidence: 0.9, type: "misspelling" },
      { text: "سليمانية", confidence: 1.0, type: "alternative" },
      { text: "سليماني", confidence: 0.8, type: "misspelling" },
      { text: "سلێمانی", confidence: 0.9, type: "kurdish" },
    ]
  },
  6: {
    name: "دهوك",
    alwaseet_id: 6,
    aliases: [
      { text: "duhok", confidence: 1.0, type: "english" },
      { text: "Duhok", confidence: 1.0, type: "english" },
      { text: "dahuk", confidence: 1.0, type: "english" },
      { text: "Dahuk", confidence: 1.0, type: "english" },
      { text: "دهوك", confidence: 1.0, type: "alternative" },
      { text: "دهوق", confidence: 0.9, type: "misspelling" },
      { text: "دهوگ", confidence: 0.8, type: "misspelling" },
      { text: "دهۆك", confidence: 0.9, type: "kurdish" },
    ]
  },
  7: {
    name: "كركوك",
    alwaseet_id: 7,
    aliases: [
      { text: "kirkuk", confidence: 1.0, type: "english" },
      { text: "Kirkuk", confidence: 1.0, type: "english" },
      { text: "karkuk", confidence: 0.9, type: "english" },
      { text: "Karkuk", confidence: 0.9, type: "english" },
      { text: "كرکوک", confidence: 0.9, type: "misspelling" },
      { text: "كركوگ", confidence: 0.8, type: "misspelling" },
      { text: "کرکوک", confidence: 0.9, type: "kurdish" },
    ]
  },
  8: {
    name: "الأنبار",
    alwaseet_id: 8,
    aliases: [
      { text: "anbar", confidence: 1.0, type: "english" },
      { text: "Anbar", confidence: 1.0, type: "english" },
      { text: "al-anbar", confidence: 1.0, type: "english" },
      { text: "Al-Anbar", confidence: 1.0, type: "english" },
      { text: "الانبار", confidence: 1.0, type: "alternative" },
      { text: "انبار", confidence: 1.0, type: "alternative" },
      { text: "الرمادي", confidence: 0.9, type: "alternative" },
      { text: "رمادي", confidence: 0.9, type: "alternative" },
    ]
  },
  9: {
    name: "صلاح الدين",
    alwaseet_id: 9,
    aliases: [
      { text: "salahuddin", confidence: 1.0, type: "english" },
      { text: "Salahuddin", confidence: 1.0, type: "english" },
      { text: "salah al-din", confidence: 1.0, type: "english" },
      { text: "Salah Al-Din", confidence: 1.0, type: "english" },
      { text: "صلاح", confidence: 0.8, type: "abbreviation" },
      { text: "صلاحدين", confidence: 0.9, type: "misspelling" },
      { text: "تكريت", confidence: 0.9, type: "alternative" },
      { text: "tikrit", confidence: 0.9, type: "english" },
    ]
  },
  10: {
    name: "ديالى",
    alwaseet_id: 10,
    aliases: [
      { text: "diyala", confidence: 1.0, type: "english" },
      { text: "Diyala", confidence: 1.0, type: "english" },
      { text: "diyali", confidence: 0.9, type: "english" },
      { text: "Diyali", confidence: 0.9, type: "english" },
      { text: "ديالا", confidence: 0.9, type: "misspelling" },
      { text: "ديالي", confidence: 0.9, type: "misspelling" },
      { text: "بعقوبة", confidence: 0.9, type: "alternative" },
      { text: "بعقوبه", confidence: 0.8, type: "misspelling" },
    ]
  },
  11: {
    name: "واسط",
    alwaseet_id: 11,
    aliases: [
      { text: "wasit", confidence: 1.0, type: "english" },
      { text: "Wasit", confidence: 1.0, type: "english" },
      { text: "waset", confidence: 0.9, type: "english" },
      { text: "Waset", confidence: 0.9, type: "english" },
      { text: "واسيط", confidence: 0.8, type: "misspelling" },
      { text: "الكوت", confidence: 1.0, type: "alternative" },
      { text: "كوت", confidence: 1.0, type: "alternative" },
      { text: "الكوط", confidence: 0.8, type: "misspelling" },
    ]
  },
  12: {
    name: "بابل",
    alwaseet_id: 12,
    aliases: [
      { text: "babylon", confidence: 1.0, type: "english" },
      { text: "Babylon", confidence: 1.0, type: "english" },
      { text: "babil", confidence: 1.0, type: "english" },
      { text: "Babil", confidence: 1.0, type: "english" },
      { text: "بابيل", confidence: 0.9, type: "misspelling" },
      { text: "الحلة", confidence: 1.0, type: "alternative" },
      { text: "حلة", confidence: 1.0, type: "alternative" },
      { text: "الحله", confidence: 0.9, type: "misspelling" },
    ]
  },
  13: {
    name: "كربلاء",
    alwaseet_id: 13,
    aliases: [
      { text: "karbala", confidence: 1.0, type: "english" },
      { text: "Karbala", confidence: 1.0, type: "english" },
      { text: "kerbala", confidence: 0.9, type: "english" },
      { text: "Kerbala", confidence: 0.9, type: "english" },
      { text: "كربلائ", confidence: 0.9, type: "misspelling" },
      { text: "کربلاء", confidence: 0.9, type: "misspelling" },
      { text: "كربله", confidence: 0.8, type: "misspelling" },
      { text: "كربل", confidence: 0.7, type: "abbreviation" },
    ]
  },
  14: {
    name: "النجف",
    alwaseet_id: 14,
    aliases: [
      { text: "najaf", confidence: 1.0, type: "english" },
      { text: "Najaf", confidence: 1.0, type: "english" },
      { text: "an-najaf", confidence: 1.0, type: "english" },
      { text: "An-Najaf", confidence: 1.0, type: "english" },
      { text: "النجاف", confidence: 0.9, type: "misspelling" },
      { text: "نجف", confidence: 1.0, type: "alternative" },
      { text: "نجاف", confidence: 0.8, type: "misspelling" },
      { text: "النجف الاشرف", confidence: 1.0, type: "alternative" },
    ]
  },
  15: {
    name: "القادسية",
    alwaseet_id: 15,
    aliases: [
      { text: "qadisiyyah", confidence: 1.0, type: "english" },
      { text: "Qadisiyyah", confidence: 1.0, type: "english" },
      { text: "al-qadisiyyah", confidence: 1.0, type: "english" },
      { text: "Al-Qadisiyyah", confidence: 1.0, type: "english" },
      { text: "القادسيه", confidence: 0.9, type: "misspelling" },
      { text: "قادسية", confidence: 1.0, type: "alternative" },
      { text: "الديوانية", confidence: 1.0, type: "alternative" },
      { text: "ديوانية", confidence: 1.0, type: "alternative" },
      { text: "الديوانيه", confidence: 0.9, type: "misspelling" },
    ]
  },
  16: {
    name: "المثنى",
    alwaseet_id: 16,
    aliases: [
      { text: "muthanna", confidence: 1.0, type: "english" },
      { text: "Muthanna", confidence: 1.0, type: "english" },
      { text: "al-muthanna", confidence: 1.0, type: "english" },
      { text: "Al-Muthanna", confidence: 1.0, type: "english" },
      { text: "المثنا", confidence: 0.9, type: "misspelling" },
      { text: "مثنى", confidence: 1.0, type: "alternative" },
      { text: "السماوة", confidence: 1.0, type: "alternative" },
      { text: "سماوة", confidence: 1.0, type: "alternative" },
      { text: "السماوه", confidence: 0.9, type: "misspelling" },
    ]
  },
  17: {
    name: "ذي قار",
    alwaseet_id: 17,
    aliases: [
      { text: "dhi qar", confidence: 1.0, type: "english" },
      { text: "Dhi Qar", confidence: 1.0, type: "english" },
      { text: "thi-qar", confidence: 0.9, type: "english" },
      { text: "Thi-Qar", confidence: 0.9, type: "english" },
      { text: "ذيقار", confidence: 1.0, type: "alternative" },
      { text: "ذي قر", confidence: 0.9, type: "misspelling" },
      { text: "الناصرية", confidence: 1.0, type: "alternative" },
      { text: "ناصرية", confidence: 1.0, type: "alternative" },
      { text: "الناصريه", confidence: 0.9, type: "misspelling" },
    ]
  },
  18: {
    name: "ميسان",
    alwaseet_id: 18,
    aliases: [
      { text: "maysan", confidence: 1.0, type: "english" },
      { text: "Maysan", confidence: 1.0, type: "english" },
      { text: "misan", confidence: 0.9, type: "english" },
      { text: "Misan", confidence: 0.9, type: "english" },
      { text: "ميسن", confidence: 0.9, type: "misspelling" },
      { text: "العمارة", confidence: 1.0, type: "alternative" },
      { text: "عمارة", confidence: 1.0, type: "alternative" },
      { text: "العماره", confidence: 0.9, type: "misspelling" },
      { text: "عماره", confidence: 0.8, type: "misspelling" },
    ]
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // جلب جميع المدن من قاعدة البيانات
    const { data: cities, error: citiesError } = await supabaseClient
      .from('cities_cache')
      .select('id, name, alwaseet_id');

    if (citiesError) throw citiesError;

    let totalAdded = 0;
    let totalSkipped = 0;
    const results: any[] = [];

    for (const city of cities || []) {
      const cityAliasData = Object.values(iraqCitiesCommonAliases).find(
        c => c.alwaseet_id === city.alwaseet_id
      );

      if (!cityAliasData) {
        results.push({
          city: city.name,
          status: 'no_aliases_found',
          added: 0,
          skipped: 0
        });
        continue;
      }

      // التحقق من المرادفات الموجودة
      const aliasNames = cityAliasData.aliases.map(a => a.text);
      const { data: existingAliases } = await supabaseClient
        .from('city_aliases')
        .select('alias_name')
        .eq('city_id', city.id)
        .in('alias_name', aliasNames);

      const existingAliasNames = existingAliases?.map(a => a.alias_name) || [];
      const newAliasesToAdd = cityAliasData.aliases.filter(
        a => !existingAliasNames.includes(a.text)
      );

      if (newAliasesToAdd.length === 0) {
        results.push({
          city: city.name,
          status: 'all_exist',
          added: 0,
          skipped: cityAliasData.aliases.length
        });
        totalSkipped += cityAliasData.aliases.length;
        continue;
      }

      // إضافة المرادفات الجديدة
      const aliasObjects = newAliasesToAdd.map(alias => ({
        city_id: city.id,
        alias_name: alias.text,
        normalized_name: alias.text.toLowerCase()
          .replace(/[أإآ]/g, 'ا')
          .replace(/[ة]/g, 'ه'),
        confidence_score: alias.confidence
      }));

      const { error: insertError } = await supabaseClient
        .from('city_aliases')
        .insert(aliasObjects);

      if (insertError) {
        results.push({
          city: city.name,
          status: 'error',
          error: insertError.message,
          added: 0,
          skipped: 0
        });
        continue;
      }

      const addedCount = newAliasesToAdd.length;
      const skippedCount = cityAliasData.aliases.length - addedCount;

      totalAdded += addedCount;
      totalSkipped += skippedCount;

      results.push({
        city: city.name,
        status: 'success',
        added: addedCount,
        skipped: skippedCount
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_added: totalAdded,
          total_skipped: totalSkipped,
          cities_processed: cities?.length || 0
        },
        details: results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
