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
    console.log('🚀 EMERGENCY WEBHOOK FIX - Starting...')
    
    const botToken = '7553972023:AAGy3IfLLsVvY1FBNDd27Py_-eecHv2YYP8'
    const correctWebhookUrl = 'https://tkheostkubborwkwzugl.supabase.co/functions/v1/telegram-bot-alwaseet'

    console.log('🔍 Checking current webhook status...')
    
    // First, check current webhook
    const checkResponse = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`)
    const currentInfo = await checkResponse.json()
    console.log('📡 Current webhook info:', JSON.stringify(currentInfo, null, 2))

    // Delete current webhook first
    console.log('🗑️ Deleting current webhook...')
    const deleteResponse = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`)
    const deleteResult = await deleteResponse.json()
    console.log('🗑️ Delete result:', deleteResult)

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Set new webhook
    console.log('🔧 Setting new webhook to:', correctWebhookUrl)
    const setResponse = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: correctWebhookUrl,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true
      })
    })

    const setResult = await setResponse.json()
    console.log('🔧 Set webhook result:', JSON.stringify(setResult, null, 2))

    if (!setResult.ok) {
      throw new Error(`Failed to set webhook: ${setResult.description}`)
    }

    // Verify the new webhook
    const verifyResponse = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`)
    const verifyInfo = await verifyResponse.json()
    console.log('✅ Verification - New webhook info:', JSON.stringify(verifyInfo, null, 2))

    // Update database
    await supabase
      .from('settings')
      .update({
        value: {
          bot_token: botToken,
          webhook_url: correctWebhookUrl,
          setup_date: new Date().toISOString(),
          last_webhook_update: new Date().toISOString()
        }
      })
      .eq('key', 'telegram_bot_config')

    console.log('✅ SUCCESS! Webhook updated and verified!')
    console.log('✅ Bot should now work with telegram-bot-alwaseet')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'WEBHOOK EMERGENCY FIX COMPLETED!',
        old_webhook: currentInfo.result?.url || 'none',
        new_webhook: correctWebhookUrl,
        verification: verifyInfo.result
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ EMERGENCY FIX FAILED:', error)
    
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