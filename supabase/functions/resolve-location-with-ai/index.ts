import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LocationResult {
  city_id: number | null;
  region_id: number | null;
  city_name: string | null;
  region_name: string | null;
  confidence: number;
  suggestions: Array<{city: string, region?: string, confidence: number}>;
  raw_input: string;
  used_learning: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location_text } = await req.json();
    
    if (!location_text || location_text.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'location_text مطلوب' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // التحقق من أن النص ليس رقم هاتف ✅
    if (/^[\d\s+()-]{7,}$/.test(location_text.trim())) {
      return new Response(
        JSON.stringify({ 
          error: 'النص المرسل يبدو كرقم هاتف وليس عنواناً',
          city_id: null,
          region_id: null,
          city_name: null,
          region_name: null,
          confidence: 0,
          suggestions: [],
          used_learning: false
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('📍 معالجة الموقع:', location_text);

    const normalizedInput = location_text.trim().toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[،,]/g, ' ');

    // 🧠 المرحلة 1: البحث في أنماط التعلم أولاً (سريع جداً!)
    console.log('🧠 البحث في أنماط التعلم...');
    const { data: learnedPattern } = await supabase
      .from('location_learning_patterns')
      .select('*, cities_cache!inner(name), regions_cache(name)')
      .eq('normalized_pattern', normalizedInput)
      .gte('confidence', 0.85)
      .order('usage_count', { ascending: false })
      .limit(1)
      .single();

    if (learnedPattern) {
      console.log('✅ تم العثور على نمط متعلم!');
      
      // تحديث usage_count
      await supabase
        .from('location_learning_patterns')
        .update({ 
          usage_count: learnedPattern.usage_count + 1,
          last_used_at: new Date().toISOString()
        })
        .eq('id', learnedPattern.id);

      return new Response(
        JSON.stringify({
          city_id: learnedPattern.resolved_city_id,
          region_id: learnedPattern.resolved_region_id,
          city_name: learnedPattern.cities_cache.name,
          region_name: learnedPattern.regions_cache?.name || null,
          confidence: learnedPattern.confidence,
          suggestions: [],
          raw_input: location_text,
          used_learning: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // المرحلة 2: جلب المدن والمناطق من قاعدة البيانات
    const { data: cities, error: citiesError } = await supabase
      .from('cities_cache')
      .select('id, name, alwaseet_id')
      .eq('is_active', true);

    const { data: regions, error: regionsError } = await supabase
      .from('regions_cache')
      .select('id, name, city_id, alwaseet_id')
      .eq('is_active', true);

    if (citiesError || regionsError) {
      throw new Error('فشل في جلب بيانات المدن والمناطق');
    }

    // المرحلة 3: جلب المرادفات من city_aliases
    const { data: aliases } = await supabase
      .from('city_aliases')
      .select('alias_name, city_id, normalized_name, confidence_score');

    // المرحلة 4: محاولة المطابقة المباشرة
    const parts = normalizedInput.split(/[-،,\s]+/).filter(p => p.length > 0);
    console.log('📝 أجزاء النص:', parts);

    let cityMatch = null;
    let regionMatch = null;
    let directMatchConfidence = 0;

    for (const part of parts) {
      if (!cityMatch) {
        // البحث في المدن
        cityMatch = cities?.find(c => 
          c.name.toLowerCase() === part || 
          c.name.toLowerCase().includes(part) ||
          part.includes(c.name.toLowerCase())
        );
        
        // البحث في المرادفات
        if (!cityMatch && aliases) {
          const aliasMatch = aliases.find(a => 
            a.normalized_name.toLowerCase() === part ||
            a.alias_name.toLowerCase() === part
          );
          if (aliasMatch) {
            cityMatch = cities?.find(c => c.id === aliasMatch.city_id);
            directMatchConfidence += (aliasMatch.confidence_score || 0.5);
          }
        }
        
        if (cityMatch) directMatchConfidence += 0.5;
      }
      
      if (cityMatch && !regionMatch) {
        regionMatch = regions?.find(r => 
          r.city_id === cityMatch.id && (
            r.name.toLowerCase() === part ||
            r.name.toLowerCase().includes(part) ||
            part.includes(r.name.toLowerCase())
          )
        );
        if (regionMatch) directMatchConfidence += 0.5;
      }
    }

    if (cityMatch && directMatchConfidence >= 0.5) {
      const result: LocationResult = {
        city_id: cityMatch.id,
        region_id: regionMatch?.id || null,
        city_name: cityMatch.name,
        region_name: regionMatch?.name || null,
        confidence: directMatchConfidence,
        suggestions: [],
        raw_input: location_text,
        used_learning: false
      };
      
      console.log('✅ مطابقة مباشرة:', result);
      
      // حفظ النمط في التعلم
      await saveLearnedPattern(supabase, normalizedInput, cityMatch.id, regionMatch?.id, directMatchConfidence);
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // المرحلة 5: استخدام Gemini AI مع الأنماط المتعلمة
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    
    if (!geminiApiKey) {
      console.warn('⚠️ GEMINI_API_KEY غير موجود');
      return new Response(
        JSON.stringify({
          city_id: cityMatch?.id || null,
          region_id: regionMatch?.id || null,
          city_name: cityMatch?.name || null,
          region_name: regionMatch?.name || null,
          confidence: directMatchConfidence,
          suggestions: [],
          raw_input: location_text,
          used_learning: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // جلب أفضل 100 نمط متعلم لتضمينها في الـ prompt
    const { data: topPatterns } = await supabase
      .from('location_learning_patterns')
      .select('pattern_text, cities_cache!inner(name), regions_cache(name)')
      .order('usage_count', { ascending: false })
      .limit(100);

    const learnedExamples = topPatterns?.map(p => 
      `"${p.pattern_text}" → ${p.cities_cache.name}${p.regions_cache ? ' - ' + p.regions_cache.name : ''}`
    ).join('\n') || '';

    const citiesList = cities?.map(c => c.name).join('، ') || '';
    const regionsList = regions?.slice(0, 50).map(r => r.name).join('، ') || '';

    const prompt = `أنت خبير في استخراج المدن والمناطق من النصوص العربية. لديك تجربة تعلم سابقة من ${topPatterns?.length || 0} نمط.

المدن المتاحة: ${citiesList}
أمثلة على المناطق: ${regionsList}

أمثلة من التعلم السابق:
${learnedExamples}

النص المطلوب: "${location_text}"

المطلوب:
1. استخرج اسم المدينة (يجب أن تكون من القائمة)
2. استخرج اسم المنطقة إن وجدت
3. صحح الأخطاء الإملائية (مثال: كراده → الكرادة، بغدد → بغداد)
4. استخدم التعلم السابق لتحسين الدقة

أرجع النتيجة بصيغة JSON فقط:
{
  "city": "اسم المدينة",
  "region": "اسم المنطقة",
  "confidence": 0.95,
  "suggestions": [{"city": "بديل", "region": "منطقة", "confidence": 0.8}]
}`;

    console.log('🤖 استدعاء Gemini AI مع التعلم...');

    const models = ['gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    let aiResponse = null;

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 500 }
            })
          }
        );

        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          const jsonMatch = text?.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            aiResponse = JSON.parse(jsonMatch[0]);
            console.log(`✅ نجح النموذج ${model}`);
            break;
          }
        }
      } catch (error) {
        console.warn(`⚠️ خطأ في النموذج ${model}:`, error.message);
      }
    }

    if (!aiResponse) {
      return new Response(
        JSON.stringify({
          city_id: cityMatch?.id || null,
          region_id: regionMatch?.id || null,
          city_name: cityMatch?.name || null,
          region_name: regionMatch?.name || null,
          confidence: directMatchConfidence,
          suggestions: [],
          raw_input: location_text,
          used_learning: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🎯 نتيجة AI:', aiResponse);

    // مطابقة نتائج AI مع قاعدة البيانات
    const aiCityName = aiResponse.city?.trim().toLowerCase();
    const aiRegionName = aiResponse.region?.trim().toLowerCase();

    const finalCity = cities?.find(c => 
      c.name.toLowerCase() === aiCityName ||
      c.name.toLowerCase().includes(aiCityName) ||
      aiCityName?.includes(c.name.toLowerCase())
    );

    let finalRegion = null;
    if (finalCity && aiRegionName) {
      finalRegion = regions?.find(r => 
        r.city_id === finalCity.id && (
          r.name.toLowerCase() === aiRegionName ||
          r.name.toLowerCase().includes(aiRegionName) ||
          aiRegionName.includes(r.name.toLowerCase())
        )
      );
    }

    const result: LocationResult = {
      city_id: finalCity?.id || null,
      region_id: finalRegion?.id || null,
      city_name: finalCity?.name || aiResponse.city || null,
      region_name: finalRegion?.name || aiResponse.region || null,
      confidence: aiResponse.confidence || 0.5,
      suggestions: (aiResponse.suggestions || []).map((sug: any) => ({
        city: sug.city || '',
        region: sug.region || null,
        confidence: sug.confidence || 0
      })),
      raw_input: location_text,
      used_learning: false
    };

    console.log('✨ النتيجة النهائية:', result);

    // حفظ النمط الجديد في التعلم + إضافة مرادف جديد
    if (finalCity && result.confidence >= 0.7) {
      await saveLearnedPattern(supabase, normalizedInput, finalCity.id, finalRegion?.id, result.confidence);
      
      // إضافة مرادف جديد إذا كان مختلفاً
      if (aiCityName && aiCityName !== finalCity.name.toLowerCase()) {
        await supabase
          .from('city_aliases')
          .upsert({
            city_id: finalCity.id,
            alias_name: aiResponse.city,
            normalized_name: aiCityName,
            confidence_score: result.confidence
          }, { onConflict: 'alias_name' });
        
        console.log('📝 تم إضافة مرادف جديد:', aiResponse.city, '→', finalCity.name);
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ خطأ في resolve-location-with-ai:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        city_id: null,
        region_id: null,
        city_name: null,
        region_name: null,
        confidence: 0,
        suggestions: [],
        used_learning: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// دالة مساعدة لحفظ الأنماط المتعلمة
async function saveLearnedPattern(
  supabase: any, 
  normalizedPattern: string, 
  cityId: number, 
  regionId: number | null, 
  confidence: number
) {
  try {
    await supabase
      .from('location_learning_patterns')
      .upsert({
        pattern_text: normalizedPattern,
        normalized_pattern: normalizedPattern,
        resolved_city_id: cityId,
        resolved_region_id: regionId,
        confidence: confidence,
        usage_count: 1,
        success_rate: 1.0,
        last_used_at: new Date().toISOString()
      }, { 
        onConflict: 'normalized_pattern',
        ignoreDuplicates: false 
      });
    
    console.log('💾 تم حفظ النمط في التعلم');
  } catch (error) {
    console.warn('⚠️ فشل في حفظ النمط:', error.message);
  }
}