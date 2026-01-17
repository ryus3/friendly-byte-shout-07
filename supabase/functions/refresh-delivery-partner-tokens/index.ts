import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TokenRecord {
  id: string;
  partner_name: string;
  token: string;
  expires_at: string | null;
  partner_data: {
    password?: string;
    username?: string;
  } | null;
  account_username: string | null;
  user_id: string | null;
}

interface AlWaseetLoginResponse {
  success: boolean;
  token?: string;
  expires_at?: string;
  error?: string;
}

async function loginToAlWaseet(username: string, password: string): Promise<AlWaseetLoginResponse> {
  try {
    const response = await fetch('https://app.alwaseet-ye.com/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ identifier: username, password }),
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    
    if (data.token) {
      // Token expires in 7 days
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      return {
        success: true,
        token: data.token,
        expires_at: expiresAt.toISOString(),
      };
    }

    return { success: false, error: data.message || 'No token in response' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get tokens that need renewal (auto_renew_enabled=true and expiring within 24 hours)
    const renewalWindowHours = 24;
    const renewalThreshold = new Date();
    renewalThreshold.setHours(renewalThreshold.getHours() + renewalWindowHours);

    const { data: tokens, error: fetchError } = await supabase
      .from('delivery_partner_tokens')
      .select('id, partner_name, token, expires_at, partner_data, account_username, user_id')
      .eq('is_active', true)
      .eq('auto_renew_enabled', true)
      .eq('partner_name', 'alwaseet') // Currently only AlWaseet
      .or(`expires_at.is.null,expires_at.lte.${renewalThreshold.toISOString()}`);

    if (fetchError) {
      console.error('Error fetching tokens:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch tokens' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!tokens || tokens.length === 0) {
      console.log('No tokens need renewal at this time');
      return new Response(
        JSON.stringify({ success: true, message: 'No tokens need renewal', renewed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${tokens.length} tokens needing renewal`);

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const tokenRecord of tokens as TokenRecord[]) {
      const username = tokenRecord.account_username || tokenRecord.partner_data?.username;
      const password = tokenRecord.partner_data?.password;

      if (!username || !password) {
        console.warn(`Token ${tokenRecord.id}: Missing credentials, skipping`);
        results.push({ id: tokenRecord.id, success: false, error: 'Missing credentials' });
        continue;
      }

      console.log(`Renewing token for account: ${username}`);
      
      const loginResult = await loginToAlWaseet(username, password);

      if (loginResult.success && loginResult.token) {
        // Update token in database
        const { error: updateError } = await supabase
          .from('delivery_partner_tokens')
          .update({
            token: loginResult.token,
            expires_at: loginResult.expires_at,
            last_used_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', tokenRecord.id);

        if (updateError) {
          console.error(`Failed to update token ${tokenRecord.id}:`, updateError);
          results.push({ id: tokenRecord.id, success: false, error: 'Database update failed' });
        } else {
          console.log(`Successfully renewed token for ${username}`);
          results.push({ id: tokenRecord.id, success: true });
        }
      } else {
        console.error(`Failed to renew token for ${username}:`, loginResult.error);
        results.push({ id: tokenRecord.id, success: false, error: loginResult.error });
      }

      // Small delay between renewals to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    // Log the result
    await supabase.from('background_sync_logs').insert({
      sync_type: 'token_renewal',
      success: failCount === 0,
      invoices_synced: successCount,
      orders_updated: 0,
      error_message: failCount > 0 ? `${failCount} token(s) failed to renew` : null,
    });

    console.log(`Token renewal complete: ${successCount} succeeded, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        renewed: successCount,
        failed: failCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Token renewal error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
