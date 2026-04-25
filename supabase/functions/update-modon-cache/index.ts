import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const MODON_BASE_URL = 'https://mcht.modon-express.net/v1/merchant';
const RATE_LIMIT_DELAY = 200;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchFromModon(endpoint: string, token: string, queryParams?: Record<string, string>): Promise<any> {
  const url = new URL(`${MODON_BASE_URL}/${endpoint}`);
  url.searchParams.set('token', token);
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value);
    }
  }

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

async function fetchCitiesFromModon(token: string) {
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
}

async function fetchRegionsFromModon(token: string, cityId: string) {
  try {
    const regionsData = await fetchFromModon('regions', token, { city_id: cityId });
    if (!Array.isArray(regionsData)) return [];
    return regionsData.map((region: any) => ({
      id: String(region.id),
      region_name: region.region_name
    }));
  } catch (error) {
    console.error(`❌ خطأ في جلب مناطق المدينة ${cityId}:`, error);
    return [];
  }
}

// ✅ Batch upsert cities for MODON: 1 SELECT for all + 1 batch INSERT for missing + 1 batch upsert mappings
async function upsertCitiesBatch(cities: { id: string; city_name: string }[]) {
  const timestamp = new Date().toISOString();
  const cityMasterMap: Record<string, number> = {};

  // Filter out cities with empty names
  const validCities = cities.filter(c => c.city_name && c.city_name.trim().length > 0);
  if (validCities.length === 0) return { updatedCount: 0, cityMasterMap };

  const names = Array.from(new Set(validCities.map(c => c.city_name)));

  // 1) Single SELECT for all existing cities
  const { data: existing } = await supabase
    .from('cities_master')
    .select('id, name')
    .in('name', names);

  const nameToId: Record<string, number> = {};
  for (const row of existing || []) nameToId[row.name as string] = row.id as number;

  // 2) Batch INSERT for missing cities
  const missing = names.filter(n => !(n in nameToId));
  if (missing.length > 0) {
    const { data: inserted, error } = await supabase
      .from('cities_master')
      .insert(missing.map(n => ({ name: n, name_ar: n, is_active: true })))
      .select('id, name');
    if (error) {
      console.error('❌ batch insert cities_master:', error);
    } else {
      for (const row of inserted || []) nameToId[row.name as string] = row.id as number;
    }
  }

  // Build map MODON id → master id
  for (const city of validCities) {
    const masterId = nameToId[city.city_name];
    if (masterId) cityMasterMap[city.id] = masterId;
  }

  // 3) Batch upsert mappings
  const mappings = Object.entries(cityMasterMap).map(([externalId, cityId]) => {
    const city = validCities.find(c => c.id === externalId);
    return {
      city_id: cityId,
      delivery_partner: 'modon',
      external_id: externalId,
      external_name: city?.city_name || '',
      is_active: true,
      updated_at: timestamp,
    };
  });

  let updatedCount = 0;
  if (mappings.length > 0) {
    const { error } = await supabase
      .from('city_delivery_mappings')
      .upsert(mappings, { onConflict: 'city_id,delivery_partner' });
    if (error) console.error('❌ city_delivery_mappings batch:', error);
    else updatedCount = mappings.length;
  }

  return { updatedCount, cityMasterMap };
}

// ✅ Batch upsert regions for one city: 1 SELECT for all + 1 batch INSERT for missing + 1 batch upsert mappings
async function upsertRegionsBatch(cityMasterId: number, regions: { id: string; region_name: string }[]) {
  const validRegions = regions.filter(r => r.region_name && r.region_name.trim().length > 0);
  if (validRegions.length === 0) return 0;
  const timestamp = new Date().toISOString();

  const names = Array.from(new Set(validRegions.map(r => r.region_name)));

  // 1) Single SELECT for all existing regions in this city
  const { data: existing } = await supabase
    .from('regions_master')
    .select('id, name')
    .eq('city_id', cityMasterId)
    .in('name', names);

  const nameToId: Record<string, number> = {};
  for (const row of existing || []) nameToId[row.name as string] = row.id as number;

  // 2) Batch INSERT for missing regions
  const missing = names.filter(n => !(n in nameToId));
  if (missing.length > 0) {
    const { data: inserted, error } = await supabase
      .from('regions_master')
      .insert(missing.map(n => ({ city_id: cityMasterId, name: n, is_active: true })))
      .select('id, name');
    if (error) {
      console.error(`❌ batch insert regions_master (city ${cityMasterId}):`, error);
    } else {
      for (const row of inserted || []) nameToId[row.name as string] = row.id as number;
    }
  }

  // Build region MODON id → master id
  const regionMasterMap: Record<string, number> = {};
  for (const region of validRegions) {
    const masterId = nameToId[region.region_name];
    if (masterId) regionMasterMap[region.id] = masterId;
  }

  // 3) Batch upsert mappings — مع deduplication حسب (region_id, delivery_partner)
  // (مدن قد ترسل عدة external_id لنفس الاسم → ينتج عنه نفس region_id داخلي)
  const seenRegionIds = new Set<number>();
  const mappings = Object.entries(regionMasterMap)
    .map(([externalId, regionId]) => {
      const region = validRegions.find(r => r.id === externalId);
      return {
        region_id: regionId,
        delivery_partner: 'modon',
        external_id: externalId,
        external_name: region?.region_name || '',
        is_active: true,
        updated_at: timestamp,
      };
    })
    .filter(m => {
      if (seenRegionIds.has(m.region_id)) return false;
      seenRegionIds.add(m.region_id);
      return true;
    });

  let updatedCount = 0;
  if (mappings.length > 0) {
    const { error } = await supabase
      .from('region_delivery_mappings')
      .upsert(mappings, { onConflict: 'region_id,delivery_partner' });
    if (error) console.error('❌ region_delivery_mappings batch:', error);
    else updatedCount = mappings.length;
  }

  return updatedCount;
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

    console.log('🚀 بدء مزامنة مدن والمناطق (batch) للمستخدم:', user_id);

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

    const cities = await fetchCitiesFromModon(token);
    console.log(`📦 تم جلب ${cities.length} مدينة من مدن`);

    const { updatedCount: citiesUpdated, cityMasterMap } = await upsertCitiesBatch(cities);
    console.log(`✅ تم تحديث ${citiesUpdated} مدينة في الكاش`);

    let totalRegionsUpdated = 0;

    for (let i = 0; i < cities.length; i++) {
      const city = cities[i];
      try {
        const modonCityId = String(city.id);
        const cityMasterId = cityMasterMap[modonCityId];

        if (!cityMasterId) {
          console.log(`⚠️ لم يتم العثور على master ID للمدينة ${city.city_name}`);
          continue;
        }

        if (i > 0) await delay(RATE_LIMIT_DELAY);

        const regions = await fetchRegionsFromModon(token, modonCityId);

        if (regions.length > 0) {
          const regionsUpdated = await upsertRegionsBatch(cityMasterId, regions);
          totalRegionsUpdated += regionsUpdated;
        }

        console.log(`✅ [${i + 1}/${cities.length}] ${city.city_name}: ${regions.length} منطقة`);

        // تحديث التقدم بعد كل مدينة
        if (syncLogId) {
          await supabase
            .from('cities_regions_sync_log')
            .update({
              cities_count: i + 1,
              regions_count: totalRegionsUpdated,
              last_sync_at: new Date().toISOString()
            })
            .eq('id', syncLogId);
        }
      } catch (error) {
        console.error(`❌ خطأ في معالجة المدينة ${city.city_name}:`, error);
      }
    }

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

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
