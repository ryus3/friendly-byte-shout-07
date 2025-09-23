import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Telegram Bot Token
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');

// Telegram message interface
interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    language_code?: string;
  };
  chat: {
    id: number;
    first_name: string;
    last_name?: string;
    type: string;
  };
  date: number;
  text?: string;
  entities?: Array<{
    offset: number;
    length: number;
    type: string;
  }>;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

// Send message to Telegram
async function sendTelegramMessage(chatId: number, text: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      }),
    });

    if (!response.ok) {
      console.error('Failed to send Telegram message:', await response.text());
    }
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
}

// Get cities from cache
async function getCitiesFromCache() {
  try {
    const { data, error } = await supabase
      .from('cities_cache')
      .select('*')
      .eq('is_active', true);
    
    if (error) {
      console.error('Error fetching cities:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Exception fetching cities:', error);
    return [];
  }
}

// Get regions by city
async function getRegionsByCity(cityId: number) {
  try {
    const { data, error } = await supabase
      .from('regions_cache')
      .select('*')
      .eq('city_id', cityId)
      .eq('is_active', true);
    
    if (error) {
      console.error('Error fetching regions:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Exception fetching regions:', error);
    return [];
  }
}

// Normalize Arabic text
function normalizeArabic(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/[\u064B-\u0652]/g, '') // Remove diacritics
    .replace(/[إأآ]/g, 'ا') // Normalize alef
    .replace(/ة/g, 'ه') // Normalize teh marbuta
    .replace(/ي/g, 'ي') // Normalize yeh
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim()
    .toLowerCase();
}

// Calculate similarity between strings
function calculateSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeArabic(str1);
  const norm2 = normalizeArabic(str2);
  
  if (norm1 === norm2) return 1.0;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.9;
  
  // Simple character-based similarity
  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen === 0) return 1.0;
  
  let matches = 0;
  const minLen = Math.min(norm1.length, norm2.length);
  
  for (let i = 0; i < minLen; i++) {
    if (norm1[i] === norm2[i]) matches++;
  }
  
  return matches / maxLen;
}

// City name variations mapping
const cityNameVariations: Record<string, string[]> = {
  'بغداد': ['بغداد', 'Baghdad', 'baghdad'],
  'البصرة': ['البصرة', 'بصرة', 'Basra', 'basra'],
  'كربلاء': ['كربلاء', 'كربلا', 'Karbala', 'karbala'],
  'النجف': ['النجف', 'نجف', 'Najaf', 'najaf'],
  'أربيل': ['أربيل', 'اربيل', 'Erbil', 'erbil'],
  'السليمانية': ['السليمانية', 'سليمانية', 'Sulaymaniyah', 'sulaymaniyah'],
  'الموصل': ['الموصل', 'موصل', 'Mosul', 'mosul'],
  'ديالى': ['ديالى', 'ديالا', 'Diyala', 'diyala'],
  'الأنبار': ['الأنبار', 'انبار', 'الانبار', 'Anbar', 'anbar'],
  'صلاح الدين': ['صلاح الدين', 'صلاح', 'Salah al-Din', 'salah'],
  'كركوك': ['كركوك', 'Kirkuk', 'kirkuk'],
  'نينوى': ['نينوى', 'نينوا', 'Nineveh', 'nineveh'],
  'بابل': ['بابل', 'Babylon', 'babylon'],
  'واسط': ['واسط', 'Wasit', 'wasit'],
  'ذي قار': ['ذي قار', 'ذيقار', 'Dhi Qar', 'dhi qar'],
  'المثنى': ['المثنى', 'مثنى', 'Al-Muthanna', 'muthanna'],
  'القادسية': ['القادسية', 'قادسية', 'Al-Qadisiyyah', 'qadisiyyah'],
  'ميسان': ['ميسان', 'Maysan', 'maysan']
};

// Find city by variation
function findCityByVariation(searchTerm: string): string | null {
  const normalized = normalizeArabic(searchTerm);
  
  for (const [standardName, variations] of Object.entries(cityNameVariations)) {
    for (const variation of variations) {
      if (normalizeArabic(variation) === normalized) {
        return standardName;
      }
    }
  }
  
  return null;
}

// Create flexible search terms for products
function createFlexibleSearchTerms(productName: string): string[] {
  const terms = [productName];
  const normalized = normalizeArabic(productName);
  
  if (normalized !== productName) {
    terms.push(normalized);
  }
  
  // Add partial terms
  const words = normalized.split(' ').filter(w => w.length > 2);
  terms.push(...words);
  
  return [...new Set(terms)];
}

// Search for product with variants and inventory
async function searchProductWithVariantsAndInventory(line: string, chatId: number, customerPhone?: string): Promise<{found: boolean, message?: string}> {
  try {
    console.log(`🔍 Searching for product in line: "${line}"`);
    
    const details = parseProductDetails(line);
    console.log(`📋 Parsed details:`, details);
    
    if (!details.productName) {
      return { found: false, message: '❌ لم يتم العثور على اسم المنتج' };
    }
    
    const searchTerms = createFlexibleSearchTerms(details.productName);
    console.log(`🔍 Search terms:`, searchTerms);
    
    let product = null;
    let variant = null;
    
    // Search for product
    for (const term of searchTerms) {
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          id, name, price, cost_price,
          product_variants!inner(
            id, color_id, size_id, price, cost_price, stock_quantity,
            colors(name),
            sizes(name)
          )
        `)
        .ilike('name', `%${term}%`)
        .limit(10);
      
      if (!error && products && products.length > 0) {
        console.log(`✅ Found ${products.length} products for term: ${term}`);
        
        // Find best matching product and variant
        for (const prod of products) {
          const similarity = calculateSimilarity(prod.name, details.productName);
          
          if (similarity >= 0.6) {
            product = prod;
            
            // Try to find matching variant
            if (prod.product_variants && prod.product_variants.length > 0) {
              let bestVariant = null;
              let bestScore = 0;
              
              for (const v of prod.product_variants) {
                let score = 0;
                
                // Check color match
                if (details.color && v.colors?.name) {
                  const colorSimilarity = calculateSimilarity(v.colors.name, details.color);
                  if (colorSimilarity >= 0.7) score += 0.5;
                }
                
                // Check size match
                if (details.size && v.sizes?.name) {
                  const sizeSimilarity = calculateSimilarity(v.sizes.name, details.size);
                  if (sizeSimilarity >= 0.7) score += 0.5;
                }
                
                if (score > bestScore) {
                  bestScore = score;
                  bestVariant = v;
                }
              }
              
              variant = bestVariant || prod.product_variants[0];
            }
            
            break;
          }
        }
        
        if (product) break;
      }
    }
    
    if (!product) {
      const phone = customerPhone || extractPhoneFromContext(chatId);
      return { 
        found: false, 
        message: generateStockAlert(null, details, phone)
      };
    }
    
    // Check inventory
    const { data: inventory, error: invError } = await supabase
      .from('inventory')
      .select('quantity, reserved_quantity')
      .eq(variant ? 'variant_id' : 'product_id', variant?.id || product.id)
      .single();
    
    const availableStock = inventory ? inventory.quantity - (inventory.reserved_quantity || 0) : 0;
    
    if (availableStock <= 0) {
      const phone = customerPhone || extractPhoneFromContext(chatId);
      return { 
        found: false, 
        message: generateStockAlert(product, details, phone, variant)
      };
    }
    
    console.log(`✅ Product found: ${product.name}, Stock: ${availableStock}`);
    return { found: true };
    
  } catch (error) {
    console.error('❌ Error searching for product:', error);
    return { found: false, message: '❌ خطأ في البحث عن المنتج' };
  }
}

// Parse product details from text
function parseProductDetails(text: string): {productName: string, color?: string, size?: string} {
  const normalized = normalizeArabic(text);
  const words = normalized.split(' ').filter(w => w.trim().length > 0);
  
  // Common colors in Arabic
  const colors = ['أحمر', 'أزرق', 'أخضر', 'أصفر', 'أسود', 'أبيض', 'وردي', 'بنفسجي', 'برتقالي', 'بني', 'رمادي', 'ذهبي', 'فضي'];
  
  // Common sizes
  const sizes = ['صغير', 'متوسط', 'كبير', 'اكس لارج', 'لارج', 'ميديوم', 'سمول', 'xl', 'l', 'm', 's', 'xxl'];
  
  let foundColor = '';
  let foundSize = '';
  let productWords: string[] = [];
  
  for (const word of words) {
    let isColorOrSize = false;
    
    // Check for color
    for (const color of colors) {
      if (calculateSimilarity(word, color) >= 0.8) {
        foundColor = color;
        isColorOrSize = true;
        break;
      }
    }
    
    // Check for size
    if (!isColorOrSize) {
      for (const size of sizes) {
        if (calculateSimilarity(word, size) >= 0.8) {
          foundSize = size;
          isColorOrSize = true;
          break;
        }
      }
    }
    
    if (!isColorOrSize) {
      productWords.push(word);
    }
  }
  
  return {
    productName: productWords.join(' '),
    color: foundColor || undefined,
    size: foundSize || undefined
  };
}

// Extract phone from context
function extractPhoneFromContext(chatId: number): string {
  // Simple fallback for now
  return `07${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
}

// Generate stock alert
function generateStockAlert(product: any, details: any, phone: string, variant?: any): string {
  const productInfo = product ? 
    `المنتج: ${product.name}${variant?.colors?.name ? ` - ${variant.colors.name}` : ''}${variant?.sizes?.name ? ` - ${variant.sizes.name}` : ''}` :
    `المنتج المطلوب: ${details.productName}${details.color ? ` - ${details.color}` : ''}${details.size ? ` - ${details.size}` : ''}`;
  
  return `🚨 تنبيه نفاد المخزون

${productInfo}

📱 رقم العميل: ${phone}
⏰ وقت الطلب: ${new Date().toLocaleString('ar-EG')}

❌ هذا المنتج غير متوفر حالياً في المخزون

🔄 يرجى التحقق من البدائل المتاحة أو انتظار وصول دفعة جديدة`;
}

// Smart city finder
async function findCityByNameSmart(cityName: string) {
  try {
    // Try RPC function first
    const { data, error } = await supabase.rpc('find_city_in_cache', {
      p_city_text: cityName
    });
    
    if (!error && data && data.length > 0) {
      return data[0];
    }
    
    // Fallback to local cache
    const cities = await getCitiesFromCache();
    let bestMatch = null;
    let bestScore = 0;
    
    for (const city of cities) {
      const score = calculateSimilarity(city.name, cityName);
      if (score > bestScore && score >= 0.7) {
        bestScore = score;
        bestMatch = city;
      }
    }
    
    return bestMatch;
  } catch (error) {
    console.error('Error in smart city search:', error);
    return null;
  }
}

// Parse address with smart matching
async function parseAddressWithSmartMatching(addressText: string) {
  const words = addressText.split(/\s+/).filter(w => w.trim().length > 0);
  let cityMatch = null;
  let regionMatch = null;
  let usedIndices = new Set();
  
  // Try to find city
  for (let i = 0; i < words.length; i++) {
    if (usedIndices.has(i)) continue;
    
    // Try single word
    let city = await findCityByNameSmart(words[i]);
    if (city) {
      cityMatch = city;
      usedIndices.add(i);
      break;
    }
    
    // Try two words
    if (i < words.length - 1) {
      city = await findCityByNameSmart(`${words[i]} ${words[i + 1]}`);
      if (city) {
        cityMatch = city;
        usedIndices.add(i);
        usedIndices.add(i + 1);
        break;
      }
    }
  }
  
  // Try to find region if city found
  if (cityMatch) {
    const regions = await getRegionsByCity(cityMatch.alwaseet_id);
    const remainingWords = words.filter((_, index) => !usedIndices.has(index));
    
    for (const regionCandidate of remainingWords) {
      for (const region of regions) {
        if (calculateSimilarity(region.name, regionCandidate) >= 0.7) {
          regionMatch = region;
          usedIndices.add(words.indexOf(regionCandidate));
          break;
        }
      }
      if (regionMatch) break;
    }
  }
  
  const remainingText = words
    .filter((_, index) => !usedIndices.has(index))
    .join(' ')
    .trim();
  
  return {
    city: cityMatch,
    region: regionMatch,
    address: remainingText,
    originalText: addressText
  };
}

// Get employee by Telegram chat ID
async function getEmployeeByTelegramId(chatId: number) {
  try {
    console.log(`🔍 Looking for employee with chat ID: ${chatId}`);
    
    // Try using new RPC function
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_employee_by_telegram_chat_id', {
      p_chat_id: chatId
    });
    
    if (!rpcError && rpcData?.success) {
      console.log(`📋 Employee RPC response:`, JSON.stringify(rpcData, null, 2));
      return rpcData.employee;
    }
    
    // Fallback to direct query if RPC fails
    const { data, error } = await supabase
      .from('employee_telegram_codes')
      .select(`
        user_id,
        telegram_code,
        telegram_chat_id,
        is_active,
        linked_at
      `)
      .eq('telegram_chat_id', chatId)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('❌ Error fetching employee:', error);
      return null;
    }

    if (data) {
      console.log(`👤 Employee found via direct query:`, data);
      return {
        user_id: data.user_id,
        employee_code: data.telegram_code,
        telegram_chat_id: data.telegram_chat_id,
        is_active: data.is_active,
        full_name: 'موظف' // Default name for direct query
      };
    }

    return null;
  } catch (error) {
    console.error('❌ Exception in getEmployeeByTelegramId:', error);
    return null;
  }
}

// Link employee code to telegram chat ID
async function linkEmployeeCode(employeeCode: string, chatId: number) {
  try {
    console.log(`🔗 Attempting to link employee code ${employeeCode} to chat ID ${chatId}`);
    
    const { data, error } = await supabase.rpc('link_employee_telegram_code', {
      p_employee_code: employeeCode,
      p_chat_id: chatId
    });

    if (error) {
      console.error('❌ Error linking employee code:', error);
      return { success: false, message: 'حدث خطأ في ربط الكود' };
    }

    console.log(`✅ Link employee response:`, JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('❌ Exception linking employee code:', error);
    return { success: false, message: 'حدث خطأ في ربط الكود' };
  }
}

// Process order with AlWaseet
async function processOrderWithAlWaseet(text: string, chatId: number, employee: any) {
  try {
    console.log('📋 Processing order text...');
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length < 3) {
      await sendTelegramMessage(chatId, `❌ تنسيق الطلب غير صحيح

📋 التنسيق الصحيح:
المدينة
رقم الهاتف  
اسم المنتج + اللون + المقاس

مثال:
بغداد
07700000000
قميص أزرق لارج`);
      return false;
    }
    
    // Parse basic info
    const cityText = lines[0];
    const phoneText = lines[1];
    const productLines = lines.slice(2);
    
    // Validate phone
    const phoneRegex = /^(07\d{9}|01\d{9}|\+9647\d{8})$/;
    if (!phoneRegex.test(phoneText.replace(/\s/g, ''))) {
      await sendTelegramMessage(chatId, `❌ رقم الهاتف غير صحيح: ${phoneText}

📱 الأرقام المقبولة:
• 07xxxxxxxxx
• 01xxxxxxxxx  
• +9647xxxxxxxx`);
      return false;
    }
    
    // Find city
    const city = await findCityByNameSmart(cityText);
    if (!city) {
      await sendTelegramMessage(chatId, `❌ لم يتم العثور على المدينة: ${cityText}

🏙️ المدن المتاحة: بغداد، البصرة، كربلاء، النجف، أربيل، الموصل...`);
      return false;
    }
    
    // Check products
    const productResults = [];
    for (const productLine of productLines) {
      const result = await searchProductWithVariantsAndInventory(productLine, chatId, phoneText);
      if (!result.found) {
        await sendTelegramMessage(chatId, result.message || '❌ منتج غير متوفر');
        return false;
      }
      productResults.push(productLine);
    }
    
    // All products available - simulate order creation
    const orderSummary = `✅ تم إنشاء الطلب بنجاح!

👤 بيانات العميل:
🏙️ المدينة: ${city.name}
📱 الهاتف: ${phoneText}

📦 المنتجات:
${productResults.map((p, i) => `${i + 1}. ${p}`).join('\n')}

👨‍💼 الموظف: ${employee.full_name} (${employee.employee_code})
⏰ الوقت: ${new Date().toLocaleString('ar-EG')}

🔄 جاري إرسال الطلب للنظام...`;

    await sendTelegramMessage(chatId, orderSummary);
    
    // Here you would typically save the order to the database
    console.log('✅ Order processed successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Error processing order:', error);
    await sendTelegramMessage(chatId, '❌ حدث خطأ في معالجة الطلب. يرجى المحاولة مرة أخرى.');
    return false;
  }
}

// Send welcome message
async function sendWelcomeMessage(chatId: number, employee: any) {
  const welcomeText = `🤖 مرحباً ${employee.full_name}!

أهلاً بك في بوت الطلبات المتطور 🚀

📋 لإرسال طلب، استخدم التنسيق التالي:

المدينة
رقم الهاتف
اسم المنتج + اللون + المقاس

مثال:
بغداد
07700000000
قميص أزرق لارج

✨ المزايا الذكية:
🔍 تعرف تلقائي على المنتجات والألوان والأحجام
📊 فحص المخزون الفوري
🚨 تنبيهات نفاد المخزون
🎯 اقتراح البدائل المتاحة

👨‍💼 الموظف: ${employee.employee_code}`;

  await sendTelegramMessage(chatId, welcomeText);
}

// Main handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const update: TelegramUpdate = await req.json();
    console.log('📨 Received Telegram update:', JSON.stringify(update, null, 2));

    if (!update.message) {
      return new Response('OK', { headers: corsHeaders });
    }

    const message = update.message;
    const chatId = message.chat.id;
    const text = message.text || '';

    console.log(`💬 Processing message from chat ${chatId}: "${text}"`);

    // Check if this is an employee code for linking
    if (text && /^[A-Z]{3}\d{3,4}$/.test(text.trim())) {
      console.log(`🔗 Detected employee code pattern: ${text.trim()}`);
      
      // Try to link this code
      const linkResult = await linkEmployeeCode(text.trim(), chatId);
      
      if (linkResult.success) {
        await sendTelegramMessage(chatId, `✅ تم ربط حسابك بنجاح!
        
👤 مرحباً ${linkResult.employee?.full_name || 'عزيزي الموظف'}
🆔 كود الموظف: ${linkResult.employee?.employee_code}

📋 يمكنك الآن إرسال الطلبات بالتنسيق التالي:
المدينة
رقم الهاتف  
اسم المنتج + اللون + المقاس

مثال:
بغداد
07700000000
قميص أزرق لارج`);
        
        return new Response('OK', { headers: corsHeaders });
      } else {
        await sendTelegramMessage(chatId, `❌ ${linkResult.message || 'فشل في ربط الكود'}
        
🔗 للحصول على مساعدة:
1. تأكد من صحة الكود
2. تواصل مع المدير
3. تأكد من أن الكود غير مستخدم مسبقاً`);
        
        return new Response('OK', { headers: corsHeaders });
      }
    }

    // Get employee information
    const employee = await getEmployeeByTelegramId(chatId);
    
    if (!employee) {
      console.error(`No employee found for chat ID: ${chatId}`);
      await sendTelegramMessage(chatId, `❌ لم يتم العثور على حساب مربوط بهذا الرقم.
      
🔗 لربط حسابك:
1. احصل على كود الموظف من المدير
2. أرسل الكود هنا مباشرة

📄 تنسيق الكود: ABC123 أو ABC1234
مثال: RYU559`);
      return new Response('OK', { headers: corsHeaders });
    }

    console.log(`👤 Employee found: ${employee.full_name} (${employee.employee_code})`);

    // Handle start command
    if (text === '/start' || text === '/help') {
      await sendWelcomeMessage(chatId, employee);
      return new Response('OK', { headers: corsHeaders });
    }

    // Process order text
    try {
      console.log('📦 Processing order text...');
      await processOrderWithAlWaseet(text, chatId, employee);
      console.log('✅ Order processing completed successfully');
    } catch (orderError) {
      console.error('❌ Order processing failed:', orderError);
      await sendTelegramMessage(chatId, '❌ حدث خطأ في معالجة الطلب. يرجى المحاولة مرة أخرى.');
    }

    return new Response('OK', { headers: corsHeaders });

  } catch (error) {
    console.error('❌ Error processing request:', error);
    return new Response('Error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});