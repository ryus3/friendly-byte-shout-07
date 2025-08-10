import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get bot token from database settings with ENV fallback
async function getBotToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'telegram_bot_config')
      .maybeSingle();

    const tokenFromDb = (data && (typeof data.value === 'string' ? data.value : data.value?.bot_token)) || null;
    if (tokenFromDb && String(tokenFromDb).trim()) return String(tokenFromDb).trim();
  } catch (error) {
    console.error('Error reading settings for bot token:', error);
  }

  const envToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (envToken && envToken.trim()) return envToken.trim();
  return null;
}

const EXPECTED_WEBHOOK_URL = `https://tkheostkubborwkwzugl.supabase.co/functions/v1/telegram-bot`;

async function setWebhook(botToken: string) {
  const resp = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: EXPECTED_WEBHOOK_URL, allowed_updates: ['message'] })
  });
  const data = await resp.json();
  return data;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = await getBotToken();
    if (!botToken) {
      return new Response(JSON.stringify({ error: 'Bot token not found in DB or ENV' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(req.url);
    const force = url.searchParams.get('force') === '1' || url.searchParams.get('auto') === '1' || url.searchParams.get('set') === '1';

    // Current webhook info
    const webhookInfoResp = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const webhookInfo = await webhookInfoResp.json();

    // Check bot info
    const botResp = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const botInfo = await botResp.json();

    // Auto-fix webhook if missing or different or forced
    let action: 'none' | 'set' = 'none';
    let setResult: any = null;
    const currentUrl = webhookInfo?.result?.url || '';

    if (force || !currentUrl || currentUrl !== EXPECTED_WEBHOOK_URL) {
      setResult = await setWebhook(botToken);
      action = 'set';
    }

    return new Response(JSON.stringify({
      ok: true,
      action,
      expected: EXPECTED_WEBHOOK_URL,
      current: currentUrl,
      setResult,
      webhook: webhookInfo,
      bot: botInfo,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in webhook check:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
