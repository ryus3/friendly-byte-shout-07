import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const MODON_BASE_URL = 'https://mcht.modon-express.net/v1/merchant';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ModonCity {
  id: string | number;
  city_name: string;
}

interface ModonRegion {
  id: string | number;
  region_name: string;
}

// ✅ Direct fetch to MODON API - no proxy needed
async function fetchFromModon(endpoint: string, token: string, queryParams?: Record<string, string>): Promise<any> {
  const url = new URL(`${MODON_BASE_URL}/${endpoint}`);
  url.searchParams.set('token', token);
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value);
    }
  }

  console.log(`🌐 Fetching: ${endpoint}${queryParams ? ' with params: ' + JSON.stringify(queryParams) : ''}`);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MODON API error ${response.status}: ${text}`);
  }

  const data = await response.json();

  if (data.status === true && data.errNum === 'S000') {
    return data.data || [];
  }

  console.warn(`⚠️ MODON API non-success: ${data.errNum} - ${data.msg}`);
  return data.data || [];
}

async function fetchCitiesFromModon(token: string): Promise<ModonCity[]> {
  try {
    const citiesData = await fetchFromModon('citys', token);

    if (!Array.isArray(citiesData)) {
      console.error('❌ Cities data is not an array:', typeof citiesData);
      return [];
    }

    console.log(`✅ تم جلب ${citiesData.length} مدينة من مدن`);
    return citiesData.map((city: any) => ({
      id: String(city.id),
      city_name: city.city_name
    }));
  } catch (error) {
    console.error('❌ خطأ في جلب المدن من مدن:', error);
    throw error;
  }
}

async function fetchRegionsFromModon(token: string, cityId: string): Promise<ModonRegion[]> {
  try {
    const regionsData = await fetchFromModon('regions', token, { city_id: cityId });

    if (!Array.isArray(regionsData)) {
      console.log(`⚠️ لا توجد مناطق للمدينة ${cityId}`);
      return [];
    }

    return regionsData.map((region: any) => ({
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
      const modonCityId = parseInt(String(city.id));

      const { data: existingCity } = await supabase
        .from('cities_master')
        .select('id')
        .eq('name', city.city_name)
        .maybeSingle();

      let cityMasterId: number;

      if (existingCity) {
        cityMasterId = existingCity.id;
      } else {
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
      try {
        const modonRegionId = parseInt(String(region.id));

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
      } catch (regionError) {
        console.error(`❌ خطأ في معالجة المنطقة ${region.region_name}:`, regionError);
        // Continue with next region - don't break
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
  let syncLogId: string | null = null;

  try {
    const { token, user_id } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'مطلوب رمز الوصول لمدن' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🚀 بدء مزامنة مدن والمناطق (Direct API) للمستخدم:', user_id);

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

    syncLogId = syncLogData?.id;

    // ✅ جلب المدن مباشرة من MODON API (بدون modon-proxy)
    const cities = await fetchCitiesFromModon(token);
    console.log(`📦 تم جلب ${cities.length} مدينة من مدن`);

    const citiesUpdated = await updateCitiesCache(cities);
    console.log(`✅ تم تحديث ${citiesUpdated} مدينة في الـ cache`);

    let totalRegionsUpdated = 0;
    let citiesProcessed = 0;

    for (const city of cities) {
      try {
        const modonCityId = String(city.id);

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

        // ✅ Rate limiting - 300ms delay between city region fetches
        if (citiesProcessed > 0) {
          await new Promise(resolve => setTimeout(resolve, 300));
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

        // تحديث Progress كل 3 مدن
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
        // ✅ Continue with next city - don't break the whole sync
      }
    }

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    // ✅ تحديث سجل المزامنة - success
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

    // ✅ تحديث سجل المزامنة حتى عند الفشل (لمنع ended_at = null)
    if (syncLogId) {
      await supabase
        .from('cities_regions_sync_log')
        .update({
          ended_at: endTime.toISOString(),
          last_sync_at: endTime.toISOString(),
          success: false,
          error_message: error instanceof Error ? error.message : String(error),
          sync_duration_seconds: duration
        })
        .eq('id', syncLogId);
    }

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
