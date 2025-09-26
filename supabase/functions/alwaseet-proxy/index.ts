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

    // For specific endpoints, token must be in query params only. For others, use auth-token header
    if (token) {
      if (endpoint === 'create-order' || endpoint === 'edit-order' || endpoint === 'statuses') {
        // Ensure token exists in query params
        if (!url.searchParams.has('token')) {
          url.searchParams.append('token', token);
        }
        // Do not add to headers for these endpoints
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

    // Normalize statuses endpoint to ensure consistent shape and string ids
    if (endpoint === 'statuses' && responseData.data) {
      responseData.data = responseData.data.map((s: any) => ({
        id: String(s.id ?? s.status_id ?? s.value),
        status: s.status || s.status_text || s.name
      }));
    }

    // Normalize create-order response to always expose id and qr_id
    if (endpoint === 'create-order') {
      const d: any = responseData?.data ?? {};
      const fromNested = (obj: any, key: string) => obj?.[key] ?? obj?.order?.[key] ?? obj?.data?.[key];
      const normId = String(fromNested(d, 'id') ?? fromNested(d, 'order_id') ?? fromNested(d, 'qr_id') ?? '').trim();
      const normQr = String(fromNested(d, 'qr_id') ?? fromNested(d, 'tracking_number') ?? fromNested(d, 'qrId') ?? normId).trim();
      const normLink = fromNested(d, 'qr_link') ?? fromNested(d, 'qrUrl') ?? fromNested(d, 'link') ?? null;

      responseData.data = {
        ...(typeof d === 'object' && d ? d : {}),
        id: normId || (responseData.data?.id ?? ''),
        qr_id: normQr || (responseData.data?.qr_id ?? ''),
        qr_link: normLink,
      };
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

    // Handle invoice endpoints
    if (endpoint === 'get_merchant_invoices' && responseData.data) {
      // Normalize invoice data structure
      responseData.data = responseData.data.map((invoice: any) => ({
        id: invoice.id,
        merchant_price: invoice.merchant_price,
        delivered_orders_count: invoice.delivered_orders_count,
        replacement_delivered_orders_count: invoice.replacement_delivered_orders_count,
        status: invoice.status,
        merchant_id: invoice.merchant_id,
        updated_at: invoice.updated_at
      }));
    }

    if (endpoint === 'get_merchant_invoice_orders' && responseData.data) {
      // Normalize invoice orders response
      responseData.data = {
        invoice: responseData.data.invoice ? responseData.data.invoice.map((invoice: any) => ({
          id: invoice.id,
          merchant_price: invoice.merchant_price,
          delivered_orders_count: invoice.delivered_orders_count,
          replacement_delivered_orders_count: invoice.replacement_delivered_orders_count,
          status: invoice.status,
          merchant_id: invoice.merchant_id,
          updated_at: invoice.updated_at
        })) : [],
        orders: responseData.data.orders ? responseData.data.orders.map((order: any) => ({
          id: order.id,
          qr_id: order.qr_id || order.tracking_number,
          client_name: order.client_name,
          client_mobile: order.client_mobile,
          client_mobile2: order.client_mobile2,
          items_number: order.items_number,
          created_at: order.created_at,
          city_name: order.city_name,
          region_name: order.region_name,
          status_id: order.status_id,
          status: order.status,
          price: order.price,
          location: order.location,
          issue_notes: order.issue_notes,
          merchant_notes: order.merchant_notes,
          updated_at: order.updated_at,
          city_id: order.city_id,
          region_id: order.region_id,
          replacement: order.replacement,
          type_name: order.type_name,
          delivery_price: order.delivery_price,
          package_size: order.package_size,
          merchant_invoice_id: order.merchant_invoice_id
        })) : []
      };
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