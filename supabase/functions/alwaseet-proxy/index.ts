// AlWaseet Proxy — V3
// CRITICAL CONTRACT: this function MUST always return HTTP 200 with a structured JSON body.
// Frontend (alwaseet-api.js) interprets `errNum` and `requireRelogin` flags to decide what to do.
// Returning non-200 makes Lovable show a runtime error overlay even though the issue is logical.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ALWASEET_PROXY_URL = 'https://api.ryusbrand.com/alwaseet/v1/merchant';
const ALWASEET_DIRECT_URL = 'https://api.alwaseet-iq.net/v1/merchant';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown proxy error';

const extractRayId = (html: string): string | null => {
  const match = html.match(/Ray\s*ID:\s*<strong[^>]*>([a-f0-9]+)<\/strong>/i);
  return match ? match[1] : null;
};

const isCloudflareBlock = (status: number, text: string): boolean =>
  (status === 403 || status === 503) &&
  (text.includes('Cloudflare') || text.includes('cf-error') || text.includes('Attention Required'));

const buildFetchOptions = (
  method: string,
  payload?: Record<string, unknown>,
): RequestInit => {
  const upperMethod = method.toUpperCase();
  const fetchOptions: RequestInit = { method: upperMethod };

  if (upperMethod === 'GET' || upperMethod === 'DELETE') {
    fetchOptions.headers = { Accept: 'application/json' };
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

// Best-effort: deactivate the offending token row in DB so the frontend stops reusing it.
// IMPORTANT: deactivate ONLY the row that owns this exact (token, partner, user, account_username).
// Different users may share the same delivery account, so we must not flip is_active for everyone.
async function deactivateBadToken(token: string | null | undefined, hint?: {
  partnerName?: string;
  accountUsername?: string;
  userId?: string;
}) {
  if (!token) return;
  // Without user_id we cannot tell whose shared delivery-account row this is; do nothing to avoid
  // deactivating the same AlWaseet account for multiple employees/admins.
  if (!hint?.userId) {
    console.warn('[AlWaseet Proxy] deactivateBadToken skipped: no user_id hint');
    return;
  }
  try {
    let query = supabase
      .from('delivery_partner_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('token', token)
      .eq('partner_name', hint?.partnerName || 'alwaseet');

    if (hint?.userId) query = query.eq('user_id', hint.userId);
    if (hint?.accountUsername) {
      const norm = String(hint.accountUsername).trim().toLowerCase();
      query = query.eq('normalized_username', norm);
    }

    const { error } = await query;
    if (error) {
      console.warn('[AlWaseet Proxy] deactivateBadToken warning:', error.message);
    } else {
      console.warn(`[AlWaseet Proxy] Deactivated expired token (scoped, len=${token.length})`);
    }
  } catch (err) {
    console.warn('[AlWaseet Proxy] deactivateBadToken failed:', getErrorMessage(err));
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      endpoint,
      method = 'GET',
      token,
      payload,
      queryParams,
      // Optional context — used only to deactivate the offending DB row when token is invalid.
      partnerName,
      accountUsername,
      userId,
    } = body || {};

    if (!endpoint) {
      return json(
        {
          status: false,
          ok: false,
          errNum: 'BAD_REQUEST',
          msg: 'endpoint is required',
          fallback: true,
        },
        200,
      );
    }

    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        params.set(key, String(value));
      }
    }
    const qs = params.toString();
    const suffix = `/${endpoint}${qs ? `?${qs}` : ''}`;

    const fetchOptions = buildFetchOptions(method, payload);

    const proxyUrl = `${ALWASEET_PROXY_URL}${suffix}`;
    let usedSource: 'proxy' | 'direct' = 'proxy';
    let response: Response;
    let responseText: string;
    let contentType: string;

    console.log(`[AlWaseet Proxy] ${method} /${endpoint} (via static proxy)`);

    try {
      response = await fetch(proxyUrl, fetchOptions);
      contentType = response.headers.get('content-type') || '';
      responseText = await response.text();

      // Only fall back on real upstream failures (5xx). 4xx is a real answer.
      if (response.status >= 500 && response.status < 600) {
        throw new Error(`Proxy returned ${response.status}`);
      }
    } catch (proxyError) {
      console.warn(
        `[AlWaseet Proxy] Static proxy failed: ${getErrorMessage(proxyError)} — falling back to direct`,
      );
      usedSource = 'direct';
      const directUrl = `${ALWASEET_DIRECT_URL}${suffix}`;
      response = await fetch(directUrl, buildFetchOptions(method, payload));
      contentType = response.headers.get('content-type') || '';
      responseText = await response.text();
    }

    console.log(
      `[AlWaseet Proxy] /${endpoint} source=${usedSource} status=${response.status} bytes=${responseText.length}`,
    );

    // Cloudflare WAF block — return structured fallback.
    if (isCloudflareBlock(response.status, responseText)) {
      const rayId = extractRayId(responseText);
      console.error(
        `[AlWaseet Proxy] Cloudflare BLOCKED endpoint=${endpoint} status=${response.status} rayId=${rayId}`,
      );
      return json({
        status: false,
        ok: false,
        errNum: 'CF_BLOCKED',
        msg: 'مزود التوصيل حظر الطلب مؤقتاً. يرجى المحاولة بعد قليل.',
        error: 'DELIVERY_SERVICE_BLOCKED',
        details: {
          upstreamStatus: response.status,
          rayId,
          endpoint,
          blockedByCloudflare: true,
        },
        fallback: true,
      });
    }

    // Rate limited — keep 200 so frontend can show a friendly retry instead of crashing.
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      return json({
        status: false,
        ok: false,
        errNum: 'RATE_LIMITED',
        msg: 'تم تجاوز الحد المسموح به مؤقتاً. حاول بعد قليل.',
        retryAfter: retryAfter ? parseInt(retryAfter) : 30,
        fallback: true,
      });
    }

    // Parse upstream body
    let data: any;
    if (contentType.includes('application/json')) {
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { raw: responseText };
      }
    } else {
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { raw: responseText.substring(0, 500) };
      }
    }

    // `statuses` is treated as static/cacheable in the frontend. Some AlWaseet accounts return errNum:21
    // for this endpoint even while order endpoints still work, so never invalidate a login because of it.
    if (endpoint === 'statuses' && data && (data.errNum === 21 || data.errNum === '21')) {
      console.warn('[AlWaseet Proxy] Ignored TOKEN_EXPIRED from statuses endpoint; returning empty status cache');
      return json({ status: true, ok: true, errNum: 'S000', data: [], fallback: true });
    }

    // errNum 21 = invalid/expired/forbidden token. Deactivate it in DB and return a clean envelope.
    if (data && (data.errNum === 21 || data.errNum === '21')) {
      console.warn(
        `[AlWaseet Proxy] TOKEN_EXPIRED (errNum:21) endpoint=${endpoint} partner=${partnerName || 'alwaseet'}`,
      );

      // Fire-and-forget: do not block the response on DB write.
      deactivateBadToken(token, {
        partnerName: partnerName || 'alwaseet',
        accountUsername,
        userId,
      }).catch(() => undefined);

      return json({
        status: false,
        ok: false,
        errNum: 'TOKEN_EXPIRED',
        msg: 'انتهت صلاحية جلسة الوسيط. يرجى تسجيل الدخول مجدداً من إعدادات شركة التوصيل.',
        error: 'DELIVERY_TOKEN_EXPIRED',
        requireRelogin: true,
        fallback: true,
        details: {
          endpoint,
          originalErrNum: data.errNum,
          originalMsg: data.msg,
        },
      });
    }

    // Non-2xx upstream that is NOT errNum 21 / CF / 429 — still return JSON envelope as 200
    // so the frontend can react without a runtime overlay.
    if (!response.ok) {
      console.warn(
        `[AlWaseet Proxy] Non-2xx upstream wrapped: endpoint=${endpoint} status=${response.status}`,
      );
      return json({
        ok: false,
        status: data?.status ?? false,
        errNum: data?.errNum ?? 'UPSTREAM_ERROR',
        msg: data?.msg || `Upstream ${response.status}`,
        data: data?.data ?? null,
        upstreamStatus: response.status,
        fallback: true,
      });
    }

    return json(data);
  } catch (error) {
    console.error('[AlWaseet Proxy] Fatal error:', error);
    return json({
      ok: false,
      status: false,
      errNum: 'PROXY_ERROR',
      msg: getErrorMessage(error),
      fallback: true,
    });
  }
});
