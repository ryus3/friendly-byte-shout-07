import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// رسائل تحسين UX
const WELCOME_MESSAGE = `🤖 مرحباً بك في بوت RYUS للطلبات الذكية!

✨ يمكنني فهم طلباتك بطريقة ذكية وسهلة
📍 أكتب مدينتك بأي شكل: "ديوانية" أو "الديوانية" 
🛍️ أكتب طلبك بأي طريقة تريد

مثال:
"عايز قميص أحمر حجم L للديوانية"

جرب الآن! 👇`;

// Get bot token from settings table with ENV fallback
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

async function sendTelegramMessage(chatId: number, text: string, botToken: string, replyMarkup?: any) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      })
    });

    const result = await response.json();
    if (!result.ok) {
      console.error('فشل إرسال رسالة تليغرام:', result);
    }
    return result;
  } catch (error) {
    console.error('خطأ في إرسال رسالة تليغرام:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = await getBotToken();
    if (!botToken) {
      console.error('Bot token not found');
      return new Response(JSON.stringify({ error: 'Bot token not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const update = await req.json();
    console.log('📨 تحديث تليغرام:', JSON.stringify(update, null, 2));

    // Handle different types of updates
    if (update.message) {
      const { message } = update;
      const chatId = message.chat.id;
      const userId = message.from?.id;
      const text = message.text?.trim() || '';

      console.log(`💬 رسالة جديدة من ${userId}: "${text}"`);

      // Handle /start command
      if (text === '/start') {
        await sendTelegramMessage(chatId, WELCOME_MESSAGE, botToken);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle text messages (potential orders)
      if (text && text !== '/start') {
        try {
          // Call the process_telegram_order function
          const { data: orderResult, error: orderError } = await supabase.rpc('process_telegram_order', {
            p_order_data: {
              original_text: text,
              customer_name: message.from?.first_name || 'عميل تليغرام',
              customer_phone: '', // Will be asked later if needed
              items: [], // Will be extracted by AI
              customer_city: '', // Will be extracted by AI
              customer_address: '' // Will be extracted by AI
            },
            p_chat_id: chatId,
            p_employee_id: null // Will be determined by chat_id
          });

          if (orderError) {
            console.error('❌ خطأ في معالجة الطلب:', orderError);
            await sendTelegramMessage(
              chatId, 
              '⚠️ عذراً، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى أو التواصل مع الدعم.',
              botToken
            );
            return new Response(JSON.stringify({ error: orderError.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          console.log('✅ نتيجة معالجة الطلب:', orderResult);

          // Handle different response types
          if (orderResult?.success) {
            // Order processed successfully
            const message = orderResult.message || '✅ تم استلام طلبك بنجاح!';
            
            // Add confirmed address if available
            let finalMessage = message;
            if (orderResult.confirmed_address) {
              finalMessage += `\n\n📍 العنوان المؤكد: ${orderResult.confirmed_address}`;
            }
            
            await sendTelegramMessage(chatId, finalMessage, botToken);
          } else {
            // Handle errors or clarifications needed
            const errorMessage = orderResult?.message || 'لم أتمكن من فهم طلبك. يرجى المحاولة مرة أخرى.';
            
            // If there are suggestions or options, create inline keyboard
            let replyMarkup = undefined;
            if (orderResult?.options_type === 'city_selection' && orderResult?.suggested_cities) {
              // Create numbered options for city selection
              const cities = orderResult.suggested_cities.split('\n• ').filter(c => c.trim());
              replyMarkup = {
                inline_keyboard: cities.slice(0, 6).map((city, index) => ([{
                  text: `${index + 1}. ${city.replace(/\s*\(ثقة:.*?\)/g, '')}`,
                  callback_data: `city_${index + 1}_${city.split(' ')[0]}`
                }]))
              };
            } else if (orderResult?.options_type === 'variant_selection' && orderResult?.available_combinations) {
              // Create options for product variants
              const variants = orderResult.available_combinations.split('\n').filter(v => v.trim());
              replyMarkup = {
                inline_keyboard: variants.slice(0, 8).map((variant, index) => ([{
                  text: variant,
                  callback_data: `variant_${index + 1}_${variant.split('.')[1]?.trim() || variant}`
                }]))
              };
            }
            
            await sendTelegramMessage(chatId, errorMessage, botToken, replyMarkup);
          }

        } catch (processingError) {
          console.error('❌ خطأ عام في معالجة الطلب:', processingError);
          await sendTelegramMessage(
            chatId, 
            '⚠️ عذراً، حدث خطأ في النظام. يرجى المحاولة لاحقاً.',
            botToken
          );
        }
      }

    } else if (update.callback_query) {
      // Handle inline keyboard button presses
      const { callback_query } = update;
      const chatId = callback_query.message?.chat?.id;
      const data = callback_query.data;

      console.log(`🔘 ضغطة زر من ${callback_query.from?.id}: "${data}"`);

      if (chatId && data) {
        // Answer the callback query
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callback_query.id,
            text: '✅ تم الاختيار'
          })
        });

        // Process the selected option
        let responseMessage = '';
        if (data.startsWith('city_')) {
          responseMessage = '✅ تم اختيار المدينة. يرجى إعادة كتابة طلبك مع اسم المدينة الصحيح.';
        } else if (data.startsWith('variant_')) {
          responseMessage = '✅ تم اختيار المنتج. يرجى إعادة كتابة طلبك مع المواصفات الصحيحة.';
        }

        if (responseMessage) {
          await sendTelegramMessage(chatId, responseMessage, botToken);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ خطأ عام في بوت تليغرام:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});