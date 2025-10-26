/**
 * Vercel Edge Function - AlWaseet Webhook Handler
 * يستقبل webhooks من شركة التوصيل ويحولها إلى Supabase Edge Function
 */

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    // Get request body
    const body = await req.json();
    
    console.log('AlWaseet Webhook received:', {
      method: req.method,
      url: req.url,
      body: body,
    });

    // Forward to Supabase Edge Function
    const supabaseUrl = 'https://tkheostkubborwkwzugl.supabase.co/functions/v1/telegram-bot-alwaseet';
    const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const response = await fetch(supabaseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    console.log('Supabase Edge Function response:', {
      status: response.status,
      data: data,
    });

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('AlWaseet Webhook error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }), 
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
