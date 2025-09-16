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

    // معالجة structure الاستجابة الصحيح من alwaseet-proxy
    let citiesData = data;
    
    // إذا كانت الاستجابة object مع خاصية data، استخرجها
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (data.data && Array.isArray(data.data)) {
        citiesData = data.data;
        console.log('📦 تم استخراج البيانات من الكائن:', { originalStructure: Object.keys(data) });
      } else {
        console.error('❌ البيانات المستلمة غير صحيحة:', data);
        throw new Error('البيانات المستلمة من الوسيط غير صحيحة');
      }
    }

    if (!citiesData || !Array.isArray(citiesData)) {
      console.error('❌ البيانات المستلمة غير صحيحة:', citiesData);
      throw new Error('البيانات المستلمة من الوسيط غير صحيحة');
    }

    console.log(`✅ تم جلب ${citiesData.length} مدينة من الوسيط`);
    return citiesData.map(city => ({
      id: parseInt(city.id) || city.id,
      name: city.name,
      name_ar: city.name_ar || city.name,
      name_en: city.name_en || null
    }));
  } catch (error) {
    console.error('❌ خطأ في الاتصال بواجهة الوسيط:', error);
    throw error;
  }
}

async function fetchRegionsFromAlWaseet(token: string, cityId: number): Promise<AlWaseetRegion[]> {
  try {
    console.log(`🔄 طلب مناطق المدينة ${cityId} من الوسيط...`);
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

    // معالجة structure الاستجابة الصحيح من alwaseet-proxy
    let regionsData = data;
    
    // إذا كانت الاستجابة object مع خاصية data، استخرجها
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (data.data && Array.isArray(data.data)) {
        regionsData = data.data;
        console.log(`📦 استخراج ${regionsData.length} منطقة للمدينة ${cityId}`);
      } else {
        console.log(`⚠️ لا توجد مناطق للمدينة ${cityId} - البيانات:`, data);
        return [];
      }
    }

    if (!regionsData || !Array.isArray(regionsData)) {
      console.log(`⚠️ لا توجد مناطق للمدينة ${cityId} - بيانات غير صحيحة:`, regionsData);
      return [];
    }

    // تأكد من أن كل منطقة مرتبطة بالمدينة الصحيحة
    const processedRegions = regionsData.map(region => {
      const processedRegion = {
        id: parseInt(region.id) || region.id,
        city_id: cityId, // فرض ربط المنطقة بالمدينة المطلوبة
        name: region.name,
        name_ar: region.name_ar || region.name,
        name_en: region.name_en || null
      };
      console.log(`✅ معالجة منطقة: ${processedRegion.name} -> مدينة ${cityId}`);
      return processedRegion;
    });

    console.log(`✅ تم معالجة ${processedRegions.length} منطقة للمدينة ${cityId}`);
    return processedRegions;
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
        console.log(`🔄 معالجة المدينة: ${city.name} (AlWaseet ID: ${city.id})`);
        
        // جلب أولاً معرف المدينة الداخلي من cities_cache
        const { data: cachedCity } = await supabase
          .from('cities_cache')
          .select('id')
          .eq('alwaseet_id', city.id)
          .single();
        
        const internalCityId = cachedCity?.id;
        console.log(`📍 معرف المدينة الداخلي: ${internalCityId} للمدينة ${city.name}`);
        
        const regions = await fetchRegionsFromAlWaseet(token, city.id);
        
        if (regions.length > 0) {
          // تأكد من ربط المناطق بمعرف المدينة الداخلي الصحيح
          const regionsWithCorrectCityId = regions.map(region => ({
            ...region,
            city_id: internalCityId || city.id // استخدم المعرف الداخلي أو الخارجي
          }));
          
          const regionsUpdated = await updateRegionsCache(regionsWithCorrectCityId);
          console.log(`✅ تم تحديث ${regionsUpdated} منطقة للمدينة ${city.name} (ID: ${internalCityId})`);
          totalRegionsUpdated += regionsUpdated;
        } else {
          console.log(`⚠️ لا توجد مناطق للمدينة ${city.name}`);
        }
        
        processedCities++;

        // انتظار قصير بين المدن لتجنب Rate Limiting
        if (processedCities % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
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