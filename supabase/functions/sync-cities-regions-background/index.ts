import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface AlWaseetCity {
  id: number
  name: string
  name_ar?: string
  name_en?: string
}

interface AlWaseetRegion {
  id: number
  city_id: number
  name: string
  name_ar?: string
  name_en?: string
}

async function fetchCitiesFromAlWaseet(token: string): Promise<AlWaseetCity[]> {
  try {
    const { data, error } = await supabase.functions.invoke('alwaseet-proxy', {
      body: { 
        endpoint: 'citys', 
        method: 'GET', 
        token: token 
      }
    })

    if (error) throw new Error(`فشل جلب المدن: ${error.message}`)

    let citiesData = data
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (data.data && Array.isArray(data.data)) {
        citiesData = data.data
      } else {
        throw new Error('البيانات المستلمة غير صحيحة')
      }
    }

    if (!citiesData || !Array.isArray(citiesData)) {
      throw new Error('البيانات المستلمة غير صحيحة')
    }

    return citiesData.map(city => ({
      id: parseInt(city.id) || city.id,
      name: city.name,
      name_ar: city.name_ar || city.name,
      name_en: city.name_en || null
    }))
  } catch (error) {
    console.error('❌ خطأ في جلب المدن:', error)
    throw error
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
    })

    if (error) {
      console.error(`❌ خطأ في جلب مناطق ${cityId}:`, error)
      return []
    }

    let regionsData = data
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (data.data && Array.isArray(data.data)) {
        regionsData = data.data
      } else {
        return []
      }
    }

    if (!regionsData || !Array.isArray(regionsData)) {
      return []
    }

    return regionsData.map(region => ({
      id: parseInt(region.id) || region.id,
      city_id: cityId,
      name: region.name,
      name_ar: region.name_ar || region.name,
      name_en: region.name_en || null
    }))
  } catch (error) {
    console.error(`❌ خطأ في جلب مناطق ${cityId}:`, error)
    return []
  }
}

async function updateCitiesCache(cities: AlWaseetCity[]): Promise<number> {
  let updated = 0
  
  for (const city of cities) {
    try {
      await supabase.from('cities_master').upsert({
        id: city.id,
        alwaseet_id: city.id,
        name: city.name,
        name_ar: city.name_ar || city.name,
        name_en: city.name_en || null,
        is_active: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })

      await supabase.from('city_delivery_mappings').upsert({
        city_id: city.id,
        delivery_partner: 'alwaseet',
        external_id: String(city.id),
        external_name: city.name,
        is_active: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'city_id,delivery_partner' })

      updated++
    } catch (error) {
      console.error(`❌ خطأ في تحديث ${city.name}:`, error)
    }
  }

  return updated
}

async function updateRegionsCache(regions: AlWaseetRegion[]): Promise<number> {
  if (regions.length === 0) return 0
  
  let updated = 0
  
  for (const region of regions) {
    try {
      await supabase.from('regions_master').upsert({
        id: region.id,
        alwaseet_id: region.id,
        city_id: region.city_id,
        name: region.name,
        is_active: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })

      await supabase.from('region_delivery_mappings').upsert({
        region_id: region.id,
        delivery_partner: 'alwaseet',
        external_id: String(region.id),
        external_name: region.name,
        is_active: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'region_id,delivery_partner' })

      updated++
    } catch (error) {
      console.error(`❌ خطأ في تحديث ${region.name}:`, error)
    }
  }

  return updated
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { token, user_id } = await req.json()

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'مطلوب رمز الوصول' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🚀 بدء المزامنة المبسطة للمستخدم:', user_id)
    const startTime = new Date()

    // إنشاء سجل progress
    const { data: progressData, error: progressError } = await supabase
      .from('background_sync_progress')
      .insert({
        triggered_by: user_id,
        sync_type: 'cities_regions',
        status: 'in_progress',
        started_at: startTime.toISOString()
      })
      .select()
      .single()

    if (progressError) throw progressError
    const progressId = progressData.id

    try {
      // 1. جلب وتحديث المدن
      console.log('📥 جلب المدن...')
      const cities = await fetchCitiesFromAlWaseet(token)
      console.log(`✅ تم جلب ${cities.length} مدينة`)

      const citiesUpdated = await updateCitiesCache(cities)
      console.log(`✅ تم تحديث ${citiesUpdated} مدينة`)

      await supabase
        .from('background_sync_progress')
        .update({
          total_cities: cities.length,
          completed_cities: citiesUpdated,
          updated_at: new Date().toISOString()
        })
        .eq('id', progressId)

      // 2. معالجة المناطق - مدينة تلو الأخرى
      let totalRegions = 0
      let completedRegions = 0

      for (let i = 0; i < cities.length; i++) {
        const city = cities[i]
        console.log(`📍 معالجة ${city.name} (${i + 1}/${cities.length})...`)

        try {
          const regions = await fetchRegionsFromAlWaseet(token, city.id)
          
          // معالجة المناطق في دفعات صغيرة (100 منطقة)
          const batchSize = 100
          for (let j = 0; j < regions.length; j += batchSize) {
            const batch = regions.slice(j, Math.min(j + batchSize, regions.length))
            const updated = await updateRegionsCache(batch)
            completedRegions += updated
            
            console.log(`  ✓ دفعة: ${updated} منطقة (الإجمالي: ${completedRegions})`)
          }

          totalRegions += regions.length
          console.log(`  ✅ ${city.name}: ${regions.length} منطقة`)

          // تحديث progress بعد كل مدينة
          await supabase
            .from('background_sync_progress')
            .update({
              total_regions: totalRegions,
              completed_regions: completedRegions,
              current_city_name: city.name,
              updated_at: new Date().toISOString()
            })
            .eq('id', progressId)

        } catch (error) {
          console.error(`❌ خطأ في معالجة ${city.name}:`, error)
        }
      }

      const endTime = new Date()
      const duration = (endTime.getTime() - startTime.getTime()) / 1000

      // تحديث حالة الإكمال
      await supabase
        .from('background_sync_progress')
        .update({
          status: 'completed',
          completed_at: endTime.toISOString(),
          updated_at: endTime.toISOString()
        })
        .eq('id', progressId)

      // تسجيل النتيجة
      await supabase
        .from('cities_regions_sync_log')
        .insert({
          triggered_by: user_id,
          started_at: startTime.toISOString(),
          ended_at: endTime.toISOString(),
          cities_count: citiesUpdated,
          regions_count: completedRegions,
          success: true,
          sync_duration_seconds: duration
        })

      console.log(`✅ المزامنة مكتملة: ${citiesUpdated} مدينة، ${completedRegions} منطقة في ${duration.toFixed(2)} ثانية`)

      return new Response(
        JSON.stringify({
          success: true,
          cities_updated: citiesUpdated,
          regions_updated: completedRegions,
          duration_seconds: duration,
          progress_id: progressId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } catch (error) {
      console.error('❌ خطأ في المزامنة:', error)

      await supabase
        .from('background_sync_progress')
        .update({
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', progressId)

      await supabase
        .from('cities_regions_sync_log')
        .insert({
          triggered_by: user_id,
          started_at: startTime.toISOString(),
          ended_at: new Date().toISOString(),
          success: false,
          error_message: error.message
        })

      throw error
    }

  } catch (error) {
    console.error('Error in sync function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
