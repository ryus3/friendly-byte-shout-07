import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALWASEET_BASE_URL = "https://www.waseetdelivery.com/api/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { endpoint, method = "GET", token, payload, queryParams, username, password } = await req.json();

    // Handle login separately
    if (endpoint === "login") {
      const loginUrl = `${ALWASEET_BASE_URL}/auth/login`;
      const loginRes = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const loginText = await loginRes.text();
      let loginData;
      try {
        loginData = JSON.parse(loginText);
      } catch {
        console.error("AlWaseet login returned non-JSON:", loginText.substring(0, 500));
        return new Response(
          JSON.stringify({ ok: false, msg: "AlWaseet API returned invalid response (not JSON)", status: loginRes.status }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify(loginData), {
        status: loginRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build URL with query params
    let url = `${ALWASEET_BASE_URL}/${endpoint}`;
    if (queryParams) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        params.append(key, String(value));
      }
      url += `?${params.toString()}`;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const fetchOptions: RequestInit = { method, headers };
    if (payload && method !== "GET") {
      fetchOptions.body = JSON.stringify(payload);
    }

    const response = await fetch(url, fetchOptions);
    const responseText = await response.text();

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      console.error(`AlWaseet API returned non-JSON for ${endpoint}:`, responseText.substring(0, 500));
      return new Response(
        JSON.stringify({
          ok: false,
          msg: `AlWaseet API returned HTML/invalid response for ${endpoint}`,
          status: response.status,
          retryAfter: response.status === 429 ? 30 : null,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(responseData), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("AlWaseet Proxy Error:", error);
    return new Response(
      JSON.stringify({ ok: false, msg: error.message || "Internal proxy error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
