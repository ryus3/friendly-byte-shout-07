import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔧 Starting webhook fix process...')
    
    // Get bot token from settings
    const { data: botConfig } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'telegram_bot_config')
      .single()

    if (!botConfig?.value?.bot_token) {
      throw new Error('Bot token not found')
    }

    const botToken = botConfig.value.bot_token
    const correctWebhookUrl = 'https://tkheostkubborwkwzugl.supabase.co/functions/v1/telegram-bot-alwaseet'

    console.log('🔄 Updating webhook to:', correctWebhookUrl)

    // Update Telegram webhook directly
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: correctWebhookUrl,
        allowed_updates: ['message', 'callback_query']
      })
    })

    const telegramResult = await telegramResponse.json()
    console.log('📡 Telegram API response:', telegramResult)

    if (!telegramResult.ok) {
      throw new Error(`Telegram API error: ${telegramResult.description}`)
    }

    // Update database settings
    await supabase
      .from('settings')
      .update({
        value: {
          ...botConfig.value,
          webhook_url: correctWebhookUrl,
          updated_at: new Date().toISOString()
        }
      })
      .eq('key', 'telegram_bot_config')

    console.log('✅ Webhook successfully updated!')
    console.log('✅ Database settings updated!')

    return new Response(
      JSON.stringify({
        success: true,
        webhook_url: correctWebhookUrl,
        telegram_response: telegramResult,
        message: 'Webhook fixed! Bot should now work correctly with telegram-bot-alwaseet'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Error fixing webhook:', error)
    
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