import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODON_BASE_URL = 'https://mcht.modon-express.net/v1/merchant';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { endpoint, method, token, payload, queryParams, isFormData } = await req.json();
    
    console.log('📦 MODON Proxy Request:', { endpoint, method, isFormData });

    let url = `${MODON_BASE_URL}/${endpoint}`;
    
    if (queryParams) {
      const params = new URLSearchParams(queryParams);
      url += `?${params.toString()}`;
    }

    const headers: Record<string, string> = {};

    // Login, create-order, edit-order, and delete_orders endpoints use FormData
    if (isFormData && (endpoint === 'login' || endpoint === 'create-order' || endpoint === 'edit-order' || endpoint === 'delete_orders')) {
      // Don't set Content-Type for FormData - browser will set it automatically with boundary
      console.log('📝 Using FormData for endpoint:', endpoint);
    } else {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    // Handle body based on content type
    if (payload && (method === 'POST' || method === 'PUT')) {
      if (isFormData) {
        // Create FormData for login and create-order endpoints
        const formData = new FormData();
        Object.keys(payload).forEach(key => {
          formData.append(key, payload[key]);
        });
        options.body = formData;
        
        // ✅ Logging تشخيصي
        console.log('📝 FormData fields:', Object.keys(payload));
        console.log('📞 Phone field in payload:', payload.client_mobile);
      } else {
        options.body = JSON.stringify(payload);
      }
    }

    console.log('📤 ===== MODON Proxy Request =====');
    console.log('🔗 Endpoint:', endpoint);
    console.log('📍 Method:', method);
    console.log('🔑 Has Token:', !!token);
    console.log('🌐 Full URL:', url);
    console.log('🔄 Calling MODON API...');
    
    const response = await fetch(url, options);
    
    console.log('📡 ===== MODON HTTP Response =====');
    console.log('✅ Status:', response.status, response.statusText);
    console.log('✅ OK:', response.ok);
    
    // قراءة الـ response كـ text أولاً لتجنب أخطاء JSON parsing
    const responseText = await response.text();
    console.log('📄 Raw Response (first 500 chars):', responseText.substring(0, 500));
    
    // محاولة parse كـ JSON
    let data;
    try {
      data = JSON.parse(responseText);
      console.log('📥 Parsed Data:', {
        status: data.status,
        errNum: data.errNum,
        hasData: !!data.data
      });
    } catch (parseError) {
      console.error('❌ فشل parse JSON:', parseError.message);
      data = { 
        status: false, 
        errNum: 'E_PARSE', 
        msg: 'Response is not valid JSON', 
        raw: responseText.substring(0, 200)
      };
    }
    
    // معالجة أخطاء HTTP الشائعة
    if (response.status === 400) {
      console.error('❌ HTTP 400: Bad Request');
      return new Response(JSON.stringify({
        status: false,
        errNum: 'E400',
        msg: 'طلب غير صالح - تحقق من البيانات المُرسلة أو صلاحية Token',
        httpStatus: 400
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    if (response.status === 401) {
      console.error('❌ HTTP 401: Unauthorized');
      return new Response(JSON.stringify({
        status: false,
        errNum: 'E401',
        msg: 'ليس لديك صلاحية - قد تحتاج لتسجيل دخول جديد إلى MODON',
        httpStatus: 401
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Always return 200 to client, error info is in data
    });

  } catch (error) {
    console.error('❌ MODON Proxy Error:', error);
    return new Response(
      JSON.stringify({ 
        status: false, 
        errNum: '999',
        msg: error instanceof Error ? error.message : 'خطأ غير معروف' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
