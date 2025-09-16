import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlWaseetCity {
  id: number;
  name: string;
  name_ar?: string;
  name_en?: string;
}

interface AlWaseetRegion {
  id: number;
  city_id: number;
  name: string;
  name_ar?: string;
  name_en?: string;
}

async function fetchCitiesFromAlWaseet(token: string): Promise<AlWaseetCity[]> {
  try {
    const { data, error } = await supabase.functions.invoke('alwaseet-proxy', {
      body: { 
        endpoint: 'citys', 
        method: 'GET', 
        token: token 
      }
    });

    if (error) {
      console.error('❌ خطأ في جلب المدن من الوسيط:', error);
      throw new Error(`فشل جلب المدن: ${error.message}`);
    }

    if (!data || !Array.isArray(data)) {
      console.error('❌ البيانات المستلمة غير صحيحة:', data);
      throw new Error('البيانات المستلمة من الوسيط غير صحيحة');
    }

    console.log(`✅ تم جلب ${data.length} مدينة من الوسيط`);
    return data;
  } catch (error) {
    console.error('❌ خطأ في الاتصال بواجهة الوسيط:', error);
    throw error;
  }
}

async function fetchRegionsFromAlWaseet(token: string, cityId: number): Promise<AlWaseetRegion[]> {
  try {
    const { data, error } = await supabase.functions.invoke('alwaseet-proxy', {
      body: { 
        endpoint: 'regions', 
        method: 'GET', 
        token: token,
        queryParams: { city_id: cityId }
      }
    });

    if (error) {
      console.error(`❌ خطأ في جلب مناطق المدينة ${cityId}:`, error);
      return []; // لا نفشل التحديث بسبب مدينة واحدة
    }

    if (!data || !Array.isArray(data)) {
      console.log(`⚠️ لا توجد مناطق للمدينة ${cityId}`);
      return [];
    }

    return data.map(region => ({
      ...region,
      city_id: cityId
    }));
  } catch (error) {
    console.error(`❌ خطأ في جلب مناطق المدينة ${cityId}:`, error);
    return [];
  }
}

async function updateCitiesCache(cities: AlWaseetCity[]): Promise<number> {
  let updatedCount = 0;
  
  for (const city of cities) {
    try {
      const { error } = await supabase
        .from('cities_cache')
        .upsert({
          alwaseet_id: city.id,
          name: city.name,
          name_ar: city.name_ar || city.name,
          name_en: city.name_en || null,
          is_active: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'alwaseet_id'
        });

      if (error) {
        console.error(`❌ خطأ في تحديث المدينة ${city.name}:`, error);
      } else {
        updatedCount++;
      }
    } catch (error) {
      console.error(`❌ خطأ في معالجة المدينة ${city.name}:`, error);
    }
  }

  return updatedCount;
}

async function updateRegionsCache(regions: AlWaseetRegion[]): Promise<number> {
  let updatedCount = 0;
  
  for (const region of regions) {
    try {
      const { error } = await supabase
        .from('regions_cache')
        .upsert({
          alwaseet_id: region.id,
          city_id: region.city_id,
          name: region.name,
          name_ar: region.name_ar || region.name,
          name_en: region.name_en || null,
          is_active: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'alwaseet_id'
        });

      if (error) {
        console.error(`❌ خطأ في تحديث المنطقة ${region.name}:`, error);
      } else {
        updatedCount++;
      }
    } catch (error) {
      console.error(`❌ خطأ في معالجة المنطقة ${region.name}:`, error);
    }
  }

  return updatedCount;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, user_id } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'مطلوب رمز الوصول للوسيط' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔄 بدء تحديث cache المدن والمناطق...');

    // جلب المدن من الوسيط
    const cities = await fetchCitiesFromAlWaseet(token);
    
    // تحديث cache المدن
    const citiesUpdated = await updateCitiesCache(cities);
    console.log(`✅ تم تحديث ${citiesUpdated} مدينة`);

    // جلب وتحديث المناطق لكل مدينة
    let totalRegionsUpdated = 0;
    let processedCities = 0;

    for (const city of cities) {
      try {
        const regions = await fetchRegionsFromAlWaseet(token, city.id);
        const regionsUpdated = await updateRegionsCache(regions);
        totalRegionsUpdated += regionsUpdated;
        processedCities++;

        // انتظار قصير بين المدن لتجنب Rate Limiting
        if (processedCities % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`❌ خطأ في معالجة مناطق المدينة ${city.name}:`, error);
      }
    }

    console.log(`✅ تم تحديث ${totalRegionsUpdated} منطقة من ${processedCities} مدينة`);

    // تسجيل عملية التحديث
    if (user_id) {
      await supabase
        .from('auto_sync_log')
        .insert({
          sync_type: 'cities_regions_cache',
          triggered_by: user_id,
          success: true,
          results: {
            cities_updated: citiesUpdated,
            regions_updated: totalRegionsUpdated,
            cities_processed: processedCities
          },
          completed_at: new Date().toISOString()
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        cities_updated: citiesUpdated,
        regions_updated: totalRegionsUpdated,
        cities_processed: processedCities,
        message: `تم تحديث ${citiesUpdated} مدينة و ${totalRegionsUpdated} منطقة بنجاح`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ خطأ في تحديث cache المدن والمناطق:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'فشل تحديث cache المدن والمناطق', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});