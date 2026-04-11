const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALWASEET_BASE_URL = 'https://api.alwaseet-iq.net/v1/merchant';

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return 'Unknown proxy error';
};

const buildFetchOptions = (method: string, payload?: Record<string, unknown>): RequestInit => {
  const upperMethod = method.toUpperCase();
  const fetchOptions: RequestInit = { method: upperMethod };

  if (upperMethod === 'GET' || upperMethod === 'DELETE') {
    fetchOptions.headers = {
      'Accept': 'application/json',
    };
  }

  if (payload && (upperMethod === 'POST' || upperMethod === 'PUT')) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(payload)) {
      if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    }
    fetchOptions.body = formData;
  }

  return fetchOptions;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { endpoint, method = 'GET', token, payload, queryParams } = await req.json();

    if (!endpoint) {
      return new Response(
        JSON.stringify({ ok: false, msg: 'endpoint is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build URL
    let url = `${ALWASEET_BASE_URL}/${endpoint}`;
    
    // Add query params
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        params.set(key, String(value));
      }
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;

    console.log(`[AlWaseet Proxy] ${method} ${url}`);

    const fetchOptions = buildFetchOptions(method, payload);

    const response = await fetch(url, fetchOptions);
    
    let data;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      return new Response(
        JSON.stringify({ ok: false, msg: 'Rate limited', retryAfter: retryAfter ? parseInt(retryAfter) : 30 }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(data),
      { 
        status: response.ok ? 200 : response.status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('AlWaseet Proxy Error:', error);
    return new Response(
      JSON.stringify({ ok: false, msg: getErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
