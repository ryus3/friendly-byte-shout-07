import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AL_WASEET_API_URL = "https://api.alwaseet-iq.net/v1/merchant";

// Helper function to convert payload object to FormData
const objectToFormData = (obj: any) => {
  const formData = new FormData();
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      formData.append(key, obj[key]);
    }
  }
  return formData;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { endpoint, method, token, payload, queryParams } = await req.json();

    const headers: any = {
      "Accept": "application/json",
      ...corsHeaders,
    };

    let body = null;
    let url = new URL(`${AL_WASEET_API_URL}/${endpoint}`);

    if (queryParams) {
      Object.keys(queryParams).forEach(key => url.searchParams.append(key, queryParams[key]));
    }

    // For edit-order, token goes in query params only. For other endpoints, use auth-token header
    if (token) {
      if (endpoint === 'create-order' || endpoint === 'edit-order') {
        // Token already in query params, don't add to headers
      } else {
        headers["auth-token"] = token;
      }
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
      responseData.data = responseData.data.map((city: any) => ({
        id: city.id,
        name: city.city_name
      }));
    }

    // The API returns "region_name" for regions endpoint, let's normalize it to "name"
    if (endpoint.startsWith('regions') && responseData.data) {
      responseData.data = responseData.data.map((region: any) => ({
        id: region.id,
        name: region.region_name
      }));
    }

    // Handle merchant-orders endpoint
    if (endpoint === 'merchant-orders' && responseData.data) {
      // Normalize the orders data structure
      responseData.data = responseData.data.map((order: any) => ({
        id: order.id,
        qr_id: order.qr_id || order.tracking_number,
        client_name: order.client_name,
        client_mobile: order.client_mobile,
        client_mobile2: order.client_mobile2,
        city_name: order.city_name,
        region_name: order.region_name,
        city_id: order.city_id,
        region_id: order.region_id,
        location: order.location,
        type_name: order.type_name,
        items_number: order.items_number,
        price: order.price,
        delivery_price: order.delivery_price,
        package_size: order.package_size,
        merchant_notes: order.merchant_notes,
        issue_notes: order.issue_notes,
        status_id: order.status_id,
        status: order.status,
        status_text: order.status_text || order.status_name || order.status,
        status_name: order.status_name || order.status_text || order.status,
        replacement: order.replacement,
        created_at: order.created_at,
        updated_at: order.updated_at,
        has_merchant_fin_record: order.has_merchant_fin_record,
        deliver_confirmed_fin: order.deliver_confirmed_fin,
        merchant_invoice_id: order.merchant_invoice_id
      }));
    }

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error('AlWaseet Proxy Error:', error);
    return new Response(JSON.stringify({ msg: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});