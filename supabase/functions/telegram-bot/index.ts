// Telegram Bot Edge Function - Force redeploy 2025-10-03 with Local Cache
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ==========================================
// Local Cities/Regions Cache
// ==========================================
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
let citiesCache: Array<{ id: number; name: string; normalized: string; alwaseet_id: number }> = [];
let regionsCache: Array<{ id: number; city_id: number; name: string; normalized: string; alwaseet_id: number }> = [];
let cityAliasesCache: Array<{ city_id: number; alias: string; normalized: string; confidence: number }> = [];
let lastCacheUpdate: number | null = null;

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

async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: any, botToken?: string) {
  try {
    // If botToken is not provided, get it from the function
    const token = botToken || await getBotToken();
    if (!token) {
      console.error('❌ لا يوجد رمز بوت متاح');
      throw new Error('Bot token not available');
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
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

// ==========================================
// Text Normalization for Cities/Regions
// ==========================================
function normalizeArabicText(text: string): string {
  try {
    let normalized = text.toLowerCase().trim();
    // إزالة "ال" التعريف من البداية
    normalized = normalized.replace(/^ال/, '');
    // توحيد الهمزات
    normalized = normalized.replace(/[أإآ]/g, 'ا');
    // توحيد التاء المربوطة
    normalized = normalized.replace(/[ة]/g, 'ه');
    // توحيد الواو
    normalized = normalized.replace(/[ؤ]/g, 'و');
    // توحيد الياء
    normalized = normalized.replace(/[ئ]/g, 'ي');
    // إزالة الهمزة المفردة
    normalized = normalized.replace(/[ء]/g, '');
    // توحيد المسافات
    normalized = normalized.replace(/\s+/g, ' ');
    return normalized;
  } catch (error) {
    console.error('❌ خطأ في تطبيع النص:', error);
    return text.toLowerCase().trim();
  }
}

// ==========================================
// Get Delivery Partner Setting
// ==========================================
async function getDeliveryPartnerSetting(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'telegram_bot_delivery_partner')
      .maybeSingle();
    
    if (error) throw error;
    
    // Extract string value from jsonb
    const partner = typeof data?.value === 'string' 
      ? data.value 
      : (data?.value as any);
    
    return partner || 'alwaseet';
  } catch (error) {
    console.error('❌ خطأ في قراءة إعداد شركة التوصيل:', error);
    return 'alwaseet'; // Default fallback
  }
}

// ==========================================
// Load Cities/Regions Cache
// ==========================================
async function loadCitiesRegionsCache(): Promise<boolean> {
  try {
    console.log('🔄 تحميل cache المدن والمناطق...');
    
    // Get delivery partner setting
    const deliveryPartner = await getDeliveryPartnerSetting();
    console.log(`📦 شركة التوصيل المختارة: ${deliveryPartner}`);
    
    // Load cities
    const { data: cities, error: citiesError } = await supabase
      .from('cities_cache')
      .select('id, name, alwaseet_id')
      .eq('is_active', true)
      .order('name');
    
    if (citiesError) throw citiesError;
    
    // Load regions
    const { data: regions, error: regionsError } = await supabase
      .from('regions_cache')
      .select('id, city_id, name, alwaseet_id')
      .eq('is_active', true)
      .order('name');
    
    if (regionsError) throw regionsError;
    
    // Load city aliases
    const { data: aliases, error: aliasesError } = await supabase
      .from('city_aliases')
      .select('city_id, alias_name, confidence_score');
    
    if (aliasesError) {
      console.warn('⚠️ تحذير: فشل تحميل city_aliases:', aliasesError);
      // Continue without aliases
    }
    
    // Normalize and cache - تخزين جميع المدن والمناطق الخاصة بشركة التوصيل
    citiesCache = (cities || []).map(c => ({
      id: c.id,
      name: c.name,
      normalized: normalizeArabicText(c.name),
      alwaseet_id: c.alwaseet_id
    }));
    
    regionsCache = (regions || []).map(r => ({
      id: r.id,
      city_id: r.city_id,
      name: r.name,
      normalized: normalizeArabicText(r.name),
      alwaseet_id: r.alwaseet_id
    }));
    
    cityAliasesCache = (aliases || []).map(a => ({
      city_id: a.city_id,
      alias: a.alias_name,
      normalized: normalizeArabicText(a.alias_name),
      confidence: a.confidence_score || 0.8
    }));
    
    lastCacheUpdate = Date.now();
    
    console.log(`✅ تم تحميل ${citiesCache.length} مدينة و ${regionsCache.length} منطقة و ${cityAliasesCache.length} اسم بديل لشركة ${deliveryPartner}`);
    return true;
  } catch (error) {
    console.error('❌ فشل تحميل cache المدن والمناطق:', error);
    return false;
  }
}

// ==========================================
// Search City Locally
// ==========================================
function searchCityLocal(text: string): { cityId: number; cityName: string; confidence: number } | null {
  try {
    const normalized = normalizeArabicText(text);
    
    // Direct match in cities
    const exactCity = citiesCache.find(c => c.normalized === normalized);
    if (exactCity) {
      return { cityId: exactCity.id, cityName: exactCity.name, confidence: 1.0 };
    }
    
    // Starts with match
    const startsWithCity = citiesCache.find(c => c.normalized.startsWith(normalized) || normalized.startsWith(c.normalized));
    if (startsWithCity) {
      return { cityId: startsWithCity.id, cityName: startsWithCity.name, confidence: 0.9 };
    }
    
    // Check aliases
    const alias = cityAliasesCache.find(a => a.normalized === normalized);
    if (alias) {
      const city = citiesCache.find(c => c.id === alias.city_id);
      if (city) {
        return { cityId: city.id, cityName: city.name, confidence: alias.confidence };
      }
    }
    
    // Contains match
    const containsCity = citiesCache.find(c => c.normalized.includes(normalized) || normalized.includes(c.normalized));
    if (containsCity) {
      return { cityId: containsCity.id, cityName: containsCity.name, confidence: 0.7 };
    }
    
    return null;
  } catch (error) {
    console.error('❌ خطأ في البحث المحلي عن المدينة:', error);
    return null;
  }
}

// ==========================================
// Search Regions Locally
// ==========================================
function searchRegionsLocal(cityId: number, text: string): Array<{ regionId: number; regionName: string; confidence: number }> {
  try {
    const normalized = normalizeArabicText(text);
    const cityRegions = regionsCache.filter(r => r.city_id === cityId);
    
    const matches: Array<{ regionId: number; regionName: string; confidence: number }> = [];
    
    for (const region of cityRegions) {
      if (region.normalized === normalized) {
        matches.push({ regionId: region.id, regionName: region.name, confidence: 1.0 });
      } else if (region.normalized.startsWith(normalized) || normalized.startsWith(region.normalized)) {
        matches.push({ regionId: region.id, regionName: region.name, confidence: 0.9 });
      } else if (region.normalized.includes(normalized) || normalized.includes(region.normalized)) {
        matches.push({ regionId: region.id, regionName: region.name, confidence: 0.7 });
      }
    }
    
    // Sort by confidence
    matches.sort((a, b) => b.confidence - a.confidence);
    
    return matches;
  } catch (error) {
    console.error('❌ خطأ في البحث المحلي عن المناطق:', error);
    return [];
  }
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
    console.log('📊 جلب الإحصائيات للموظف:', employeeId);
    
    const { data, error } = await supabase.rpc('get_unified_inventory_stats', {
      p_employee_id: employeeId
    });

    if (error) throw error;

    const stats = data?.[0];
    if (!stats) {
      return '📊 لا توجد بيانات متاحة حالياً.';
    }

    const totalQuantity = stats.total_quantity || 0;
    const reservedStock = stats.reserved_stock_count || 0;
    const availableStock = totalQuantity - reservedStock;

    return `📊 إحصائيات المخزون الخاص بك:

✅ إجمالي المنتجات: ${stats.total_products || 0}
🎨 إجمالي المتغيرات: ${stats.total_variants || 0}
📦 إجمالي المخزون: ${totalQuantity}
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
      console.log('⚠️ لا توجد منتجات للموظف حسب صلاحياته');
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

    if (uniqueProducts.size === 0) {
      console.log('⚠️ No unique products after filtering');
      return null;
    }

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
        await sendTelegramMessage(chatId, WELCOME_MESSAGE, INVENTORY_KEYBOARD, botToken);
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
        await sendTelegramMessage(chatId, statsMessage, undefined, botToken);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle /inventory command (quick inventory with keyboard)
      if (text === '/inventory') {
        const inventoryMessage = '📦 اختر نوع الجرد الذي تريده:';
        await sendTelegramMessage(chatId, inventoryMessage, INVENTORY_KEYBOARD, botToken);
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
            await sendTelegramMessage(chatId, '🛍️ اختر المنتج الذي تريد معرفة جرده:', productButtons, botToken);
          } else {
            await sendTelegramMessage(chatId, '❌ لا توجد منتجات متاحة حالياً', undefined, botToken);
          }
        } else {
          const inventoryMessage = await handleInventorySearch(employeeId, 'product', searchValue);
          await sendTelegramMessage(chatId, inventoryMessage, undefined, botToken);
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
            await sendTelegramMessage(chatId, '🏷️ اختر التصنيف الذي تريد معرفة جرده:', categoryButtons, botToken);
          } else {
            await sendTelegramMessage(chatId, '❌ لا توجد تصنيفات متاحة حالياً', undefined, botToken);
          }
        } else {
          const inventoryMessage = await handleInventorySearch(employeeId, 'category', searchValue);
          await sendTelegramMessage(chatId, inventoryMessage, undefined, botToken);
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
          await sendTelegramMessage(chatId, '⚠️ يرجى كتابة اسم اللون بعد الأمر\nمثال: /color أحمر', undefined, botToken);
        } else {
          const inventoryMessage = await handleInventorySearch(employeeId, 'color', searchValue);
          await sendTelegramMessage(chatId, inventoryMessage, undefined, botToken);
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
          await sendTelegramMessage(chatId, '⚠️ يرجى كتابة القياس بعد الأمر\nمثال: /size سمول', undefined, botToken);
        } else {
          const inventoryMessage = await handleInventorySearch(employeeId, 'size', searchValue);
          await sendTelegramMessage(chatId, inventoryMessage, undefined, botToken);
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
          await sendTelegramMessage(chatId, '🗓️ اختر الموسم الذي تريد معرفة جرده:', seasonButtons, botToken);
        } else {
          const inventoryMessage = await handleInventorySearch(employeeId, 'season', searchValue);
          await sendTelegramMessage(chatId, inventoryMessage, undefined, botToken);
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
          await sendTelegramMessage(chatId, '⚠️ يرجى كتابة نص البحث بعد الأمر\nمثال: /search برشلونة أحمر', undefined, botToken);
        } else {
          const inventoryMessage = await handleSmartInventorySearch(employeeId, searchQuery);
          await sendTelegramMessage(chatId, inventoryMessage, undefined, botToken);
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
            await sendTelegramMessage(chatId, inventoryMessage, undefined, botToken);
            
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
          console.log('🔄 معالجة الطلب...');
          
          // We already fetched employeeData above, use it
          const employeeCode = employeeData?.telegram_code || '';
          console.log('👤 رمز الموظف المستخدم:', employeeCode);
          console.log('👤 معرف الموظف المستخدم:', employeeId);

          // ==========================================
          // المرحلة 1: محاولة التحليل المحلي للعنوان
          // ==========================================
          // CRITICAL FIX: Local "Did you mean?" system
          // ==========================================
          console.log('🔄 بدء نظام "هل تقصد؟" المحلي...');
          
          let shouldUseLocalCache = false;
          let localCityResult: { cityId: number; cityName: string; confidence: number } | null = null;
          let localRegionMatches: Array<{ regionId: number; regionName: string; confidence: number }> = [];
          
          try {
            // تحميل cache إذا لم يكن محملاً أو انتهت صلاحيته
            console.log(`🔍 فحص cache: lastUpdate=${lastCacheUpdate}, age=${lastCacheUpdate ? Date.now() - lastCacheUpdate : 'none'}, TTL=${CACHE_TTL}`);
            
            if (!lastCacheUpdate || (Date.now() - lastCacheUpdate > CACHE_TTL)) {
              console.log('🔄 تحميل cache جديد...');
              const cacheLoaded = await loadCitiesRegionsCache();
              console.log(`✅ نتيجة تحميل cache: ${cacheLoaded}, المدن: ${citiesCache.length}, المناطق: ${regionsCache.length}`);
              
              if (!cacheLoaded || citiesCache.length === 0) {
                console.warn('⚠️ فشل تحميل cache أو cache فارغ - استخدام الطريقة التقليدية');
                shouldUseLocalCache = false;
              } else {
                console.log('✅ تم تحميل cache بنجاح - تفعيل النظام المحلي');
                shouldUseLocalCache = true;
              }
            } else {
              console.log(`✅ استخدام cache موجود: ${citiesCache.length} مدينة، ${regionsCache.length} منطقة`);
              shouldUseLocalCache = true;
            }
            
            if (shouldUseLocalCache && citiesCache.length > 0) {
              console.log('🔍 محاولة التحليل المحلي للعنوان...');
              console.log(`📝 النص المدخل: "${text}"`);
              
              // البحث عن المدينة محلياً
              localCityResult = searchCityLocal(text);
              console.log(`🏙️ نتيجة البحث عن المدينة:`, localCityResult);
              
              if (localCityResult && localCityResult.confidence >= 0.7) {
                console.log(`✅ تم العثور على مدينة: ${localCityResult.cityName} (ثقة: ${localCityResult.confidence})`);
                
                // البحث عن المناطق المحتملة
                localRegionMatches = searchRegionsLocal(localCityResult.cityId, text);
                console.log(`🔍 تم العثور على ${localRegionMatches.length} منطقة محتملة:`, localRegionMatches);
                
                // السيناريو 1: مدينة واضحة + منطقة واحدة واضحة
                if (localRegionMatches.length === 1 && localRegionMatches[0].confidence >= 0.9) {
                  console.log('✅ السيناريو 1: مدينة ومنطقة واضحة - إنشاء طلب مباشرة');
                  console.log(`📍 المدينة: ${localCityResult.cityName} (ID: ${localCityResult.cityId})`);
                  console.log(`📍 المنطقة: ${localRegionMatches[0].regionName} (ID: ${localRegionMatches[0].regionId})`);
                  // Continue to process_telegram_order with resolved location
                  shouldUseLocalCache = false;
                }
                // السيناريو 2: مدينة واضحة + عدة مناطق محتملة - "هل تقصد؟"
                else if (localRegionMatches.length >= 2) {
                  console.log(`⚠️ السيناريو 2: ${localRegionMatches.length} مناطق محتملة - عرض "هل تقصد؟"`);
                  
                  // حذف أي حالة معلقة سابقة
                  await supabase
                    .from('telegram_pending_selections')
                    .delete()
                    .eq('chat_id', chatId);
                  
                  // حفظ بيانات الطلب مؤقتاً
                  await supabase
                    .from('telegram_pending_selections')
                    .insert({
                      chat_id: chatId,
                      action: 'region_clarification',
                      context: {
                        original_text: text,
                        employee_code: employeeCode,
                        city_id: localCityResult.cityId,
                        city_name: localCityResult.cityName
                      }
                    });
                  
                  // بناء أزرار المناطق (أقصى 5 مناطق)
                  const regionButtons = localRegionMatches.slice(0, 5).map(r => [{
                    text: `📍 ${r.regionName}`,
                    callback_data: `region_${r.regionId}`
                  }]);
                  
                  // إضافة زر "لا شيء مما سبق"
                  regionButtons.push([{
                    text: '❌ لا شيء مما سبق',
                    callback_data: 'region_none'
                  }]);
                  
                  const clarificationMessage = `🏙️ <b>${localCityResult.cityName}</b>\n\n🤔 هل تقصد إحدى هذه المناطق؟`;
                  
                  await sendTelegramMessage(chatId, clarificationMessage, { inline_keyboard: regionButtons }, botToken);
                  
                  return new Response(JSON.stringify({ success: true, action: 'clarification_sent' }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                  });
                }
                // السيناريو 3: مدينة واضحة + لا توجد مناطق
                else {
                  console.log('⚠️ السيناريو 3: لا توجد مناطق محددة - استخدام الطريقة التقليدية');
                  shouldUseLocalCache = false;
                }
              } else {
                console.log('⚠️ لم يتم العثور على مدينة واضحة - استخدام الطريقة التقليدية');
                shouldUseLocalCache = false;
              }
            }
          } catch (localCacheError) {
            console.error('❌ خطأ في التحليل المحلي:', localCacheError);
            shouldUseLocalCache = false;
          }

          // ==========================================
          // المرحلة 2: Fallback للطريقة التقليدية
          // ==========================================
          if (!shouldUseLocalCache) {
            console.log('🔄 استخدام الطريقة التقليدية (process_telegram_order)...');
          }
          
          // استدعاء الدالة الذكية (مع أو بدون التحليل المحلي)
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
            
            await sendTelegramMessage(chatId, errorMessage, undefined, botToken);
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
            await sendTelegramMessage(chatId, orderResult.message, undefined, botToken);
          } else {
            // معالجة الأخطاء
            let errorMessage = orderResult?.message || 'لم أتمكن من فهم طلبك بشكل كامل.';
            await sendTelegramMessage(chatId, errorMessage, undefined, botToken);
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
          
          await sendTelegramMessage(chatId, errorMessage, undefined, botToken);
        }
      }

    } else if (update.callback_query) {
      // Handle inline keyboard button presses
      const { callback_query } = update;
      const chatId = callback_query.message?.chat?.id;
      const data = callback_query.data;

      console.log(`🔘 ضغطة زر من ${callback_query.from?.id}: "${data}" في المحادثة ${chatId}`);

      if (chatId && data) {
        // Answer the callback query فوراً لإزالة "يتم التحميل..."
        console.log('⏳ إرسال answerCallbackQuery...');
        const answerResponse = await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callback_query.id,
            text: '✅ جاري المعالجة...'
          })
        });
        
        const answerResult = await answerResponse.json();
        console.log('✅ answerCallbackQuery نتيجة:', answerResult.ok ? 'نجح' : 'فشل');

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
              await sendTelegramMessage(chatId, '🛍️ اختر منتج:', productButtons, botToken);
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
              await sendTelegramMessage(chatId, '🏷️ اختر تصنيف:', catButtons, botToken);
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
              await sendTelegramMessage(chatId, '🎨 اختر لون:', colorButtons, botToken);
              shouldSaveState = true;
              stateAction = 'inv_color';
              responseMessage = '';
            } else {
              responseMessage = '🎨 اكتب اسم اللون:\n\nمثال: أحمر';
              shouldSaveState = true;
              stateAction = 'inv_color';
            }
          } catch (err) {
            console.error('❌ inv_color error:', err);
            responseMessage = '❌ حدث خطأ. حاول مرة أخرى.';
          }
        } else if (data === 'inv_size') {
          // عرض قائمة القياسات بأزرار تفاعلية
          const sizeButtons = await getSizeButtons();
          if (sizeButtons) {
            await sendTelegramMessage(chatId, '📏 اختر قياس أو اكتب اسمه:', sizeButtons, botToken);
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
        // ==========================================
        // Handle Region Selection from "Did you mean?"
        // ==========================================
        else if (data.startsWith('region_')) {
          try {
            // جلب الحالة المعلقة
            const { data: pendingData } = await supabase
              .from('telegram_pending_selections')
              .select('*')
              .eq('chat_id', chatId)
              .eq('action', 'region_clarification')
              .gt('expires_at', new Date().toISOString())
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (!pendingData) {
              responseMessage = '⚠️ انتهت صلاحية هذا الاختيار. يرجى إعادة إرسال طلبك.';
            } else if (data === 'region_none') {
              // المستخدم اختار "لا شيء مما سبق" - استخدام الطريقة التقليدية
              responseMessage = '🔄 جاري معالجة طلبك بالطريقة التقليدية...';
              
              const { data: orderResult, error: orderError } = await supabase.rpc('process_telegram_order', {
                p_employee_code: pendingData.context.employee_code,
                p_message_text: pendingData.context.original_text,
                p_telegram_chat_id: chatId
              });
              
              if (orderError) throw orderError;
              
              if (orderResult?.success) {
                responseMessage = orderResult.message;
              } else {
                responseMessage = orderResult?.message || 'لم أتمكن من معالجة طلبك.';
              }
              
              // حذف الحالة المعلقة
              await supabase
                .from('telegram_pending_selections')
                .delete()
                .eq('id', pendingData.id);
            } else {
              // المستخدم اختار منطقة محددة
              const regionId = parseInt(data.replace('region_', ''));
              
              // إنشاء الطلب مع city_id و region_id المحددين
              const { data: orderResult, error: orderError } = await supabase.rpc('process_telegram_order', {
                p_employee_code: pendingData.context.employee_code,
                p_message_text: pendingData.context.original_text,
                p_telegram_chat_id: chatId
              });
              
              if (orderError) throw orderError;
              
              // تحديث ai_order مع city_id و region_id الصحيحين
              if (orderResult?.ai_order_id) {
                await supabase
                  .from('ai_orders')
                  .update({
                    city_id: pendingData.context.city_id,
                    region_id: regionId,
                    location_confidence: 1.0
                  })
                  .eq('id', orderResult.ai_order_id);
              }
              
              if (orderResult?.success) {
                // الحصول على اسم المنطقة المختارة
                const selectedRegion = regionsCache.find(r => r.id === regionId);
                const regionName = selectedRegion?.name || 'المنطقة المختارة';
                
                responseMessage = `✅ تم تأكيد العنوان:\n🏙️ ${pendingData.context.city_name} - ${regionName}\n\n` + orderResult.message;
              } else {
                responseMessage = orderResult?.message || 'لم أتمكن من معالجة طلبك.';
              }
              
              // حذف الحالة المعلقة
              await supabase
                .from('telegram_pending_selections')
                .delete()
                .eq('id', pendingData.id);
            }
          } catch (regionError) {
            console.error('❌ خطأ في معالجة اختيار المنطقة:', regionError);
            responseMessage = '❌ حدث خطأ في معالجة اختيارك. يرجى إعادة إرسال طلبك.';
          }
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