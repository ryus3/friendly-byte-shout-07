import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// Extract phone number from text using simple regex
function extractPhoneFromText(text: string): string {
  const phonePattern = /\b(07[3-9]\d{8}|00964[37]\d{8}|964[37]\d{8})\b/;
  const match = text.match(phonePattern);
  if (match) {
    let phone = match[0];
    // Normalize to Iraqi format
    phone = phone.replace(/^(00964|964)/, '0');
    if (phone.startsWith('07') && phone.length === 11) {
      return phone;
    }
  }
  return '';
}

// Extract city from text - basic implementation
function extractCityFromText(text: string): { city: string, province: string } {
  const lowerText = text.toLowerCase();
  
  // Common Iraqi cities mapping
  const cityMappings: Record<string, { city: string, province: string }> = {
    'بغداد': { city: 'بغداد', province: 'بغداد' },
    'كراده': { city: 'الكرادة', province: 'بغداد' },
    'الكراده': { city: 'الكرادة', province: 'بغداد' },
    'الكرادة': { city: 'الكرادة', province: 'بغداد' },
    'ديوانية': { city: 'الديوانية', province: 'الديوانية' },
    'الديوانية': { city: 'الديوانية', province: 'الديوانية' },
    'نجف': { city: 'النجف', province: 'النجف' },
    'النجف': { city: 'النجف', province: 'النجف' },
    'كربلاء': { city: 'كربلاء', province: 'كربلاء' },
    'البصرة': { city: 'البصرة', province: 'البصرة' },
    'بصرة': { city: 'البصرة', province: 'البصرة' }
  };

  for (const [key, value] of Object.entries(cityMappings)) {
    if (lowerText.includes(key)) {
      return value;
    }
  }

  return { city: '', province: '' };
}

// Extract product info from text - basic implementation
function extractProductFromText(text: string): any[] {
  const lowerText = text.toLowerCase();
  
  // Common product patterns
  const products = [
    { name: 'قميص', keywords: ['قميص', 'قمصان'] },
    { name: 'ارجنتين', keywords: ['ارجنتين', 'أرجنتين'] },
    { name: 'تيشرت', keywords: ['تيشرت', 'تشيرت'] }
  ];

  const colors = ['أحمر', 'أزرق', 'أسود', 'أبيض', 'سمائي', 'أخضر'];
  const sizes = ['S', 'M', 'L', 'XL', 'صغير', 'وسط', 'كبير', 'ميديم', 'لارج'];

  let foundProduct = null;
  let foundColor = '';
  let foundSize = '';

  // Find product
  for (const product of products) {
    if (product.keywords.some(keyword => lowerText.includes(keyword))) {
      foundProduct = product.name;
      break;
    }
  }

  // Find color
  for (const color of colors) {
    if (lowerText.includes(color.toLowerCase())) {
      foundColor = color;
      break;
    }
  }

  // Find size
  for (const size of sizes) {
    if (lowerText.includes(size.toLowerCase())) {
      foundSize = size;
      break;
    }
  }

  if (foundProduct) {
    return [{
      product_name: foundProduct,
      color: foundColor || 'افتراضي',
      size: foundSize || 'افتراضي',
      quantity: 1,
      price: 15000,
      total_price: 15000,
      is_available: true
    }];
  }

  return [];
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
          console.log('🔄 معالجة الطلب باستخدام الدالة الذكية الصحيحة...');
          
          // البحث عن الموظف المربوط بهذا الحساب
          const { data: employeeData, error: employeeError } = await supabase
            .from('employee_telegram_codes')
            .select('user_id')
            .eq('telegram_chat_id', chatId)
            .eq('is_active', true)
            .maybeSingle();

          if (employeeError) {
            console.log('🔍 لم يتم العثور على موظف مربوط:', employeeError);
          }

          const employeeId = employeeData?.user_id || null;
          console.log('👤 معرف الموظف المستخدم:', employeeId);
          
          // استدعاء الدالة الذكية الصحيحة مباشرة
          const { data: orderResult, error: orderError } = await supabase.rpc('process_telegram_order', {
            p_chat_id: chatId,
            p_message_text: text,
            p_employee_id: employeeId
          });

          if (orderError) {
            console.error('❌ خطأ في معالجة الطلب:', orderError);
            
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

          // Handle response
          if (orderResult?.success) {
            const responseData = orderResult.order_data || orderResult;
            
            // Build order confirmation message
            let message = '✅ تم استلام الطلب!\n\n';
            
            // Add location info - عرض المدينة والمنطقة وأقرب نقطة دالة بشكل صحيح
            const cityName = responseData.customer_city || orderResult.customer_city || '';
            const regionName = responseData.customer_region || orderResult.customer_region || '';
            const landmark = responseData.landmark || orderResult.landmark || '';
            
            if (cityName && regionName && landmark) {
              message += `📍 ${cityName} - ${regionName} - ${landmark}\n`;
            } else if (cityName && regionName) {
              message += `📍 ${cityName} - ${regionName}\n`;
            } else if (cityName) {
              message += `📍 ${cityName}\n`;
            }
            
            // Add phone number
            if (responseData.customer_phone) {
              message += `📱 الهاتف : ${responseData.customer_phone}\n`;
            }
            
            // Add product details
            if (responseData.items && Array.isArray(responseData.items) && responseData.items.length > 0) {
              responseData.items.forEach((item: any) => {
                const productName = item.product_name || 'منتج';
                const color = item.color ? ` (${item.color})` : '';
                const size = item.size ? ` ${item.size}` : '';
                const quantity = item.quantity || 1;
                message += `❇️ ${productName}${color}${size} × ${quantity}\n`;
              });
            }
            
            // Add final amount only - المبلغ الإجمالي فقط
            const finalAmount = responseData.final_amount || orderResult.final_amount || orderResult.total_amount || 0;
            
            if (finalAmount > 0) {
              const formattedFinalAmount = finalAmount.toLocaleString('en-US');
              message += `💵 المبلغ الإجمالي: ${formattedFinalAmount} د.ع`;
            }
            
            await sendTelegramMessage(chatId, message, botToken);
            
          } else {
            // Handle errors
            let errorMessage = orderResult?.error || 'لم أتمكن من فهم طلبك بشكل كامل.';
            await sendTelegramMessage(chatId, errorMessage, botToken);
          }

        } catch (processingError) {
          console.error('❌ خطأ عام في معالجة الطلب:', processingError);
          
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