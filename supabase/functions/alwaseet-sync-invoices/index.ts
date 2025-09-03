import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.30.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AL_WASEET_API_URL = "https://api.alwaseet-iq.net/v1/merchant";

type Invoice = Record<string, any>;

type InvoiceOrdersResponse = {
  status: boolean;
  errNum?: string;
  msg?: string;
  data?: {
    invoice?: Invoice[];
    orders?: any[];
  };
};

type InvoicesResponse = {
  status: boolean;
  errNum?: string;
  msg?: string;
  data?: Invoice[];
};

async function fetchJson(url: string) {
  const res = await fetch(url, { method: 'GET' });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.msg || `HTTP ${res.status}`);
  }
  return json;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { token } = await req.json();

    if (!token || typeof token !== 'string') {
      return new Response(JSON.stringify({ success: false, error: 'Missing or invalid token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1) Get all merchant invoices
    const invoicesUrl = `${AL_WASEET_API_URL}/get_merchant_invoices?token=${encodeURIComponent(token)}`;
    const invoicesJson = await fetchJson(invoicesUrl) as InvoicesResponse;

    if (!invoicesJson.status) {
      throw new Error(invoicesJson.msg || 'Failed to fetch invoices');
    }

    const invoices = invoicesJson.data ?? [];

    const results: any[] = [];
    let processed = 0;
    let receivedCount = 0;
    let linkedOrdersTotal = 0;

    // 2) For each invoice, fetch its orders and upsert into DB via RPC
    for (const inv of invoices) {
      const invoiceId = String(inv.id);
      const ordersUrl = `${AL_WASEET_API_URL}/get_merchant_invoice_orders?token=${encodeURIComponent(token)}&invoice_id=${encodeURIComponent(invoiceId)}`;
      const invoiceOrdersJson = await fetchJson(ordersUrl) as InvoiceOrdersResponse;

      if (!invoiceOrdersJson.status) {
        results.push({ invoiceId, success: false, error: invoiceOrdersJson.msg || 'Failed to fetch invoice orders' });
        continue;
      }

      const orders = invoiceOrdersJson.data?.orders ?? [];
      const invoiceMeta = (invoiceOrdersJson.data?.invoice ?? [inv])[0] ?? inv;

      // 3) Call DB function to persist and link
      const { data: rpcData, error: rpcError } = await supabase.rpc('sync_alwaseet_invoice_data', {
        p_invoice_data: invoiceMeta,
        p_orders_data: orders,
      });

      if (rpcError) {
        console.error('RPC error for invoice', invoiceId, rpcError.message);
        results.push({ invoiceId, success: false, error: rpcError.message });
        continue;
      }

      processed += 1;
      if (rpcData?.invoice_received) receivedCount += 1;
      linkedOrdersTotal += rpcData?.linked_orders ?? 0;

      results.push({ invoiceId, success: true, summary: rpcData });
    }

    const response = {
      success: true,
      processed,
      receivedCount,
      linkedOrdersTotal,
      invoicesCount: invoices.length,
      results,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('alwaseet-sync-invoices error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});