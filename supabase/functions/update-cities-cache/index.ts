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
      // تحديث cities_master (النظام الموحد)
      const { error: masterError } = await supabase
        .from('cities_master')
        .upsert({
          id: city.id,              // استخدام alwaseet_id كمعرف موحد
          alwaseet_id: city.id,
          name: city.name,
          name_ar: city.name_ar || city.name,
          name_en: city.name_en || null,
          is_active: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (masterError) {
        console.error(`❌ خطأ في تحديث cities_master للمدينة ${city.name}:`, masterError);
        continue;
      }

      // تحديث city_delivery_mappings للوسيط
      const { error: mappingError } = await supabase
        .from('city_delivery_mappings')
        .upsert({
          city_id: city.id,
          delivery_partner: 'alwaseet',
          external_id: String(city.id),
          external_name: city.name,
          is_active: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'city_id,delivery_partner'
        });

      if (mappingError) {
        console.error(`❌ خطأ في تحديث mappings للمدينة ${city.name}:`, mappingError);
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
  if (regions.length === 0) return 0;
  
  let updatedCount = 0;
  
  for (const region of regions) {
    try {
      // تحديث regions_master (النظام الموحد)
      const { error: masterError } = await supabase
        .from('regions_master')
        .upsert({
          id: region.id,              // استخدام alwaseet_id كمعرف موحد
          alwaseet_id: region.id,
          city_id: region.city_id,    // city_id الموحد (= alwaseet city id)
          name: region.name,
          is_active: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (masterError) {
        console.error(`❌ خطأ في تحديث regions_master للمنطقة ${region.name}:`, masterError);
        continue;
      }

      // تحديث region_delivery_mappings للوسيط
      const { error: mappingError } = await supabase
        .from('region_delivery_mappings')
        .upsert({
          region_id: region.id,
          delivery_partner: 'alwaseet',
          external_id: String(region.id),
          external_name: region.name,
          is_active: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'region_id,delivery_partner'
        });

      if (mappingError) {
        console.error(`❌ خطأ في تحديث mappings للمنطقة ${region.name}:`, mappingError);
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

  const startTime = new Date();

  try {
    const { token, user_id } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'مطلوب رمز الوصول للوسيط' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🚀 بدء مزامنة بسيطة للمدن والمناطق للمستخدم:', user_id);

    // إنشاء سجل في cities_regions_sync_log
    const { data: syncLogData } = await supabase
      .from('cities_regions_sync_log')
      .insert({
        started_at: startTime.toISOString(),
        success: false,
        triggered_by: user_id
      })
      .select()
      .single();

    const syncLogId = syncLogData?.id;

    // جلب المدن من الوسيط
    const cities = await fetchCitiesFromAlWaseet(token);
    console.log(`📦 تم جلب ${cities.length} مدينة من الوسيط`);

    // تحديث cache المدن مرة واحدة
    const citiesUpdated = await updateCitiesCache(cities);
    console.log(`✅ تم تحديث ${citiesUpdated} مدينة في الـ cache`);

    let totalRegionsUpdated = 0;
    
    // معالجة تسلسلية بسيطة لكل مدينة
    for (const city of cities) {
      try {
        // جلب جميع مناطق المدينة
        const regions = await fetchRegionsFromAlWaseet(token, city.id);
        
        if (regions.length === 0) {
          console.log(`⚠️ لا توجد مناطق للمدينة ${city.name}`);
          continue;
        }

        // تحديث جميع المناطق مرة واحدة
        const regionsUpdated = await updateRegionsCache(regions);
        totalRegionsUpdated += regionsUpdated;
        
        console.log(`✅ تم تحديث ${regionsUpdated} منطقة للمدينة ${city.name}`);
      } catch (error) {
        console.error(`❌ خطأ في معالجة المدينة ${city.name}:`, error);
      }
    }

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    // تحديث سجل المزامنة مرة واحدة في النهاية
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

    console.log(`🎉 مزامنة مكتملة في ${duration} ثانية:`, responseData);

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    
    console.error('❌ خطأ في مزامنة المدن والمناطق:', error);

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