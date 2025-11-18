import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * دالة تحليل وتحسين أنماط التعلم الذكي
 * تُنفذ دورياً (أسبوعياً) لتحسين دقة النظام
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 بدء تحليل أنماط التعلم...');

    const analysisResults = {
      patterns_analyzed: 0,
      patterns_merged: 0,
      patterns_deleted: 0,
      aliases_added: 0,
      confidence_updated: 0
    };

    // 1. دمج الأنماط المتشابهة
    const { data: allPatterns } = await supabase
      .from('location_learning_patterns')
      .select('*')
      .order('usage_count', { ascending: false });

    if (allPatterns) {
      analysisResults.patterns_analyzed = allPatterns.length;
      
      const mergedPatterns = new Map<string, any>();
      
      for (const pattern of allPatterns) {
        const key = `${pattern.resolved_city_id}-${pattern.resolved_region_id || 'null'}`;
        
        if (mergedPatterns.has(key)) {
          const existing = mergedPatterns.get(key);
          
          // دمج الإحصائيات
          existing.usage_count += pattern.usage_count;
          existing.confidence = Math.max(existing.confidence, pattern.confidence);
          existing.success_rate = (existing.success_rate + pattern.success_rate) / 2;
          
          // حذف النمط المكرر
          await supabase
            .from('location_learning_patterns')
            .delete()
            .eq('id', pattern.id);
          
          analysisResults.patterns_merged++;
        } else {
          mergedPatterns.set(key, pattern);
        }
      }
    }

    // 2. تحديث معدل الثقة بناءً على الاستخدام
    const { data: patternsToUpdate } = await supabase
      .from('location_learning_patterns')
      .select('*')
      .gte('usage_count', 5);

    if (patternsToUpdate) {
      for (const pattern of patternsToUpdate) {
        // زيادة الثقة كلما زاد الاستخدام
        const newConfidence = Math.min(
          pattern.confidence + (pattern.usage_count * 0.01),
          0.99
        );
        
        if (newConfidence !== pattern.confidence) {
          await supabase
            .from('location_learning_patterns')
            .update({ confidence: newConfidence })
            .eq('id', pattern.id);
          
          analysisResults.confidence_updated++;
        }
      }
    }

    // 3. حذف الأنماط القديمة وغير المستخدمة
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data: deletedPatterns } = await supabase
      .from('location_learning_patterns')
      .delete()
      .lt('last_used_at', threeMonthsAgo.toISOString())
      .lte('usage_count', 1)
      .select('count');

    if (deletedPatterns) {
      analysisResults.patterns_deleted = deletedPatterns.length;
    }

    // 4. تحديث city_aliases من الأنماط الناجحة
    const { data: successfulPatterns } = await supabase
      .from('location_learning_patterns')
      .select('*, cities_cache!inner(name)')
      .gte('confidence', 0.8)
      .gte('usage_count', 3);

    if (successfulPatterns) {
      for (const pattern of successfulPatterns) {
        const cityName = pattern.cities_cache.name.toLowerCase();
        const patternText = pattern.pattern_text.toLowerCase();
        
        // إضافة مرادف إذا كان مختلفاً
        if (patternText !== cityName && !patternText.includes(cityName)) {
          const { error } = await supabase
            .from('city_aliases')
            .upsert({
              city_id: pattern.resolved_city_id,
              alias_name: pattern.pattern_text,
              normalized_name: patternText,
              confidence_score: pattern.confidence
            }, { onConflict: 'alias_name' });
          
          if (!error) {
            analysisResults.aliases_added++;
          }
        }
      }
    }

    console.log('✅ تم التحليل بنجاح:', analysisResults);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'تم تحليل أنماط التعلم بنجاح',
        results: analysisResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ خطأ في تحليل الأنماط:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});