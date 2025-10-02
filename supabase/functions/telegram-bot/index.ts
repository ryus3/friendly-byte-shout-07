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

━━━━━━━━━━━━━━━━━━
📦 أوامر الجرد الذكية:

/جرد - جرد سريع لمخزونك
/جرد_منتج [اسم] - جرد منتج معين
/جرد_قسم [اسم] - جرد قسم كامل
/جرد_لون [اسم] - جرد حسب اللون
/جرد_قياس [حجم] - جرد حسب القياس
/احصائياتي - إحصائيات مخزونك

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

// Note: City and product extraction is now handled by the smart database function process_telegram_order

// ==========================================
// Smart Inventory Handlers
// ==========================================

interface InventoryItem {
  product_name: string;
  color_name: string;
  size_name: string;
  total_quantity: number;
  available_quantity: number;
  reserved_quantity: number;
  department_name?: string;
  category_name?: string;
}

async function handleInventoryStats(employeeId: string | null): Promise<string> {
  if (!employeeId) {
    return '⚠️ لم يتم ربط حسابك بالنظام.\nيرجى التواصل مع المدير للحصول على رمز الربط.';
  }

  try {
    const { data, error } = await supabase.rpc('get_employee_inventory_stats', {
      p_employee_id: employeeId
    });

    if (error) throw error;

    const stats = data?.[0];
    if (!stats) {
      return '📊 لا توجد بيانات متاحة حالياً.';
    }

    return `📊 إحصائيات المخزون الخاص بك:

✅ إجمالي المنتجات: ${stats.total_products || 0}
🎨 إجمالي المتغيرات: ${stats.total_variants || 0}
📦 إجمالي المخزون: ${stats.total_stock || 0}
🟢 المتاح للبيع: ${stats.available_stock || 0}
🔒 المحجوز: ${stats.reserved_stock || 0}
⚠️ منخفض المخزون: ${stats.low_stock_items || 0}
❌ نفذ من المخزون: ${stats.out_of_stock_items || 0}
💰 قيمة المخزون: ${(stats.total_value || 0).toLocaleString()} د.ع`;
  } catch (error) {
    console.error('❌ خطأ في جلب الإحصائيات:', error);
    return '❌ حدث خطأ في جلب الإحصائيات. يرجى المحاولة لاحقاً.';
  }
}

async function handleInventorySearch(employeeId: string | null, searchType: string, searchValue: string): Promise<string> {
  if (!employeeId) {
    return '⚠️ لم يتم ربط حسابك بالنظام.\nيرجى التواصل مع المدير للحصول على رمز الربط.';
  }

  try {
    const { data, error } = await supabase.rpc('get_inventory_by_permissions', {
      p_employee_id: employeeId,
      p_search_type: searchType,
      p_search_value: searchValue || null
    });

    if (error) throw error;

    const items = data as InventoryItem[];
    if (!items || items.length === 0) {
      return `🔍 لم يتم العثور على نتائج لـ: ${searchValue || 'البحث المطلوب'}`;
    }

    // Group by product for better presentation
    const groupedByProduct: Record<string, InventoryItem[]> = {};
    items.forEach(item => {
      if (!groupedByProduct[item.product_name]) {
        groupedByProduct[item.product_name] = [];
      }
      groupedByProduct[item.product_name].push(item);
    });

    let message = `📦 نتائج الجرد:\n\n`;
    
    Object.entries(groupedByProduct).forEach(([productName, variants]) => {
      message += `🛍️ ${productName}\n`;
      if (variants[0]?.department_name) {
        message += `   📁 ${variants[0].department_name}\n`;
      }
      
      // Group by color
      const byColor: Record<string, InventoryItem[]> = {};
      variants.forEach(v => {
        if (!byColor[v.color_name]) byColor[v.color_name] = [];
        byColor[v.color_name].push(v);
      });

      Object.entries(byColor).forEach(([color, colorVariants]) => {
        message += `   🎨 ${color}:\n`;
        colorVariants.forEach(v => {
          message += `      📏 ${v.size_name}: ${v.available_quantity}/${v.total_quantity} (محجوز: ${v.reserved_quantity})\n`;
        });
      });
      
      message += '\n';
    });

    // Limit message length for Telegram
    if (message.length > 4000) {
      message = message.substring(0, 3900) + '\n\n... (النتائج محدودة)';
    }

    return message;
  } catch (error) {
    console.error('❌ خطأ في البحث:', error);
    return '❌ حدث خطأ في البحث. يرجى المحاولة لاحقاً.';
  }
}

async function handleSmartInventorySearch(employeeId: string | null, searchText: string): Promise<string> {
  if (!employeeId) {
    return '⚠️ لم يتم ربط حسابك بالنظام.\nيرجى التواصل مع المدير للحصول على رمز الربط.';
  }

  try {
    const { data, error } = await supabase.rpc('smart_inventory_search', {
      p_employee_id: employeeId,
      p_search_text: searchText
    });

    if (error) throw error;

    const items = data as any[];
    if (!items || items.length === 0) {
      return `🔍 لم يتم العثور على نتائج لـ: "${searchText}"`;
    }

    let message = `🔍 نتائج البحث عن "${searchText}":\n\n`;
    
    items.slice(0, 20).forEach((item, idx) => {
      message += `${idx + 1}. ${item.product_name}\n`;
      message += `   🎨 ${item.color_name} | 📏 ${item.size_name}\n`;
      message += `   📦 متاح: ${item.available_quantity} | إجمالي: ${item.total_quantity}\n`;
      if (item.reserved_quantity > 0) {
        message += `   🔒 محجوز: ${item.reserved_quantity}\n`;
      }
      message += '\n';
    });

    if (items.length > 20) {
      message += `\n... وعدد ${items.length - 20} نتيجة أخرى`;
    }

    return message;
  } catch (error) {
    console.error('❌ خطأ في البحث الذكي:', error);
    return '❌ حدث خطأ في البحث. يرجى المحاولة لاحقاً.';
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

      // ==========================================
      // Handle Inventory Commands
      // ==========================================
      
      // Get employee data once for all inventory commands
      const { data: employeeData, error: employeeError } = await supabase
        .from('employee_telegram_codes')
        .select('telegram_code, user_id')
        .eq('telegram_chat_id', chatId)
        .eq('is_active', true)
        .maybeSingle();

      const employeeId = employeeData?.user_id || null;
      
      // Handle /احصائياتي command
      if (text === '/احصائياتي' || text === '/stats') {
        const statsMessage = await handleInventoryStats(employeeId);
        await sendTelegramMessage(chatId, statsMessage, botToken);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle /جرد command (quick inventory)
      if (text === '/جرد' || text === '/inventory') {
        const inventoryMessage = await handleInventorySearch(employeeId, 'all', '');
        await sendTelegramMessage(chatId, inventoryMessage, botToken);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle /جرد_منتج command
      if (text.startsWith('/جرد_منتج') || text.startsWith('/product_inventory')) {
        const searchValue = text.replace(/^\/(جرد_منتج|product_inventory)\s*/i, '').trim();
        if (!searchValue) {
          await sendTelegramMessage(chatId, '⚠️ يرجى كتابة اسم المنتج بعد الأمر\nمثال: /جرد_منتج برشلونة', botToken);
        } else {
          const inventoryMessage = await handleInventorySearch(employeeId, 'product', searchValue);
          await sendTelegramMessage(chatId, inventoryMessage, botToken);
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle /جرد_قسم command
      if (text.startsWith('/جرد_قسم') || text.startsWith('/department_inventory')) {
        const searchValue = text.replace(/^\/(جرد_قسم|department_inventory)\s*/i, '').trim();
        if (!searchValue) {
          await sendTelegramMessage(chatId, '⚠️ يرجى كتابة اسم القسم بعد الأمر\nمثال: /جرد_قسم رياضي', botToken);
        } else {
          const inventoryMessage = await handleInventorySearch(employeeId, 'department', searchValue);
          await sendTelegramMessage(chatId, inventoryMessage, botToken);
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle /جرد_لون command
      if (text.startsWith('/جرد_لون') || text.startsWith('/color_inventory')) {
        const searchValue = text.replace(/^\/(جرد_لون|color_inventory)\s*/i, '').trim();
        if (!searchValue) {
          await sendTelegramMessage(chatId, '⚠️ يرجى كتابة اسم اللون بعد الأمر\nمثال: /جرد_لون أحمر', botToken);
        } else {
          const inventoryMessage = await handleInventorySearch(employeeId, 'color', searchValue);
          await sendTelegramMessage(chatId, inventoryMessage, botToken);
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle /جرد_قياس command
      if (text.startsWith('/جرد_قياس') || text.startsWith('/size_inventory')) {
        const searchValue = text.replace(/^\/(جرد_قياس|size_inventory)\s*/i, '').trim();
        if (!searchValue) {
          await sendTelegramMessage(chatId, '⚠️ يرجى كتابة القياس بعد الأمر\nمثال: /جرد_قياس سمول', botToken);
        } else {
          const inventoryMessage = await handleInventorySearch(employeeId, 'size', searchValue);
          await sendTelegramMessage(chatId, inventoryMessage, botToken);
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle smart search (any text query that's not a command)
      // Check if it looks like an inventory query (starts with common keywords)
      const inventoryKeywords = ['ما المتوفر', 'شو المتوفر', 'وين', 'عندي', 'المخزون', 'الجرد'];
      const isInventoryQuery = inventoryKeywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()));
      
      if (isInventoryQuery) {
        const searchQuery = text.replace(/^(ما المتوفر|شو المتوفر|وين|عندي|المخزون|الجرد)\s*/i, '').trim();
        if (searchQuery) {
          const inventoryMessage = await handleSmartInventorySearch(employeeId, searchQuery);
          await sendTelegramMessage(chatId, inventoryMessage, botToken);
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // ==========================================
      // Handle text messages (potential orders)
      // IMPORTANT: This runs ONLY if the message is NOT an inventory command
      // ==========================================
      if (text && text !== '/start') {
        try {
          console.log('🔄 معالجة الطلب باستخدام الدالة الذكية الصحيحة...');
          
          // We already fetched employeeData above, use it
          const employeeCode = employeeData?.telegram_code || '';
          console.log('👤 رمز الموظف المستخدم:', employeeCode);
          console.log('👤 معرف الموظف المستخدم:', employeeId);

          // استدعاء الدالة الذكية الجديدة بالمعاملات الصحيحة
          const { data: orderResult, error: orderError } = await supabase.rpc('process_telegram_order', {
            p_employee_code: employeeCode,
            p_message_text: text,
            p_telegram_chat_id: chatId
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

          // التعامل مع النتيجة
          if (orderResult?.success) {
            console.log('✅ تم معالجة الطلب بنجاح:', orderResult);
            // استخدام الرسالة الجاهزة من الدالة (تحتوي على العنوان المُحلّل)
            await sendTelegramMessage(chatId, orderResult.message, botToken);
          } else {
            // معالجة الأخطاء
            let errorMessage = orderResult?.message || 'لم أتمكن من فهم طلبك بشكل كامل.';
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