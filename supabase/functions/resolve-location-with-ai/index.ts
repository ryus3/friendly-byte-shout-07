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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('📍 معالجة الموقع:', location_text);

    // 1. جلب المدن والمناطق من قاعدة البيانات
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

    // 2. محاولة المطابقة المباشرة أولاً
    const normalizedText = location_text.trim().toLowerCase();
    const parts = normalizedText.split(/[-،,\s]+/).filter(p => p.length > 0);
    
    console.log('📝 أجزاء النص:', parts);

    let cityMatch = null;
    let regionMatch = null;
    let directMatchConfidence = 0;

    // محاولة المطابقة المباشرة
    for (const part of parts) {
      if (!cityMatch) {
        cityMatch = cities?.find(c => 
          c.name.toLowerCase() === part || 
          c.name.toLowerCase().includes(part) ||
          part.includes(c.name.toLowerCase())
        );
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

    // إذا وجدنا مطابقة مباشرة جيدة، نرجعها
    if (cityMatch && directMatchConfidence >= 0.5) {
      const result: LocationResult = {
        city_id: cityMatch.id,
        region_id: regionMatch?.id || null,
        city_name: cityMatch.name,
        region_name: regionMatch?.name || null,
        confidence: directMatchConfidence,
        suggestions: [],
        raw_input: location_text
      };
      
      console.log('✅ مطابقة مباشرة:', result);
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. استخدام Gemini AI للمعالجة المتقدمة
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    
    if (!geminiApiKey) {
      console.warn('⚠️ GEMINI_API_KEY غير موجود، استخدام المطابقة البسيطة');
      
      const result: LocationResult = {
        city_id: cityMatch?.id || null,
        region_id: regionMatch?.id || null,
        city_name: cityMatch?.name || null,
        region_name: regionMatch?.name || null,
        confidence: directMatchConfidence,
        suggestions: [],
        raw_input: location_text
      };
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // إعداد prompt للذكاء الاصطناعي
    const citiesList = cities?.map(c => c.name).join('، ') || '';
    const regionsList = regions?.slice(0, 50).map(r => r.name).join('، ') || '';

    const prompt = `أنت خبير في استخراج المدن والمناطق من النصوص العربية.

المدن المتاحة: ${citiesList}
أمثلة على المناطق: ${regionsList}

النص المطلوب: "${location_text}"

المطلوب:
1. استخرج اسم المدينة (يجب أن تكون من القائمة)
2. استخرج اسم المنطقة إن وجدت
3. صحح الأخطاء الإملائية (مثال: كراده → الكرادة، بغدد → بغداد)
4. اقترح 2-3 بدائل محتملة إذا كان النص غامضاً

أرجع النتيجة بصيغة JSON فقط، بدون أي نص إضافي:
{
  "city": "اسم المدينة",
  "region": "اسم المنطقة",
  "confidence": 0.95,
  "suggestions": [
    {"city": "بديل 1", "region": "منطقة بديلة", "confidence": 0.8}
  ]
}`;

    console.log('🤖 استدعاء Gemini AI...');

    // محاولة مع نماذج Gemini المختلفة (Fallback)
    const models = [
      'gemini-2.0-flash-exp',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ];

    let aiResponse = null;
    let lastError = null;

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: prompt }]
              }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 500,
              }
            })
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`⚠️ فشل النموذج ${model}:`, errorText);
          lastError = errorText;
          continue;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) {
          console.warn(`⚠️ لا يوجد نص من النموذج ${model}`);
          continue;
        }

        console.log(`✅ نجح النموذج ${model}`);
        
        // استخراج JSON من النص
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiResponse = JSON.parse(jsonMatch[0]);
          break;
        }
      } catch (error) {
        console.warn(`⚠️ خطأ في النموذج ${model}:`, error.message);
        lastError = error.message;
      }
    }

    if (!aiResponse) {
      console.error('❌ فشلت جميع نماذج Gemini:', lastError);
      
      // استخدام المطابقة البسيطة كـ fallback
      const result: LocationResult = {
        city_id: cityMatch?.id || null,
        region_id: regionMatch?.id || null,
        city_name: cityMatch?.name || null,
        region_name: regionMatch?.name || null,
        confidence: directMatchConfidence,
        suggestions: [],
        raw_input: location_text
      };
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🎯 نتيجة AI:', aiResponse);

    // 4. مطابقة نتائج AI مع قاعدة البيانات
    const aiCityName = aiResponse.city?.trim().toLowerCase();
    const aiRegionName = aiResponse.region?.trim().toLowerCase();

    const finalCity = cities?.find(c => 
      c.name.toLowerCase() === aiCityName ||
      c.name.toLowerCase().includes(aiCityName) ||
      aiCityName.includes(c.name.toLowerCase())
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

    // معالجة الاقتراحات
    const suggestions = (aiResponse.suggestions || []).map((sug: any) => ({
      city: sug.city || '',
      region: sug.region || null,
      confidence: sug.confidence || 0
    }));

    const result: LocationResult = {
      city_id: finalCity?.id || null,
      region_id: finalRegion?.id || null,
      city_name: finalCity?.name || aiResponse.city || null,
      region_name: finalRegion?.name || aiResponse.region || null,
      confidence: aiResponse.confidence || 0.5,
      suggestions,
      raw_input: location_text
    };

    console.log('✨ النتيجة النهائية:', result);

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
        suggestions: []
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
