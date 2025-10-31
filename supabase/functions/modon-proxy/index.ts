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

    // Login endpoint uses FormData, others use JSON
    if (isFormData && endpoint === 'login') {
      // Don't set Content-Type for FormData - browser will set it automatically with boundary
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
      if (isFormData && endpoint === 'login') {
        // Create FormData for login
        const formData = new FormData();
        formData.append('username', payload.username);
        formData.append('password', payload.password);
        options.body = formData;
      } else {
        options.body = JSON.stringify(payload);
      }
    }

    console.log('🔄 Calling MODON API:', url);
    
    const response = await fetch(url, options);
    const data = await response.json();

    console.log('✅ MODON Response:', { status: response.status, hasData: !!data });

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: response.status,
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
