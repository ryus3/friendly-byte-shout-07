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

// ===================================================================
// 🚀 المرحلة 2: Smart Background Sync
// المزامنة الذكية في الخلفية مع EdgeRuntime.waitUntil
// ===================================================================

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

    let citiesData = data;
    
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (data.data && Array.isArray(data.data)) {
        citiesData = data.data;
      } else {
        throw new Error('البيانات المستلمة من الوسيط غير صحيحة');
      }
    }

    if (!citiesData || !Array.isArray(citiesData)) {
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
      return [];
    }

    let regionsData = data;
    
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (data.data && Array.isArray(data.data)) {
        regionsData = data.data;
      } else {
        return [];
      }
    }

    if (!regionsData || !Array.isArray(regionsData)) {
      return [];
    }

    const processedRegions = regionsData.map(region => ({
      id: parseInt(region.id) || region.id,
      city_id: cityId,
      name: region.name,
      name_ar: region.name_ar || region.name,
      name_en: region.name_en || null
    }));

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
        }, {
          onConflict: 'id'
        });

      if (masterError) {
        console.error(`❌ خطأ في تحديث cities_master للمدينة ${city.name}:`, masterError);
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
        }, {
          onConflict: 'city_id,delivery_partner'
        });

      if (!mappingError) {
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
      const { error: masterError } = await supabase
        .from('regions_master')
        .upsert({
          id: region.id,
          alwaseet_id: region.id,
          city_id: region.city_id,
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

      if (!mappingError) {
        updatedCount++;
      }
    } catch (error) {
      console.error(`❌ خطأ في معالجة المنطقة ${region.name}:`, error);
    }
  }

  return updatedCount;
}

// ===================================================================
// 🎯 Background Sync Task مع Timeout Protection
// ===================================================================
async function performBackgroundSync(token: string, userId: string, progressId: string) {
  const startTime = new Date();
  const MAX_EXECUTION_TIME = 23000; // 23 ثانية (قبل 25 ثانية الحد الأقصى)
  let isTimedOut = false;
  
  const checkTimeout = () => {
    const elapsed = new Date().getTime() - startTime.getTime();
    if (elapsed > MAX_EXECUTION_TIME) {
      isTimedOut = true;
      return true;
    }
    return false;
  };
  
  try {
    console.log(`🚀 بدء المزامنة الذكية في الخلفية - Progress ID: ${progressId}`);
    
    // جلب المدن
    const cities = await fetchCitiesFromAlWaseet(token);
    
    if (checkTimeout()) throw new Error('Timeout: تجاوز وقت التنفيذ المسموح');
    
    // تحديث progress: المدن
    await supabase
      .from('background_sync_progress')
      .update({
        total_cities: cities.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', progressId);

    // تحديث cache المدن
    const citiesUpdated = await updateCitiesCache(cities);
    
    await supabase
      .from('background_sync_progress')
      .update({
        completed_cities: citiesUpdated,
        updated_at: new Date().toISOString()
      })
      .eq('id', progressId);

    console.log(`✅ تم تحديث ${citiesUpdated} مدينة في الـ cache`);

    if (checkTimeout()) throw new Error('Timeout: تجاوز وقت التنفيذ المسموح');

    // معالجة المناطق بدفعات صغيرة ومع timeout protection
    let totalRegionsUpdated = 0;
    const cityBatchSize = 2; // معالجة مدينتين في المرة الواحدة
    const maxRegionsPerBatch = 150; // 150 منطقة لكل دفعة
    
    for (let i = 0; i < cities.length && !isTimedOut; i += cityBatchSize) {
      if (checkTimeout()) {
        console.warn(`⚠️ اقتراب Timeout - توقف عند المدينة ${i}/${cities.length}`);
        break;
      }
      
      const cityBatch = cities.slice(i, Math.min(i + cityBatchSize, cities.length));
      
      // معالجة كل مدينة
      const batchPromises = cityBatch.map(async (city) => {
        if (isTimedOut) return 0;
        
        try {
          console.log(`📍 معالجة ${city.name}...`);
          const regions = await fetchRegionsFromAlWaseet(token, city.id);
          
          if (isTimedOut) return 0;
          
          // تحديث المناطق في دفعات
          let regionsUpdated = 0;
          for (let j = 0; j < regions.length && !isTimedOut; j += maxRegionsPerBatch) {
            const regionsBatch = regions.slice(j, Math.min(j + maxRegionsPerBatch, regions.length));
            const batchUpdated = await updateRegionsCache(regionsBatch);
            regionsUpdated += batchUpdated;
            
            // تأخير صغير بين الدفعات
            if (j + maxRegionsPerBatch < regions.length && !isTimedOut) {
              await new Promise(resolve => setTimeout(resolve, 20));
            }
          }
          
          console.log(`  ✓ ${city.name}: ${regionsUpdated} منطقة`);
          return regionsUpdated;
        } catch (error) {
          console.error(`❌ خطأ في معالجة ${city.name}:`, error);
          return 0;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      totalRegionsUpdated += batchResults.reduce((sum, count) => sum + count, 0);

      // تحديث progress
      await supabase
        .from('background_sync_progress')
        .update({
          completed_regions: totalRegionsUpdated,
          current_city_name: cityBatch[cityBatch.length - 1]?.name,
          updated_at: new Date().toISOString()
        })
        .eq('id', progressId);

      // تأخير صغير بين مجموعات المدن
      if (i + cityBatchSize < cities.length && !isTimedOut) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    const finalStatus = isTimedOut ? 'partial' : 'completed';
    const successFlag = !isTimedOut;

    // تحديث حالة الإكمال
    await supabase
      .from('background_sync_progress')
      .update({
        status: finalStatus,
        completed_regions: totalRegionsUpdated,
        completed_at: endTime.toISOString(),
        updated_at: new Date().toISOString(),
        error_message: isTimedOut ? 'توقف جزئياً: اقتراب Timeout' : null
      })
      .eq('id', progressId);

    // تسجيل في cities_regions_sync_log
    await supabase
      .from('cities_regions_sync_log')
      .insert({
        last_sync_at: endTime.toISOString(),
        started_at: startTime.toISOString(),
        ended_at: endTime.toISOString(),
        cities_count: citiesUpdated,
        regions_count: totalRegionsUpdated,
        sync_duration_seconds: duration,
        success: successFlag,
        error_message: isTimedOut ? 'توقف جزئياً: اقتراب Timeout' : null,
        triggered_by: userId
      });

    console.log(`${isTimedOut ? '⚠️' : '🎉'} المزامنة ${isTimedOut ? 'الجزئية' : 'الكاملة'} مكتملة: ${citiesUpdated} مدينة، ${totalRegionsUpdated} منطقة في ${duration.toFixed(1)}ث`);
    
  } catch (error) {
    console.error('❌ خطأ في المزامنة الذكية:', error);
    
    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    
    // تحديث حالة الفشل
    await supabase
      .from('background_sync_progress')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : String(error),
        completed_at: endTime.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', progressId);
    
    // تسجيل الفشل في cities_regions_sync_log
    await supabase
      .from('cities_regions_sync_log')
      .insert({
        last_sync_at: endTime.toISOString(),
        started_at: startTime.toISOString(),
        ended_at: endTime.toISOString(),
        cities_count: 0,
        regions_count: 0,
        sync_duration_seconds: duration,
        success: false,
        error_message: error instanceof Error ? error.message : String(error),
        triggered_by: userId
      });
  }
}

// ===================================================================
// 🌐 HTTP Server
// ===================================================================
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

    console.log('🚀 بدء المزامنة الذكية في الخلفية للمستخدم:', user_id);

    // إنشاء سجل progress جديد
    const { data: progressData, error: progressError } = await supabase
      .from('background_sync_progress')
      .insert({
        sync_type: 'cities_regions',
        status: 'in_progress',
        triggered_by: user_id,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (progressError || !progressData) {
      throw new Error('فشل إنشاء سجل المزامنة');
    }

    // 🔥 استخدام EdgeRuntime.waitUntil للمزامنة في الخلفية
    // @ts-ignore - EdgeRuntime is available in Deno Deploy
    if (typeof EdgeRuntime !== 'undefined') {
      // @ts-ignore
      EdgeRuntime.waitUntil(
        performBackgroundSync(token, user_id, progressData.id)
      );
    } else {
      // Fallback: تشغيل عادي في بيئة التطوير
      performBackgroundSync(token, user_id, progressData.id).catch(console.error);
    }

    // إرجاع استجابة فورية
    return new Response(
      JSON.stringify({
        success: true,
        message: 'بدأت المزامنة الذكية في الخلفية',
        progress_id: progressData.id,
        sync_type: 'background',
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ خطأ في بدء المزامنة الذكية:', error);

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
