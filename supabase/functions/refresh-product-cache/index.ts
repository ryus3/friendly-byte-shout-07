import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getProductsCache } from '../shared/product-cache.ts';

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
    
    // فرض التحديث الفوري للكاش
    const cache = await getProductsCache(true);
    
    const responseData = {
      success: true,
      message: '✅ تم تحديث كاش المنتجات بنجاح',
      productsCount: cache.length,
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
