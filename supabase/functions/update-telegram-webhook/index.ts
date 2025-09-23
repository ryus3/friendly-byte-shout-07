// Update Telegram webhook to point to the correct bot function
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get bot token from settings
    const { data: botConfig, error: configError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'telegram_bot_config')
      .single()

    if (configError || !botConfig?.value?.bot_token) {
      throw new Error('Bot token not found')
    }

    const botToken = botConfig.value.bot_token
    const newWebhookUrl = 'https://tkheostkubborwkwzugl.supabase.co/functions/v1/telegram-bot-alwaseet'

    // Update Telegram webhook
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: newWebhookUrl,
        allowed_updates: ['message', 'callback_query']
      })
    })

    const telegramResult = await telegramResponse.json()

    if (!telegramResult.ok) {
      throw new Error(`Telegram API error: ${telegramResult.description}`)
    }

    // Update our database settings
    const { error: updateError } = await supabase
      .from('settings')
      .update({
        value: {
          ...botConfig.value,
          webhook_url: newWebhookUrl,
          updated_at: new Date().toISOString()
        }
      })
      .eq('key', 'telegram_bot_config')

    if (updateError) {
      console.error('Error updating database:', updateError)
    }

    console.log('✅ Webhook updated successfully:', newWebhookUrl)

    return new Response(
      JSON.stringify({
        success: true,
        webhook_url: newWebhookUrl,
        telegram_response: telegramResult,
        message: 'Webhook updated to telegram-bot-alwaseet'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Error updating webhook:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})