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

interface ModonCity {
  id: string;
  city_name: string;
}

interface ModonRegion {
  id: string;
  region_name: string;
}

async function fetchCitiesFromModon(token: string): Promise<ModonCity[]> {
  try {
    const { data, error } = await supabase.functions.invoke('modon-proxy', {
      body: { 
        endpoint: 'citys', 
        method: 'GET', 
        token: token 
      }
    });

    if (error) {
      console.error('❌ خطأ في جلب المدن من مدن:', error);
      throw new Error(`فشل جلب المدن: ${error.message}`);
    }

    let citiesData = data;
    
    // معالجة structure الاستجابة
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (data.data && Array.isArray(data.data)) {
        citiesData = data.data;
        console.log('📦 تم استخراج البيانات من الكائن:', { originalStructure: Object.keys(data) });
      } else {
        console.error('❌ البيانات المستلمة غير صحيحة:', data);
        throw new Error('البيانات المستلمة من مدن غير صحيحة');
      }
    }

    if (!citiesData || !Array.isArray(citiesData)) {
      console.error('❌ البيانات المستلمة غير صحيحة:', citiesData);
      throw new Error('البيانات المستلمة من مدن غير صحيحة');
    }

    console.log(`✅ تم جلب ${citiesData.length} مدينة من مدن`);
    return citiesData.map(city => ({
      id: String(city.id),
      city_name: city.city_name
    }));
  } catch (error) {
    console.error('❌ خطأ في الاتصال بواجهة مدن:', error);
    throw error;
  }
}

async function fetchRegionsFromModon(token: string, cityId: string): Promise<ModonRegion[]> {
  try {
    console.log(`🔄 طلب مناطق المدينة ${cityId} من مدن...`);
    const { data, error } = await supabase.functions.invoke('modon-proxy', {
      body: { 
        endpoint: 'regions', 
        method: 'GET', 
        token: token,
        queryParams: { city_id: cityId }
      }
    });

    if (error) {
      console.error(`❌ خطأ في جلب مناطق المدينة ${cityId}:`, error);
      return [];
    }

    let regionsData = data;
    
    // معالجة structure الاستجابة
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (data.data && Array.isArray(data.data)) {
        regionsData = data.data;
        console.log(`📦 استخراج ${regionsData.length} منطقة للمدينة ${cityId}`);
      } else {
        console.log(`⚠️ لا توجد مناطق للمدينة ${cityId}`);
        return [];
      }
    }

    if (!regionsData || !Array.isArray(regionsData)) {
      console.log(`⚠️ لا توجد مناطق للمدينة ${cityId}`);
      return [];
    }

    console.log(`📦 استخراج ${regionsData.length} منطقة للمدينة ${cityId}`);
    return regionsData.map(region => ({
      id: String(region.id),
      region_name: region.region_name
    }));
  } catch (error) {
    console.error(`❌ خطأ في جلب مناطق المدينة ${cityId}:`, error);
    return [];
  }
}

async function updateCitiesCache(cities: ModonCity[]): Promise<number> {
  let updatedCount = 0;
  
  for (const city of cities) {
    try {
      const modonCityId = parseInt(city.id);
      
      // البحث عن المدينة الموحدة بالاسم
      const { data: existingCity } = await supabase
        .from('cities_master')
        .select('id')
        .eq('name', city.city_name)
        .maybeSingle();

      let cityMasterId: number;

      if (existingCity) {
        // المدينة موجودة - استخدم المعرف الموحد
        cityMasterId = existingCity.id;
      } else {
        // إنشاء مدينة جديدة في cities_master
        const { data: newCity, error: insertError } = await supabase
          .from('cities_master')
          .insert({
            name: city.city_name,
            name_ar: city.city_name,
            is_active: true
          })
          .select('id')
          .single();

        if (insertError || !newCity) {
          console.error(`❌ خطأ في إنشاء المدينة ${city.city_name}:`, insertError);
          continue;
        }
        
        cityMasterId = newCity.id;
      }

      // تحديث city_delivery_mappings لمدن
      const { error: mappingError } = await supabase
        .from('city_delivery_mappings')
        .upsert({
          city_id: cityMasterId,
          delivery_partner: 'modon',
          external_id: String(modonCityId),
          external_name: city.city_name,
          is_active: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'city_id,delivery_partner'
        });

      if (mappingError) {
        console.error(`❌ خطأ في تحديث mappings للمدينة ${city.city_name}:`, mappingError);
      } else {
        updatedCount++;
      }
    } catch (error) {
      console.error(`❌ خطأ في معالجة المدينة ${city.city_name}:`, error);
    }
  }

  return updatedCount;
}

async function updateRegionsCache(cityMasterId: number, modonCityId: string, regions: ModonRegion[]): Promise<number> {
  if (regions.length === 0) return 0;
  
  try {
    const timestamp = new Date().toISOString();
    let updatedCount = 0;

    for (const region of regions) {
      const modonRegionId = parseInt(region.id);

      // البحث عن المنطقة الموحدة بالاسم والمدينة
      const { data: existingRegion } = await supabase
        .from('regions_master')
        .select('id')
        .eq('city_id', cityMasterId)
        .eq('name', region.region_name)
        .maybeSingle();

      let regionMasterId: number;

      if (existingRegion) {
        regionMasterId = existingRegion.id;
      } else {
        // إنشاء منطقة جديدة
        const { data: newRegion, error: insertError } = await supabase
          .from('regions_master')
          .insert({
            city_id: cityMasterId,
            name: region.region_name,
            is_active: true
          })
          .select('id')
          .single();

        if (insertError || !newRegion) {
          console.error(`❌ خطأ في إنشاء المنطقة ${region.region_name}:`, insertError);
          continue;
        }

        regionMasterId = newRegion.id;
      }

      // تحديث region_delivery_mappings لمدن
      const { error: mappingError } = await supabase
        .from('region_delivery_mappings')
        .upsert({
          region_id: regionMasterId,
          delivery_partner: 'modon',
          external_id: String(modonRegionId),
          external_name: region.region_name,
          is_active: true,
          updated_at: timestamp
        }, {
          onConflict: 'region_id,delivery_partner'
        });

      if (!mappingError) {
        updatedCount++;
      }
    }

    return updatedCount;
  } catch (error) {
    console.error('❌ خطأ في معالجة المناطق:', error);
    return 0;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = new Date();

  try {
    const { token, user_id } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'مطلوب رمز الوصول لمدن' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🚀 بدء مزامنة مدن والمناطق للمستخدم:', user_id);

    // إنشاء سجل في cities_regions_sync_log
    const { data: syncLogData } = await supabase
      .from('cities_regions_sync_log')
      .insert({
        started_at: startTime.toISOString(),
        success: false,
        triggered_by: user_id,
        delivery_partner: 'modon'
      })
      .select()
      .single();

    const syncLogId = syncLogData?.id;

    // جلب المدن من مدن
    const cities = await fetchCitiesFromModon(token);
    console.log(`📦 تم جلب ${cities.length} مدينة من مدن`);

    // تحديث cache المدن
    const citiesUpdated = await updateCitiesCache(cities);
    console.log(`✅ تم تحديث ${citiesUpdated} مدينة في الـ cache`);

    let totalRegionsUpdated = 0;
    let citiesProcessed = 0;
    
    // معالجة تسلسلية لكل مدينة
    for (const city of cities) {
      try {
        const modonCityId = city.id;
        
        // الحصول على المعرف الموحد
        const { data: cityMapping } = await supabase
          .from('city_delivery_mappings')
          .select('city_id')
          .eq('delivery_partner', 'modon')
          .eq('external_id', modonCityId)
          .single();

        if (!cityMapping) {
          console.log(`⚠️ لم يتم العثور على mapping للمدينة ${city.city_name}`);
          citiesProcessed++;
          continue;
        }

        const regions = await fetchRegionsFromModon(token, modonCityId);
        
        if (regions.length === 0) {
          console.log(`⚠️ لا توجد مناطق للمدينة ${city.city_name}`);
          citiesProcessed++;
          continue;
        }

        const regionsUpdated = await updateRegionsCache(cityMapping.city_id, modonCityId, regions);
        totalRegionsUpdated += regionsUpdated;
        citiesProcessed++;
        
        console.log(`✅ [${citiesProcessed}/${cities.length}] ${city.city_name}: ${regionsUpdated} منطقة`);

        // تحديث Progress
        if (syncLogId && citiesProcessed % 3 === 0) {
          await supabase
            .from('cities_regions_sync_log')
            .update({
              cities_count: citiesProcessed,
              regions_count: totalRegionsUpdated,
              last_sync_at: new Date().toISOString()
            })
            .eq('id', syncLogId);
        }
      } catch (error) {
        console.error(`❌ خطأ في معالجة المدينة ${city.city_name}:`, error);
        citiesProcessed++;
      }
    }

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    // تحديث سجل المزامنة
    if (syncLogId) {
      await supabase
        .from('cities_regions_sync_log')
        .update({
          ended_at: endTime.toISOString(),
          last_sync_at: endTime.toISOString(),
          cities_count: citiesUpdated,
          regions_count: totalRegionsUpdated,
          sync_duration_seconds: duration,
          success: true
        })
        .eq('id', syncLogId);
    }

    const responseData = {
      success: true,
      message: 'تم تحديث المدن والمناطق من مدن بنجاح',
      cities_updated: citiesUpdated,
      regions_updated: totalRegionsUpdated,
      duration_seconds: duration,
      timestamp: endTime.toISOString(),
      last_sync_at: endTime.toISOString()
    };

    console.log(`🎉 مزامنة مدن مكتملة في ${duration} ثانية:`, responseData);

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    
    console.error('❌ خطأ في مزامنة مدن:', error);

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        duration_seconds: duration,
        timestamp: endTime.toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
