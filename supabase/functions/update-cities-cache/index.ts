import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ALWASEET_BASE_URL = 'https://api.alwaseet-iq.net/v1/merchant';
const RATE_LIMIT_DELAY = 300; // ms between requests

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

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Direct fetch to AlWaseet API (bypasses proxy to avoid JWT hangs in long operations)
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

  // Detect Cloudflare block
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

async function fetchCitiesFromAlWaseet(token: string): Promise<AlWaseetCity[]> {
  const raw = await directFetch('citys', token);
  
  let citiesData: unknown[] | null = null;
  if (Array.isArray(raw)) {
    citiesData = raw;
  } else if (raw && typeof raw === 'object' && 'data' in raw && Array.isArray((raw as Record<string, unknown>).data)) {
    citiesData = (raw as Record<string, unknown>).data as unknown[];
  }

  if (!citiesData || citiesData.length === 0) {
    throw new Error('لا توجد مدن في الاستجابة');
  }

  console.log(`✅ تم جلب ${citiesData.length} مدينة`);
  return citiesData.map((city: Record<string, unknown>) => ({
    id: parseInt(String(city.id)) || (city.id as number),
    name: city.name as string,
    name_ar: (city.name_ar || city.name) as string,
    name_en: (city.name_en || null) as string | undefined,
  }));
}

async function fetchRegionsFromAlWaseet(token: string, cityId: number): Promise<AlWaseetRegion[]> {
  try {
    const raw = await directFetch('regions', token, { city_id: cityId });
    
    let regionsData: unknown[] | null = null;
    if (Array.isArray(raw)) {
      regionsData = raw;
    } else if (raw && typeof raw === 'object' && 'data' in raw && Array.isArray((raw as Record<string, unknown>).data)) {
      regionsData = (raw as Record<string, unknown>).data as unknown[];
    }

    if (!regionsData || regionsData.length === 0) {
      return [];
    }

    return regionsData.map((region: Record<string, unknown>) => ({
      id: parseInt(String(region.id)) || (region.id as number),
      city_id: cityId,
      name: region.name as string,
      name_ar: (region.name_ar || region.name) as string | undefined,
      name_en: (region.name_en || null) as string | undefined,
    }));
  } catch (error) {
    console.error(`❌ خطأ مناطق المدينة ${cityId}:`, error);
    return [];
  }
}

async function updateCitiesCache(cities: AlWaseetCity[]): Promise<number> {
  let updatedCount = 0;
  
  for (const city of cities) {
    try {
      const { error: masterError } = await supabase
        .from('cities_master')
        .upsert({
          id: city.id,
          alwaseet_id: city.id,
          name: city.name,
          name_ar: city.name_ar || city.name,
          name_en: city.name_en || null,
          is_active: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (masterError) {
        console.error(`❌ cities_master ${city.name}:`, masterError);
        continue;
      }

      const { error: mappingError } = await supabase
        .from('city_delivery_mappings')
        .upsert({
          city_id: city.id,
          delivery_partner: 'alwaseet',
          external_id: String(city.id),
          external_name: city.name,
          is_active: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'city_id,delivery_partner' });

      if (mappingError) {
        console.error(`❌ mappings ${city.name}:`, mappingError);
      } else {
        updatedCount++;
      }
    } catch (error) {
      console.error(`❌ ${city.name}:`, error);
    }
  }
  return updatedCount;
}

async function updateRegionsCache(regions: AlWaseetRegion[]): Promise<number> {
  if (regions.length === 0) return 0;
  
  try {
    const timestamp = new Date().toISOString();
    
    const masterRecords = regions.map(region => ({
      id: region.id,
      alwaseet_id: region.id,
      city_id: region.city_id,
      name: region.name,
      is_active: true,
      updated_at: timestamp
    }));

    const { error: masterError } = await supabase
      .from('regions_master')
      .upsert(masterRecords, { onConflict: 'id' });

    if (masterError) {
      console.error('❌ regions_master:', masterError);
      return 0;
    }

    const mappingRecords = regions.map(region => ({
      region_id: region.id,
      delivery_partner: 'alwaseet',
      external_id: String(region.id),
      external_name: region.name,
      is_active: true,
      updated_at: timestamp
    }));

    const { error: mappingError } = await supabase
      .from('region_delivery_mappings')
      .upsert(mappingRecords, { onConflict: 'region_id,delivery_partner' });

    if (mappingError) {
      console.error('❌ region_delivery_mappings:', mappingError);
      return 0;
    }

    return regions.length;
  } catch (error) {
    console.error('❌ معالجة المناطق:', error);
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
        JSON.stringify({ error: 'مطلوب رمز الوصول للوسيط' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🚀 بدء مزامنة المدن والمناطق (direct fetch):', user_id);

    const { data: syncLogData, error: syncLogError } = await supabase
      .from('cities_regions_sync_log')
      .insert({
        started_at: startTime.toISOString(),
        success: false,
        triggered_by: user_id,
        delivery_partner: 'alwaseet'
      })
      .select()
      .single();

    if (syncLogError) {
      console.error('⚠️ فشل إنشاء سجل المزامنة:', syncLogError);
    }

    const syncLogId = syncLogData?.id;

    // جلب المدن مباشرة من API
    const cities = await fetchCitiesFromAlWaseet(token);
    console.log(`📦 ${cities.length} مدينة`);

    const citiesUpdated = await updateCitiesCache(cities);

    let totalRegionsUpdated = 0;
    let citiesProcessed = 0;
    
    for (const city of cities) {
      try {
        // Rate limit delay
        await delay(RATE_LIMIT_DELAY);
        
        const regions = await fetchRegionsFromAlWaseet(token, city.id);
        
        if (regions.length > 0) {
          const regionsUpdated = await updateRegionsCache(regions);
          totalRegionsUpdated += regionsUpdated;
        }
        citiesProcessed++;
        
        console.log(`✅ [${citiesProcessed}/${cities.length}] ${city.name}: ${regions.length} منطقة`);

        if (syncLogId && citiesProcessed % 5 === 0) {
          await supabase
            .from('cities_regions_sync_log')
            .update({
              cities_count: citiesProcessed,
              regions_count: totalRegionsUpdated,
            })
            .eq('id', syncLogId);
        }
      } catch (error) {
        console.error(`❌ ${city.name}:`, error);
        citiesProcessed++;
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
