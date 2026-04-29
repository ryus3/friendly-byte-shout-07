import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODON_PROXY_URL = 'https://api.ryusbrand.com/modon/v1/merchant';
const MODON_DIRECT_URL = 'https://mcht.modon-express.net/v1/merchant';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { endpoint, method, token, payload, queryParams, isFormData } = await req.json();
    
    console.log('📦 MODON Proxy Request:', { endpoint, method, isFormData });

    // 🔑 CRITICAL FIX (per https://modon-express.com/api-doc):
    //   MODON requires the auth token to be passed as a QUERY STRING parameter
    //   on ALL authenticated endpoints, e.g. /create-order?token=loginToken
    //   The Authorization: Bearer header is NOT what MODON checks for these
    //   merchant endpoints — passing the token only in the header was the
    //   reason create-order/edit-order/delete_orders kept returning
    //   errNum:21 ("ليس لديك صلاحية الوصول") even when the token was valid.
    //   Listing/invoice endpoints already worked because the frontend was
    //   passing { token } in queryParams for them.
    const mergedQueryParams: Record<string, string> = {};
    if (queryParams && typeof queryParams === 'object') {
      for (const [k, v] of Object.entries(queryParams)) {
        mergedQueryParams[k] = String(v);
      }
    }
    if (token && endpoint !== 'login' && !mergedQueryParams.token) {
      mergedQueryParams.token = String(token);
    }

    let suffix = `/${endpoint}`;
    if (Object.keys(mergedQueryParams).length > 0) {
      const params = new URLSearchParams(mergedQueryParams);
      suffix += `?${params.toString()}`;
    }
    let url = `${MODON_PROXY_URL}${suffix}`;
    let usedSource: 'proxy' | 'direct' = 'proxy';

    const headers: Record<string, string> = {};

    // Login, create-order, edit-order, and delete_orders endpoints use FormData
    if (isFormData && (endpoint === 'login' || endpoint === 'create-order' || endpoint === 'edit-order' || endpoint === 'delete_orders')) {
      // Don't set Content-Type for FormData - browser will set it automatically with boundary
      console.log('📝 Using FormData for endpoint:', endpoint);
    } else {
      headers['Content-Type'] = 'application/json';
    }

    // Keep Authorization header as a redundant best-effort.
    // Primary auth source is the ?token=... query param above.
    if (token && endpoint !== 'login') {
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
    console.log('🔄 Calling MODON API via static proxy (AWS Lightsail)...');
    
    let response: Response;
    let responseText: string;
    try {
      response = await fetch(url, options);
      // Fall back on 5xx
      if (response.status >= 500 && response.status < 600) {
        throw new Error(`Proxy returned ${response.status}`);
      }
      responseText = await response.text();
    } catch (proxyError) {
      console.warn('⚠️ MODON static proxy failed, falling back to direct:', proxyError instanceof Error ? proxyError.message : proxyError);
      usedSource = 'direct';
      const directUrl = `${MODON_DIRECT_URL}${suffix}`;
      console.log('🔁 Direct fallback URL:', directUrl);
      // Rebuild body for FormData (a stream may have been consumed); re-create options
      const fallbackOptions: RequestInit = { method, headers: { ...headers } };
      if (payload && (method === 'POST' || method === 'PUT')) {
        if (isFormData) {
          const fd = new FormData();
          Object.keys(payload).forEach(key => fd.append(key, payload[key]));
          fallbackOptions.body = fd;
        } else {
          fallbackOptions.body = JSON.stringify(payload);
        }
      }
      response = await fetch(directUrl, fallbackOptions);
      responseText = await response.text();
    }
    
    console.log('📡 ===== MODON HTTP Response =====');
    console.log(`✅ Source: ${usedSource}`);
    console.log('✅ Status:', response.status, response.statusText);
    console.log('✅ OK:', response.ok);
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

      // 🛡️ تمييز errNum:21 حسب الـ endpoint
      // - endpoints الفواتير: errNum:21 = "لا توجد فواتير" (حالة طبيعية)
      // - أي endpoint آخر (create-order/edit-order/...): errNum:21 = خطأ حقيقي
      const isInvoicesEndpoint =
        typeof endpoint === 'string' &&
        (endpoint.includes('merchant-invoices') || endpoint.includes('invoices'));

      if ((data.errNum === 21 || data.errNum === '21') && isInvoicesEndpoint) {
        console.log('ℹ️ HTTP 400 + errNum:21 على endpoint الفواتير = لا توجد فواتير (طبيعي)');
        return new Response(JSON.stringify({
          status: true,
          errNum: '21',
          msg: data.msg || 'لا توجد فواتير',
          data: []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      // errNum:21 على endpoints أخرى:
      // - create-order/edit-order/delete_orders: السبب الأشيع هو "ليس لديك صلاحية الوصول"
      //   وهذا تقريباً دائماً = التوكن لم يصل بصيغة query ?token=... كما تتطلبه مدن.
      //   (لاحظنا هذا فعلياً في اللوج: msg = "ليس لديك صلاحية الوصول".)
      //   تم إصلاح ذلك أعلاه بإضافة token تلقائياً إلى queryParams.
      // - بقية الـ endpoints: قد يكون فعلاً خطأ مدينة/منطقة.
      if (data.errNum === 21 || data.errNum === '21') {
        const isOrderMutation = ['create-order', 'edit-order', 'delete_orders'].includes(endpoint);
        const friendlyMsg = isOrderMutation
          ? `مدن رفضت إنشاء/تعديل/حذف الطلب: ${data.msg || 'ليس لديك صلاحية الوصول'}. ` +
            `تحقّق من حساب مدن (هل هو فعّال ولديه صلاحية إنشاء طلبات؟)، ومن سلامة التوكن (سجّل دخول مدن مجدداً إن لزم).`
          : `مدن رفضت العملية على ${endpoint}: ${data.msg || 'غير معروف'}.`;
        console.error(`❌ MODON رفض الطلب على endpoint=${endpoint} مع errNum:21 (${data.msg})`);
        return new Response(JSON.stringify({
          status: false,
          errNum: '21',
          msg: friendlyMsg,
          originalMsg: data.msg,
          httpStatus: 400
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      // ❌ أخطاء HTTP 400 الأخرى
      return new Response(JSON.stringify({
        status: false,
        errNum: data.errNum || 'E400',
        msg: data.msg || 'طلب غير صالح - تحقق من البيانات المُرسلة أو صلاحية Token',
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
