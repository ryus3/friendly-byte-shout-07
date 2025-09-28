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
📍 أكتب مدينتك بأي شكل: "ديوانية" أو "الديوانية" أو "كراده" أو "الكرادة"
🛍️ أكتب طلبك بأي طريقة تريد

مثال:
"عايز قميص أحمر حجم L للديوانية"
"بغداد كراده ارجنتين سمائي ميديم"

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
    console.error('🔐 خطأ في قراءة إعدادات رمز البوت:', error);
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
      console.error('❌ فشل إرسال رسالة تليغرام:', result);
    }
    return result;
  } catch (error) {
    console.error('❌ خطأ في إرسال رسالة تليغرام:', error);
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
      console.error('❌ لم يتم العثور على رمز البوت');
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
          // Call the enhanced order processing function
          console.log('🔄 معالجة الطلب باستخدام process_telegram_order...');
          
          const { data: orderResult, error: orderError } = await supabase.rpc('process_telegram_order', {
            p_message_text: text,
            p_chat_id: chatId
          });

          if (orderError) {
            console.error('❌ خطأ في معالجة الطلب:', orderError);
            
            // Handle specific error types with more helpful messages
            let errorMessage = '⚠️ عذراً، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.';
            
            if (orderError.message?.includes('function') && orderError.message?.includes('not unique')) {
              errorMessage = '🔧 النظام قيد الصيانة، يرجى المحاولة خلال دقائق قليلة.';
            } else if (orderError.message?.includes('permission')) {
              errorMessage = '🔒 لا يوجد صلاحية للوصول، يرجى التواصل مع الدعم.';
            }
            
            await sendTelegramMessage(chatId, errorMessage, botToken);
            return new Response(JSON.stringify({ error: orderError.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          console.log('✅ نتيجة معالجة الطلب:', orderResult);

          // Handle different response types
          if (orderResult?.success) {
            const orderData = orderResult.order_data || {};
            
            // Save order to ai_orders table for smart administration
            try {
              const { error: saveError } = await supabase
                .from('ai_orders')
                .insert({
                  customer_name: orderData.customer_name || 'عميل',
                  customer_phone: orderData.customer_phone,
                  customer_city: orderData.customer_city,
                  customer_province: orderData.customer_province, // تم تصحيح هذا من customer_region
                  customer_address: orderData.customer_address,
                  city_id: orderData.city_id,
                  region_id: orderData.region_id,
                  telegram_chat_id: chatId,
                  items: orderData.items || [],
                  total_amount: orderData.total_amount || 0,
                  order_data: orderData,
                  original_text: text,
                  source: 'telegram',
                  status: 'pending'
                });
              
              if (saveError) {
                console.error('❌ خطأ في حفظ الطلب:', saveError);
              } else {
                console.log('✅ تم حفظ الطلب في الإدارة الذكية');
              }
            } catch (saveError) {
              console.error('❌ خطأ في حفظ الطلب:', saveError);
            }
            
            // Build order confirmation message in the requested format
            let message = '✅ تم استلام الطلب!\n\n';
            
            // Add customer name if provided and not default
            if (orderData.customer_name && orderData.customer_name !== 'عميل') {
              message += `🥷 ${orderData.customer_name}\n`;
            }
            
            // Add location info
            if (orderData.customer_city && orderData.customer_province) {
              message += `📍 ${orderData.customer_city} - ${orderData.customer_province}\n`;
            } else if (orderData.customer_city) {
              message += `📍 ${orderData.customer_city}\n`;
            }
            
            // Add phone number
            if (orderData.customer_phone) {
              message += `📱 ${orderData.customer_phone}\n`;
            }
            
            // Add product details
            if (orderData.items && Array.isArray(orderData.items) && orderData.items.length > 0) {
              orderData.items.forEach((item: any) => {
                const productName = item.product_name || 'منتج';
                const color = item.color ? ` (${item.color})` : '';
                const size = item.size ? ` ${item.size}` : '';
                const quantity = item.quantity || 1;
                message += `🛍️ ${productName}${color}${size} × ${quantity}\n`;
              });
            }
            
            // Add total amount with proper formatting
            if (orderData.total_amount && orderData.total_amount > 0) {
              const formattedAmount = orderData.total_amount.toLocaleString('ar-IQ');
              message += `💰 المبلغ الإجمالي: ${formattedAmount} د.ع`;
            }
            
            await sendTelegramMessage(chatId, message, botToken);
            
          } else {
            // Handle errors or clarifications needed - including availability errors
            let errorMessage = orderResult?.message || 'لم أتمكن من فهم طلبك بشكل كامل.';
            
            // Create inline keyboard for options if available
            let replyMarkup: any = undefined;
            
            if (orderResult?.options_type === 'city_selection' && orderResult?.suggested_cities) {
              console.log('🏙️ إرسال خيارات المدن');
              const cities = orderResult.suggested_cities.split('\n• ').filter((c: string) => c.trim());
              replyMarkup = {
                inline_keyboard: cities.slice(0, 6).map((city: string, index: number) => ([{
                  text: `${index + 1}. ${city.replace(/\s*\(ثقة:.*?\)/g, '')}`,
                  callback_data: `city_${index + 1}_${city.split(' ')[0]}`
                }]))
              };
            } else if (orderResult?.options_type === 'variant_selection' && orderResult?.available_combinations) {
              console.log('👕 إرسال خيارات المنتجات');
              const variants = orderResult.available_combinations.split('\n').filter((v: string) => v.trim());
              replyMarkup = {
                inline_keyboard: variants.slice(0, 8).map((variant: string, index: number) => ([{
                  text: variant,
                  callback_data: `variant_${index + 1}_${variant.split('.')[1]?.trim() || variant}`
                }]))
              };
            }
            
            await sendTelegramMessage(chatId, errorMessage, botToken, replyMarkup);
          }

        } catch (processingError) {
          console.error('❌ خطأ عام في معالجة الطلب:', processingError);
          
          // More specific error handling
          let errorMessage = '⚠️ عذراً، حدث خطأ في النظام.';
          
          if (processingError instanceof Error) {
            if (processingError.message.includes('timeout')) {
              errorMessage = '⏰ انتهت مهلة الاستجابة، يرجى المحاولة مرة أخرى.';
            } else if (processingError.message.includes('network')) {
              errorMessage = '🌐 مشكلة في الشبكة، يرجى التحقق من الاتصال.';
            }
          }
          
          await sendTelegramMessage(chatId, errorMessage, botToken);
        }
      }

    } else if (update.callback_query) {
      // Handle inline keyboard button presses with improved feedback
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

        // Process the selected option with better guidance
        let responseMessage = '';
        if (data.startsWith('city_')) {
          const cityName = data.split('_').slice(2).join('_');
          responseMessage = `✅ تم اختيار المدينة: ${cityName}\n\nيرجى الآن إعادة كتابة طلبك مع اسم المدينة الصحيح والمنطقة ورقم الهاتف.`;
        } else if (data.startsWith('variant_')) {
          const variantName = data.split('_').slice(2).join('_');
          responseMessage = `✅ تم اختيار المنتج: ${variantName}\n\nيرجى إعادة كتابة طلبك مع المواصفات الصحيحة والعنوان ورقم الهاتف.`;
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
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});