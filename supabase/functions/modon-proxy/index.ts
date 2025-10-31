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

    console.log('🔄 Calling MODON API:', url);
    
    const response = await fetch(url, options);
    
    // MODON API often returns JSON without proper Content-Type header
    // Try to parse as JSON first, fallback to text if it fails
    let data;
    const responseText = await response.text();
    
    try {
      data = JSON.parse(responseText);
      console.log('✅ MODON Response:', { status: response.status, hasData: !!data });
    } catch (parseError) {
      // If JSON parsing fails, it's likely an HTML error page
      console.error('❌ MODON returned non-JSON response:', responseText.substring(0, 200));
      
      data = {
        status: false,
        errNum: '999',
        msg: `خطأ في الاتصال بـ MODON API. الرد غير صحيح (${response.status}). تحقق من بيانات الدخول أو الـ endpoint.`
      };
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
