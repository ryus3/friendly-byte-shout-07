/* global Deno */
import { corsHeaders } from "./cors.ts";

const AL_WASEET_API_URL = "https://api.alwaseet-iq.net/v1/merchant";

// Helper function to convert payload object to FormData
const objectToFormData = (obj) => {
    const formData = new FormData();
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            formData.append(key, obj[key]);
        }
    }
    return formData;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { endpoint, method, token, payload, queryParams } = await req.json();

    const headers = {
      "Accept": "application/json",
      ...corsHeaders,
    };

    let body = null;
    let url = new URL(`${AL_WASEET_API_URL}/${endpoint}`);

    if (queryParams) {
      Object.keys(queryParams).forEach(key => url.searchParams.append(key, queryParams[key]));
    }

    if (token && endpoint !== 'create-order') { // Token is in query for create-order
      headers["auth-token"] = token;
    }
    
    // Al-Waseet API uses multipart/form-data for POST requests
    if (method === 'POST') {
        body = objectToFormData(payload);
    } else if (method === 'GET' && payload) {
        // For GET requests with payload, append to query params
        Object.keys(payload).forEach(key => url.searchParams.append(key, payload[key]));
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body,
    });
    
    const responseData = await response.json();

    if (!response.ok) {
        return new Response(JSON.stringify(responseData), {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // The API returns "citys" for cities endpoint, let's normalize it to "cities"
    if (endpoint === 'citys' && responseData.data) {
        responseData.data = responseData.data.map(city => ({
            id: city.id,
            name: city.city_name
        }));
    }

    // The API returns "region_name" for regions endpoint, let's normalize it to "name"
    if (endpoint.startsWith('regions') && responseData.data) {
        responseData.data = responseData.data.map(region => ({
            id: region.id,
            name: region.region_name
        }));
    }

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ msg: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});