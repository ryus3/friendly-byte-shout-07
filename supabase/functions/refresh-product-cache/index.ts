import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📞 تلقي طلب تحديث الكاش...');
    
    // إنشاء Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('🔄 جلب المنتجات النشطة من قاعدة البيانات...');
    
    // جلب المنتجات النشطة مع المتغيرات
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select(`
        id,
        name,
        base_price,
        product_variants (
          color_id,
          size_id,
          colors (
            id,
            name
          ),
          sizes (
            id,
            name
          )
        )
      `)
      .eq('is_active', true);

    if (fetchError) {
      console.error('❌ خطأ في جلب المنتجات:', fetchError);
      throw fetchError;
    }

    console.log(`✅ تم جلب ${products?.length || 0} منتج`);

    // تحويل البيانات لصيغة الكاش
    const cacheData = (products || []).map(p => {
      const uniqueColors = new Map();
      const uniqueSizes = new Map();
      
      p.product_variants?.forEach((v: any) => {
        if (v.colors) {
          uniqueColors.set(v.colors.id, { id: v.colors.id, name: v.colors.name });
        }
        if (v.sizes) {
          uniqueSizes.set(v.sizes.id, { id: v.sizes.id, name: v.sizes.name });
        }
      });
      
      return {
        id: p.id,
        name: p.name,
        normalized_name: p.name.toLowerCase().trim(),
        base_price: p.base_price,
        colors: Array.from(uniqueColors.values()),
        sizes: Array.from(uniqueSizes.values()),
        updated_at: new Date().toISOString()
      };
    });

    console.log('🗑️ حذف الكاش القديم...');
    
    // حذف الكاش القديم
    const { error: deleteError } = await supabase
      .from('products_cache')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
      console.error('⚠️ خطأ في حذف الكاش القديم:', deleteError);
    }

    console.log('💾 إدراج الكاش الجديد...');
    
    // إدراج الكاش الجديد
    const { error: insertError } = await supabase
      .from('products_cache')
      .insert(cacheData);

    if (insertError) {
      console.error('❌ خطأ في إدراج الكاش:', insertError);
      throw insertError;
    }
    
    const responseData = {
      success: true,
      message: '✅ تم تحديث كاش المنتجات بنجاح في قاعدة البيانات',
      productsCount: cacheData.length,
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ اكتمل التحديث:', responseData);
    
    return new Response(
      JSON.stringify(responseData),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }, 
        status: 200 
      }
    );
  } catch (error) {
    console.error('❌ خطأ في تحديث الكاش:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'فشل تحديث الكاش',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }, 
        status: 500 
      }
    );
  }
});
