import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ALWASEET_BASE_URL = 'https://api.alwaseet-iq.net/v1/merchant';
const RATE_LIMIT_DELAY = 200;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function directFetch(endpoint: string, token: string, queryParams?: Record<string, unknown>): Promise<unknown> {
  let url = `${ALWASEET_BASE_URL}/${endpoint}?token=${token}`;
  if (queryParams) {
    for (const [k, v] of Object.entries(queryParams)) {
      url += `&${k}=${v}`;
    }
  }

  const resp = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  const text = await resp.text();

  if ((resp.status === 403 || resp.status === 503) && 
      (text.includes('Cloudflare') || text.includes('cf-error'))) {
    throw new Error(`CF_BLOCKED: Cloudflare حظر الطلب (${resp.status}) للـ ${endpoint}`);
  }

  if (!resp.ok) {
    throw new Error(`API error ${resp.status}: ${text.substring(0, 200)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from ${endpoint}: ${text.substring(0, 100)}`);
  }
}

async function fetchCities(token: string) {
  const raw = await directFetch('citys', token);
  let citiesData: unknown[] | null = null;
  if (Array.isArray(raw)) citiesData = raw;
  else if (raw && typeof raw === 'object' && 'data' in raw && Array.isArray((raw as Record<string, unknown>).data)) {
    citiesData = (raw as Record<string, unknown>).data as unknown[];
  }
  if (!citiesData || citiesData.length === 0) throw new Error('لا توجد مدن في الاستجابة');
  console.log(`✅ تم جلب ${citiesData.length} مدينة`);
  return citiesData
    .map((city: Record<string, unknown>) => {
      // ✅ API may return field as `name` OR `city_name`
      const cityName = (city.name || city.city_name) as string | undefined;
      return {
        id: parseInt(String(city.id)) || (city.id as number),
        name: cityName as string,
        name_ar: (city.name_ar || cityName) as string,
        name_en: (city.name_en || null) as string | undefined,
      };
    })
    .filter((c) => c.name && String(c.name).trim().length > 0);
}

async function fetchRegions(token: string, cityId: number) {
  try {
    const raw = await directFetch('regions', token, { city_id: cityId });
    let regionsData: unknown[] | null = null;
    if (Array.isArray(raw)) regionsData = raw;
    else if (raw && typeof raw === 'object' && 'data' in raw && Array.isArray((raw as Record<string, unknown>).data)) {
      regionsData = (raw as Record<string, unknown>).data as unknown[];
    }
    if (!regionsData || regionsData.length === 0) return [];
    return regionsData
      .map((region: Record<string, unknown>) => {
        // ✅ API may return field as `name` OR `region_name`
        const regionName = (region.name || region.region_name) as string | undefined;
        return {
          id: parseInt(String(region.id)) || (region.id as number),
          city_id: cityId,
          name: regionName as string,
          name_ar: (region.name_ar || regionName) as string | undefined,
          name_en: (region.name_en || null) as string | undefined,
        };
      })
      .filter((r) => r.name && String(r.name).trim().length > 0);
  } catch (error) {
    console.error(`❌ خطأ مناطق المدينة ${cityId}:`, error);
    return [];
  }
}

// Batch upsert cities
async function upsertCitiesBatch(cities: { id: number; name: string; name_ar: string; name_en?: string }[]) {
  const timestamp = new Date().toISOString();
  
  const masterRecords = cities.map(c => ({
    id: c.id, alwaseet_id: c.id, name: c.name,
    name_ar: c.name_ar || c.name, name_en: c.name_en || null,
    is_active: true, updated_at: timestamp
  }));
  const { error: me } = await supabase.from('cities_master').upsert(masterRecords, { onConflict: 'id' });
  if (me) console.error('❌ cities_master batch:', me);

  const mappingRecords = cities.map(c => ({
    city_id: c.id, delivery_partner: 'alwaseet',
    external_id: String(c.id), external_name: c.name,
    is_active: true, updated_at: timestamp
  }));
  const { error: mpe } = await supabase.from('city_delivery_mappings').upsert(mappingRecords, { onConflict: 'city_id,delivery_partner' });
  if (mpe) console.error('❌ city_delivery_mappings batch:', mpe);

  return me || mpe ? 0 : cities.length;
}

// Batch upsert regions for one city
async function upsertRegionsBatch(regions: { id: number; city_id: number; name: string; name_ar?: string; name_en?: string }[]) {
  if (regions.length === 0) return 0;
  const timestamp = new Date().toISOString();

  const masterRecords = regions.map(r => ({
    id: r.id, alwaseet_id: r.id, city_id: r.city_id,
    name: r.name, is_active: true, updated_at: timestamp
  }));
  const { error: me } = await supabase.from('regions_master').upsert(masterRecords, { onConflict: 'id' });
  if (me) { console.error('❌ regions_master batch:', me); return 0; }

  const mappingRecords = regions.map(r => ({
    region_id: r.id, delivery_partner: 'alwaseet',
    external_id: String(r.id), external_name: r.name,
    is_active: true, updated_at: timestamp
  }));
  const { error: mpe } = await supabase.from('region_delivery_mappings').upsert(mappingRecords, { onConflict: 'region_id,delivery_partner' });
  if (mpe) { console.error('❌ region_delivery_mappings batch:', mpe); return 0; }

  return regions.length;
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
        JSON.stringify({ error: 'مطلوب رمز الوصول للوسيط' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🚀 بدء مزامنة المدن والمناطق (batch):', user_id);

    const { data: syncLogData } = await supabase
      .from('cities_regions_sync_log')
      .insert({
        started_at: startTime.toISOString(),
        success: false,
        triggered_by: user_id,
        delivery_partner: 'alwaseet'
      })
      .select()
      .single();

    const syncLogId = syncLogData?.id;

    // جلب المدن
    const cities = await fetchCities(token);
    const citiesUpdated = await upsertCitiesBatch(cities);
    console.log(`📦 ${citiesUpdated} مدينة محدثة`);

    let totalRegionsUpdated = 0;

    // جلب المناطق لكل مدينة مع تحديث التقدم بعد كل مدينة
    for (let i = 0; i < cities.length; i++) {
      const city = cities[i];
      try {
        if (i > 0) await delay(RATE_LIMIT_DELAY);
        
        const regions = await fetchRegions(token, city.id);
        
        if (regions.length > 0) {
          const regionsUpdated = await upsertRegionsBatch(regions);
          totalRegionsUpdated += regionsUpdated;
        }

        console.log(`✅ [${i + 1}/${cities.length}] ${city.name || '(no name)'}: ${regions.length} منطقة`);

        // تحديث التقدم بعد كل مدينة (وليس كل 5)
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
        console.error(`❌ ${city.name}:`, error);
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
      message: 'تم تحديث المدن والمناطق بنجاح',
      cities_updated: citiesUpdated,
      regions_updated: totalRegionsUpdated,
      duration_seconds: duration,
      timestamp: endTime.toISOString(),
      last_sync_at: endTime.toISOString()
    };

    console.log(`🎉 مزامنة مكتملة في ${duration}s:`, responseData);

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    
    console.error('❌ خطأ المزامنة:', error);

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
