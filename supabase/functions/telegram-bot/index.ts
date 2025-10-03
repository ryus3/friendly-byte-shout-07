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
📦 أوامر الجرد:

استخدم الأزرار أدناه ↓ أو اكتب الأوامر مباشرة:

/inventory - جرد سريع للمخزون 📦
/product برشلونة - جرد منتج معين 🛍️
/category تيشرتات - جرد تصنيف محدد 🏷️
/color أحمر - جرد حسب اللون 🎨
/size سمول - جرد حسب القياس 📏
/stats - إحصائيات المخزون 📊
/search برشلونة أحمر - بحث ذكي 🔍

💡 ملاحظة: لإنشاء طلب، اكتب رسالة عادية بدون أوامر

جرب الآن! 👇`;

// Inline keyboard for inventory menu
const INVENTORY_KEYBOARD = {
  inline_keyboard: [
    [
      { text: '🛍️ جرد منتج', callback_data: 'inv_product' },
      { text: '🏷️ جرد تصنيف', callback_data: 'inv_category' }
    ],
    [
      { text: '🎨 جرد لون', callback_data: 'inv_color' },
      { text: '📏 جرد قياس', callback_data: 'inv_size' }
    ],
    [
      { text: '🌞 جرد موسم', callback_data: 'inv_season' },
      { text: '🔍 بحث ذكي', callback_data: 'inv_search' }
    ],
    [
      { text: '📊 إحصائيات المخزون', callback_data: 'inv_stats' },
      { text: '📦 جرد سريع', callback_data: 'inv_quick' }
    ]
  ]
};

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
  category_name?: string;
  season_name?: string;
}

interface InventoryProduct {
  product_name: string;
  category_name?: string;
  variants: Array<{
    color_name: string;
    size_name: string;
    total_quantity: number;
    available_quantity: number;
    reserved_quantity: number;
  }>;
}

async function handleInventoryStats(employeeId: string | null): Promise<string> {
  if (!employeeId) {
    return '⚠️ لم يتم ربط حسابك بالنظام.\nيرجى التواصل مع المدير للحصول على رمز الربط.';
  }

  try {
    const { data, error } = await supabase.rpc('get_unified_inventory_stats');

    if (error) throw error;

    const stats = data?.[0];
    if (!stats) {
      return '📊 لا توجد بيانات متاحة حالياً.';
    }

    const totalStock = stats.total_variants || 0;
    const reservedStock = stats.reserved_stock_count || 0;
    const availableStock = totalStock - reservedStock;

    return `📊 إحصائيات المخزون الخاص بك:

✅ إجمالي المنتجات: ${stats.total_products || 0}
🎨 إجمالي المتغيرات: ${stats.total_variants || 0}
📦 إجمالي المخزون: ${totalStock}
🟢 المتاح للبيع: ${availableStock}
🔒 المحجوز: ${reservedStock}
⚠️ منخفض المخزون: ${stats.low_stock_count || 0}
❌ نفذ من المخزون: ${stats.out_of_stock_count || 0}
💰 قيمة المخزون: ${(stats.total_inventory_value || 0).toLocaleString()} د.ع`;
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
    // استخدام smart_inventory_search بدلاً من get_inventory_by_permissions
    const { data, error } = await supabase.rpc('smart_inventory_search', {
      p_employee_id: employeeId,
      p_search_text: searchValue || ''
    });

    if (error) throw error;

    // البيانات تأتي كصفوف منفصلة (كل variant على حدة)
    const items = data as InventoryItem[];
    if (!items || items.length === 0) {
      return `🔍 لم يتم العثور على نتائج لـ: ${searchValue || 'البحث المطلوب'}`;
    }

    // تجميع البيانات حسب المنتج
    const productMap = new Map<string, InventoryProduct>();
    
    items.forEach(item => {
      if (!productMap.has(item.product_name)) {
        productMap.set(item.product_name, {
          product_name: item.product_name,
          category_name: item.category_name,
          variants: []
        });
      }
      
      productMap.get(item.product_name)!.variants.push({
        color_name: item.color_name,
        size_name: item.size_name,
        total_quantity: item.total_quantity,
        available_quantity: item.available_quantity,
        reserved_quantity: item.reserved_quantity
      });
    });

    const products = Array.from(productMap.values());
    let message = '';
    
    products.forEach((product, index) => {
      if (index > 0) message += '\n━━━━━━━━━━━━━━━━━━\n\n';
      
      // اسم المنتج مع أيقونة مميزة
      message += `🛍️ <b>${product.product_name}</b>\n`;
      
      // التصنيف فقط (لا يوجد قسم)
      if (product.category_name) {
        message += `🏷️ ${product.category_name}\n`;
      }
      
      // حساب الإحصائيات
      const totalAvailable = product.variants.reduce((sum, v) => sum + (v.available_quantity || 0), 0);
      const totalStock = product.variants.reduce((sum, v) => sum + (v.total_quantity || 0), 0);
      const totalReserved = product.variants.reduce((sum, v) => sum + (v.reserved_quantity || 0), 0);
      
      // عرض الإحصائيات بشكل احترافي
      const availabilityIcon = totalAvailable > 0 ? '✅' : '❌';
      message += `${availabilityIcon} <b>المخزون:</b> ${totalAvailable} قطعة`;
      if (totalReserved > 0) {
        message += ` <i>(محجوز: ${totalReserved})</i>`;
      }
      message += '\n\n';
      
      // تنظيم المتغيرات حسب اللون
      const byColor: Record<string, typeof product.variants> = {};
      product.variants.forEach(variant => {
        const colorName = variant.color_name || 'غير محدد';
        if (!byColor[colorName]) byColor[colorName] = [];
        byColor[colorName].push(variant);
      });
      
      // عرض كل لون مع قياساته
      Object.entries(byColor).forEach(([colorName, colorVariants]) => {
        message += `🎨 <b>${colorName}</b>\n`;
        
        // ترتيب القياسات
        const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
        colorVariants.sort((a, b) => {
          const aIndex = sizeOrder.indexOf(a.size_name || '');
          const bIndex = sizeOrder.indexOf(b.size_name || '');
          if (aIndex === -1 && bIndex === -1) return 0;
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        });
        
        colorVariants.forEach(variant => {
          const sizeName = variant.size_name || 'غير محدد';
          const available = variant.available_quantity || 0;
          const reserved = variant.reserved_quantity || 0;
          
          // أيقونة حسب التوافر
          const icon = available > 0 ? '✅' : '❌';
          const status = available > 0 ? `<b>${available} قطعة</b>` : '<i>نافذ</i>';
          
          message += `   ${icon} ${sizeName}: ${status}`;
          if (reserved > 0) {
            message += ` <i>(محجوز: ${reserved})</i>`;
          }
          message += '\n';
        });
        
        message += '\n';
      });
    });

    // Limit message length for Telegram
    if (message.length > 4000) {
      message = message.substring(0, 3900) + '\n\n... (النتائج محدودة، استخدم بحث أدق)';
    }

    return message.trim();
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
      return `🔍 لم يتم العثور على نتائج لـ: "<b>${searchText}</b>"`;
    }

    let message = `🔍 <b>نتائج البحث عن "${searchText}":</b>\n\n`;
    
    items.slice(0, 20).forEach((item, idx) => {
      const available = item.available_quantity || 0;
      const icon = available > 0 ? '✅' : '❌';
      const status = available > 0 ? `<b>${available} قطعة</b>` : '<i>نافذ</i>';
      
      message += `${idx + 1}. <b>${item.product_name}</b>\n`;
      message += `   🎨 ${item.color_name} • 📏 ${item.size_name}\n`;
      message += `   ${icon} ${status}`;
      if (item.reserved_quantity > 0) {
        message += ` <i>(محجوز: ${item.reserved_quantity})</i>`;
      }
      message += `\n   📦 إجمالي: ${item.total_quantity}\n\n`;
    });

    if (items.length > 20) {
      message += `\n... وعدد <b>${items.length - 20}</b> نتيجة أخرى`;
    }

    return message;
  } catch (error) {
    console.error('❌ خطأ في البحث الذكي:', error);
    return '❌ حدث خطأ في البحث. يرجى المحاولة لاحقاً.';
  }
}

// Helper function to get product list buttons
async function getProductButtons(employeeId: string): Promise<any> {
  console.log('🔍 getProductButtons called for employee:', employeeId);
  
  try {
    const { data, error } = await supabase.rpc('get_inventory_by_permissions', {
      p_employee_id: employeeId,
      p_filter_type: null,
      p_filter_value: null
    });

    console.log('📊 RPC result - error:', error, 'data length:', data?.length);

    if (error) {
      console.error('❌ خطأ في RPC getProductButtons:', error);
      // Fallback: استعلام مباشر من جدول المنتجات
      console.log('🔄 Trying fallback query...');
      const { data: productsData, error: fallbackError } = await supabase
        .from('products')
        .select('id, name')
        .eq('is_active', true)
        .limit(8);
      
      if (fallbackError) {
        console.error('❌ Fallback query failed:', fallbackError);
        return null;
      }
      
      if (!productsData || productsData.length === 0) {
        console.log('⚠️ No products in fallback');
        return null;
      }
      
      console.log('✅ Fallback succeeded, products:', productsData.length);
      const buttons = productsData.map((p: any) => [{
        text: `🛍️ ${p.name}`,
        callback_data: `select_product_${p.id}`
      }]);
      
      return { inline_keyboard: buttons };
    }

    if (!data || data.length === 0) {
      console.log('⚠️ لا توجد منتجات للموظف');
      return null;
    }

    // استخراج المنتجات الفريدة
    const uniqueProducts = new Map<string, any>();
    data.forEach((item: any) => {
      if (!uniqueProducts.has(item.product_id)) {
        uniqueProducts.set(item.product_id, {
          id: item.product_id,
          name: item.product_name
        });
      }
    });

    console.log('✅ Unique products found:', uniqueProducts.size);

    // أخذ أول 8 منتجات
    const products = Array.from(uniqueProducts.values()).slice(0, 8);
    const buttons = products.map((p: any) => [{
      text: `🛍️ ${p.name}`,
      callback_data: `select_product_${p.id}`
    }]);

    if (uniqueProducts.size > 8) {
      buttons.push([{ text: '⬇️ المزيد...', callback_data: 'more_products' }]);
    }

    console.log('🔘 Buttons created:', buttons.length);
    return { inline_keyboard: buttons };
  } catch (error) {
    console.error('❌ خطأ في جلب قائمة المنتجات:', error);
    return null;
  }
}

// Helper function to get color buttons
async function getColorButtons(employeeId: string): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('colors')
      .select('id, name')
      .limit(8);

    if (error || !data || data.length === 0) {
      return null;
    }

    const buttons = data.map((c: any) => [{
      text: `🎨 ${c.name}`,
      callback_data: `select_color_${c.name}`
    }]);

    return { inline_keyboard: buttons };
  } catch (error) {
    console.error('❌ خطأ في جلب قائمة الألوان:', error);
    return null;
  }
}

// Helper function to get size buttons
async function getSizeButtons(): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('sizes')
      .select('id, name')
      .limit(8);

    if (error || !data || data.length === 0) {
      return null;
    }

    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    const sortedSizes = data.sort((a: any, b: any) => {
      const aIndex = sizeOrder.indexOf(a.name);
      const bIndex = sizeOrder.indexOf(b.name);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    const buttons = sortedSizes.map((s: any) => [{
      text: `📏 ${s.name}`,
      callback_data: `select_size_${s.name}`
    }]);

    return { inline_keyboard: buttons };
  } catch (error) {
    console.error('❌ خطأ في جلب قائمة القياسات:', error);
    return null;
  }
}

// Helper function to get category buttons
async function getCategoryButtons(): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name')
      .limit(8);

    if (error || !data || data.length === 0) {
      return null;
    }

    const buttons = data.map((c: any) => [{
      text: `🏷️ ${c.name}`,
      callback_data: `select_category_${c.name}`
    }]);

    return { inline_keyboard: buttons };
  } catch (error) {
    console.error('❌ خطأ في جلب قائمة التصنيفات:', error);
    return null;
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
        await sendTelegramMessage(chatId, WELCOME_MESSAGE, botToken, INVENTORY_KEYBOARD);
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
      
      // Handle /stats command
      if (text === '/stats') {
        const statsMessage = await handleInventoryStats(employeeId);
        await sendTelegramMessage(chatId, statsMessage, botToken);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle /inventory command (quick inventory with keyboard)
      if (text === '/inventory') {
        const inventoryMessage = '📦 اختر نوع الجرد الذي تريده:';
        await sendTelegramMessage(chatId, inventoryMessage, botToken, INVENTORY_KEYBOARD);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle /product command with interactive buttons
      if (text.startsWith('/product')) {
        const searchValue = text.replace(/^\/product\s*/i, '').trim();
        if (!searchValue) {
          // Show product buttons
          const productButtons = await getProductButtons(employeeId);
          if (productButtons) {
            await sendTelegramMessage(chatId, '🛍️ اختر المنتج الذي تريد معرفة جرده:', botToken, productButtons);
          } else {
            await sendTelegramMessage(chatId, '❌ لا توجد منتجات متاحة حالياً', botToken);
          }
        } else {
          const inventoryMessage = await handleInventorySearch(employeeId, 'product', searchValue);
          await sendTelegramMessage(chatId, inventoryMessage, botToken);
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle /category command with interactive buttons
      if (text.startsWith('/category')) {
        const searchValue = text.replace(/^\/category\s*/i, '').trim();
        if (!searchValue) {
          // Show category buttons
          const categoryButtons = await getCategoryButtons();
          if (categoryButtons) {
            await sendTelegramMessage(chatId, '🏷️ اختر التصنيف الذي تريد معرفة جرده:', botToken, categoryButtons);
          } else {
            await sendTelegramMessage(chatId, '❌ لا توجد تصنيفات متاحة حالياً', botToken);
          }
        } else {
          const inventoryMessage = await handleInventorySearch(employeeId, 'category', searchValue);
          await sendTelegramMessage(chatId, inventoryMessage, botToken);
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle /color command
      if (text.startsWith('/color')) {
        const searchValue = text.replace(/^\/color\s*/i, '').trim();
        if (!searchValue) {
          await sendTelegramMessage(chatId, '⚠️ يرجى كتابة اسم اللون بعد الأمر\nمثال: /color أحمر', botToken);
        } else {
          const inventoryMessage = await handleInventorySearch(employeeId, 'color', searchValue);
          await sendTelegramMessage(chatId, inventoryMessage, botToken);
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle /size command
      if (text.startsWith('/size')) {
        const searchValue = text.replace(/^\/size\s*/i, '').trim();
        if (!searchValue) {
          await sendTelegramMessage(chatId, '⚠️ يرجى كتابة القياس بعد الأمر\nمثال: /size سمول', botToken);
        } else {
          const inventoryMessage = await handleInventorySearch(employeeId, 'size', searchValue);
          await sendTelegramMessage(chatId, inventoryMessage, botToken);
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle /season command with interactive buttons
      if (text.startsWith('/season')) {
        const searchValue = text.replace(/^\/season\s*/i, '').trim();
        if (!searchValue) {
          // Show season buttons inline
          const seasonButtons = {
            inline_keyboard: [
              [{ text: '☀️ صيف', callback_data: 'select_season_صيف' }],
              [{ text: '🍂 خريف', callback_data: 'select_season_خريف' }],
              [{ text: '❄️ شتاء', callback_data: 'select_season_شتاء' }],
              [{ text: '🌸 ربيع', callback_data: 'select_season_ربيع' }]
            ]
          };
          await sendTelegramMessage(chatId, '🗓️ اختر الموسم الذي تريد معرفة جرده:', botToken, seasonButtons);
        } else {
          const inventoryMessage = await handleInventorySearch(employeeId, 'season', searchValue);
          await sendTelegramMessage(chatId, inventoryMessage, botToken);
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle /search command (smart search)
      if (text.startsWith('/search')) {
        const searchQuery = text.replace(/^\/search\s*/i, '').trim();
        if (!searchQuery) {
          await sendTelegramMessage(chatId, '⚠️ يرجى كتابة نص البحث بعد الأمر\nمثال: /search برشلونة أحمر', botToken);
        } else {
          const inventoryMessage = await handleSmartInventorySearch(employeeId, searchQuery);
          await sendTelegramMessage(chatId, inventoryMessage, botToken);
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ==========================================
      // Handle text messages (check for pending state first)
      // ==========================================
      if (text && text !== '/start') {
        // First, check if there's a pending selection state
        const { data: pendingState } = await supabase
          .from('telegram_pending_selections')
          .select('*')
          .eq('chat_id', chatId)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pendingState) {
          // User is responding to a previous button press
          console.log('📋 معالجة استجابة لحالة معلقة:', pendingState.action);
          
          let inventoryMessage = '';
          const action = pendingState.action;
          
          if (action === 'inv_product') {
            inventoryMessage = await handleInventorySearch(employeeId, 'product', text);
          } else if (action === 'inv_category') {
            inventoryMessage = await handleInventorySearch(employeeId, 'category', text);
          } else if (action === 'inv_color') {
            inventoryMessage = await handleInventorySearch(employeeId, 'color', text);
          } else if (action === 'inv_size') {
            inventoryMessage = await handleInventorySearch(employeeId, 'size', text);
          } else if (action === 'inv_season') {
            inventoryMessage = await handleInventorySearch(employeeId, 'season', text);
          } else if (action === 'inv_search') {
            inventoryMessage = await handleSmartInventorySearch(employeeId, text);
          }
          
          if (inventoryMessage) {
            await sendTelegramMessage(chatId, inventoryMessage, botToken);
            
            // Delete the pending state
            await supabase
              .from('telegram_pending_selections')
              .delete()
              .eq('id', pendingState.id);
            
            return new Response(JSON.stringify({ success: true }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }

        // No pending state - treat as order
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

        // Get employee data for inventory commands
        const { data: employeeData } = await supabase
          .from('employee_telegram_codes')
          .select('telegram_code, user_id')
          .eq('telegram_chat_id', chatId)
          .eq('is_active', true)
          .maybeSingle();

        const employeeId = employeeData?.user_id || null;

        // Process the selected option
        let responseMessage = '';
        let shouldSaveState = false;
        let stateAction = '';
        
        // Handle inventory button presses
        if (data === 'inv_product') {
          console.log('🛍️ Processing inv_product for employee:', employeeId);
          try {
            const productButtons = await getProductButtons(employeeId);
            console.log('📊 productButtons:', productButtons ? 'exists' : 'null');
            
            if (productButtons && productButtons.inline_keyboard && productButtons.inline_keyboard.length > 0) {
              console.log('✅ Sending buttons:', productButtons.inline_keyboard.length);
              await sendTelegramMessage(chatId, '🛍️ اختر منتج:', botToken, productButtons);
              shouldSaveState = true;
              stateAction = 'inv_product';
              responseMessage = '';
            } else {
              console.log('⚠️ No buttons, asking text');
              responseMessage = '🛍️ اكتب اسم المنتج:\n\nمثال: برشلونة';
              shouldSaveState = true;
              stateAction = 'inv_product';
            }
          } catch (err) {
            console.error('❌ inv_product error:', err);
            responseMessage = '❌ حدث خطأ. حاول مرة أخرى.';
          }
        } else if (data === 'inv_category') {
          try {
            const catButtons = await getCategoryButtons();
            if (catButtons && catButtons.inline_keyboard && catButtons.inline_keyboard.length > 0) {
              await sendTelegramMessage(chatId, '🏷️ اختر تصنيف:', botToken, catButtons);
              shouldSaveState = true;
              stateAction = 'inv_category';
              responseMessage = '';
            } else {
              responseMessage = '🏷️ اكتب اسم التصنيف:\n\nمثال: تيشرتات';
              shouldSaveState = true;
              stateAction = 'inv_category';
            }
          } catch (err) {
            console.error('❌ inv_category error:', err);
            responseMessage = '❌ حدث خطأ. حاول مرة أخرى.';
          }
        } else if (data === 'inv_color') {
          try {
            const colorButtons = await getColorButtons(employeeId);
            if (colorButtons && colorButtons.inline_keyboard && colorButtons.inline_keyboard.length > 0) {
              await sendTelegramMessage(chatId, '🎨 اختر لون:', botToken, colorButtons);
              shouldSaveState = true;
              stateAction = 'inv_color';
              responseMessage = '';
          } else {
            responseMessage = '🎨 اكتب اسم اللون الذي تريد الاستعلام عنه:\n\nمثال: أحمر';
            shouldSaveState = true;
            stateAction = 'inv_color';
          }
        } else if (data === 'inv_size') {
          // عرض قائمة القياسات بأزرار تفاعلية
          const sizeButtons = await getSizeButtons();
          if (sizeButtons) {
            await sendTelegramMessage(chatId, '📏 اختر قياس أو اكتب اسمه:', botToken, sizeButtons);
            shouldSaveState = true;
            stateAction = 'inv_size';
            responseMessage = '';
          } else {
            responseMessage = '📏 اكتب القياس الذي تريد الاستعلام عنه:\n\nمثال: سمول';
            shouldSaveState = true;
            stateAction = 'inv_size';
          }
        } else if (data === 'inv_season') {
          responseMessage = '🌞 اكتب اسم الموسم الذي تريد الاستعلام عنه:\n\nمثال: صيفي';
          shouldSaveState = true;
          stateAction = 'inv_season';
        } else if (data === 'inv_search') {
          responseMessage = '🔍 اكتب نص البحث الذكي:\n\nمثال: برشلونة أحمر';
          shouldSaveState = true;
          stateAction = 'inv_search';
        } else if (data === 'inv_stats') {
          responseMessage = await handleInventoryStats(employeeId);
        } else if (data === 'inv_quick') {
          responseMessage = await handleInventorySearch(employeeId, 'all', '');
        }
        // Handle direct selection from buttons
        else if (data.startsWith('select_product_')) {
          const productId = data.replace('select_product_', '');
          // البحث مباشرة باستخدام ID المنتج
          const { data: productData } = await supabase
            .from('products')
            .select('name')
            .eq('id', productId)
            .maybeSingle();
          
          if (productData) {
            responseMessage = await handleInventorySearch(employeeId, 'product', productData.name);
          } else {
            responseMessage = '❌ لم يتم العثور على المنتج';
          }
        } else if (data.startsWith('select_color_')) {
          const colorName = data.replace('select_color_', '').replace(/_/g, ' ');
          responseMessage = await handleInventorySearch(employeeId, 'color', colorName);
        } else if (data.startsWith('select_size_')) {
          const sizeName = data.replace('select_size_', '').replace(/_/g, ' ');
          responseMessage = await handleInventorySearch(employeeId, 'size', sizeName);
        } else if (data.startsWith('select_category_')) {
          const catName = data.replace('select_category_', '').replace(/_/g, ' ');
          responseMessage = await handleInventorySearch(employeeId, 'category', catName);
        } else if (data.startsWith('select_season_')) {
          const seasonName = data.replace('select_season_', '').replace(/_/g, ' ');
          responseMessage = await handleInventorySearch(employeeId, 'season', seasonName);
        }
        
        // Save state if needed
        if (shouldSaveState && stateAction) {
          // Delete any existing pending states for this chat
          await supabase
            .from('telegram_pending_selections')
            .delete()
            .eq('chat_id', chatId);
          
          // Save new state
          await supabase
            .from('telegram_pending_selections')
            .insert({
              chat_id: chatId,
              action: stateAction,
              context: {}
            });
        }
        // Handle city selection
        else if (data.startsWith('city_')) {
          const cityName = data.split('_').slice(2).join('_');
          responseMessage = `✅ تم اختيار المدينة: ${cityName}\n\nيرجى الآن إعادة كتابة طلبك مع اسم المدينة الصحيح والمنطقة ورقم الهاتف.`;
        } 
        // Handle variant selection
        else if (data.startsWith('variant_')) {
          const variantName = data.split('_').slice(2).join('_');
          responseMessage = `✅ تم اختيار المنتج: ${variantName}\n\nيرجى إعادة كتابة طلبك مع المواصفات الصحيحة والعنوان ورقم الهاتف.`;
        }

        if (responseMessage) {
          // For inventory buttons that expect user input, send with HTML parse mode
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: responseMessage,
              parse_mode: 'HTML'
            })
          });
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