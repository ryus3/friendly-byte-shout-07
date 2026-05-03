// Telegram Bot Edge Function - REPLACEMENT & RETURN SUPPORT 2025-10-09
const BOT_VERSION = "v2025-10-09-REPLACEMENT-RETURN-SECURED";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';
import { detectOrderType, parseReplacementOrder, parseReturnOrder } from './replacement-parser.ts';
import { 
  validateCustomerName, 
  validatePhoneNumber, 
  validateAddress, 
  validateOrderItems,
  sanitizeText,
  checkRateLimit,
  convertArabicToEnglishNumbers,
  parseArabicNumberWords
} from './validation.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ==========================================
// Local Cities/Regions Cache - 30 DAYS TTL
// ==========================================
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
let citiesCache: Array<{ id: number; name: string; normalized: string; alwaseet_id: number }> = [];
let regionsCache: Array<{ id: number; city_id: number; name: string; normalized: string; alwaseet_id: number }> = [];
let cityAliasesCache: Array<{ city_id: number; alias: string; normalized: string; confidence: number }> = [];
let lastCacheUpdate: number | null = null;

// 🔑 Partner-specific external ID maps (filled per active partner)
let cityExternalIdMap: Map<number, number | string> = new Map();   // city_id -> partner external_id
let regionExternalIdMap: Map<number, number | string> = new Map(); // region_id -> partner external_id
let currentDeliveryPartner: string = 'alwaseet';

function getCityExternalId(cityId: number, fallback?: number | string): number | string | undefined {
  return cityExternalIdMap.get(cityId) ?? fallback;
}
function getRegionExternalId(regionId: number, fallback?: number | string): number | string | undefined {
  return regionExternalIdMap.get(regionId) ?? fallback;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to check if text is an employee code (3 letters + 3 digits)
function isEmployeeCode(text: string): boolean {
  return /^[A-Z]{3}\d{3}$/.test(text.trim().toUpperCase());
}

// Welcome message - will be customized based on employee link status
function getWelcomeMessage(isLinked: boolean, employeeCode?: string): string {
  const linkStatus = isLinked 
    ? `✅ حسابك مربوط مسبقاً\n👤 الرمز: ${employeeCode}\n\n`
    : `⚠️ لم يتم ربط حسابك بعد\n\n🔑 لربط حسابك، أرسل رمز الموظف الخاص بك\n(مثال: ABO123)\n\n`;
  
  return `🤖 مرحباً بك في بوت RYUS للطلبات الذكية!

${linkStatus}✨ يمكنني فهم طلباتك بطريقة ذكية وسهلة

مثال:

احمد
07712345678
برشلونة ازرق سمول
20 الف
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
}

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

// Extract all phone numbers from text (primary and secondary)
function extractAllPhonesFromText(text: string): { 
  primary: string; 
  secondary: string | null 
} {
  // تحويل الأرقام العربية إلى إنجليزية أولاً
  const normalizedText = convertArabicToEnglishNumbers(text);
  
  const phonePattern = /\b(07[3-9]\d{8}|00964[37]\d{8}|964[37]\d{8})\b/g;
  const matches = [...normalizedText.matchAll(phonePattern)];
  
  const phones: string[] = [];
  matches.forEach(match => {
    let phone = match[0];
    // Normalize to Iraqi format
    phone = phone.replace(/^(00964|964)/, '0');
    if (phone.startsWith('07') && phone.length === 11) {
      phones.push(phone);
    }
  });
  
  return {
    primary: phones[0] || '',
    secondary: phones[1] || null
  };
}

// Legacy function for backward compatibility
function extractPhoneFromText(text: string): string {
  return extractAllPhonesFromText(text).primary;
}

// ==========================================
// 🚀 Levenshtein Distance - قياس التشابه بين نصين
// ==========================================
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

// ==========================================
// 🎯 Calculate Similarity - حساب نسبة التشابه (0-100%)
// ==========================================
function calculateSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 100;
  
  const distance = levenshteinDistance(str1, str2);
  return ((maxLen - distance) / maxLen) * 100;
}

// ==========================================
// ✨ Text Normalization - تطبيع متقدم للنصوص العربية
// ==========================================
function normalizeArabicText(text: string): string {
  try {
    let normalized = text.toLowerCase().trim();
    
    // ✅ إزالة "ال" و "أل" من بداية كل كلمة
    normalized = normalized
      .split(/\s+/)
      .map(word => {
        if (word.startsWith('ال')) return word.substring(2);
        if (word.startsWith('أل')) return word.substring(2);
        return word;
      })
      .join(' ');
    
    // ✅ توحيد جميع الأحرف المتشابهة
    normalized = normalized
      .replace(/[أإآا]/g, 'ا')     // همزات → ا
      .replace(/ة/g, 'ه')           // ة → ه  
      .replace(/ى/g, 'ي')           // ى → ي
      .replace(/[ؤئء]/g, '')        // إزالة همزات متوسطة
      .replace(/[،.؛:\-_]/g, ' ');  // إزالة علامات
    
    // ✅ توحيد المسافات وإزالة الأحرف غير العربية/الأرقام/الإنجليزية
    normalized = normalized
      .replace(/[^\u0600-\u06FF\s0-9a-zA-Z]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
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
// 🚀 المرحلة 3: Cache Auto-Refresh للبوت
// ==========================================

// ⏰ مدة صلاحية الـ cache: 30 يوم
const CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 يوم بالميلي ثانية
let lastCacheLoadTime = 0;

// دالة فحص إذا كان الـ cache يحتاج تحديث
function shouldRefreshCache(): boolean {
  if (lastCacheLoadTime === 0) return true; // لم يتم التحميل بعد
  
  const age = Date.now() - lastCacheLoadTime;
  const needsRefresh = age > CACHE_MAX_AGE;
  
  if (needsRefresh) {
    console.log(`⏰ مرت ${Math.round(age / (24 * 60 * 60 * 1000))} يوم - يحتاج تحديث`);
  }
  
  return needsRefresh;
}

// ==========================================
// Load Cities/Regions Cache
// ==========================================
async function loadCitiesRegionsCache(): Promise<boolean> {
  try {
    console.log(`🔄 تحميل cache المدن والمناطق - إصدار ${BOT_VERSION}`);
    
    // Get delivery partner setting
    const deliveryPartner = await getDeliveryPartnerSetting();
    console.log(`📦 شركة التوصيل المختارة: ${deliveryPartner}`);
    
    // Load cities from UNIFIED cities_master table
    const { data: cities, error: citiesError } = await supabase
      .from('cities_master')
      .select('id, name, alwaseet_id')
      .eq('is_active', true)
      .order('name')
      .limit(100);
    
    if (citiesError) throw citiesError;
    
    // ==========================================
    // CRITICAL FIX: Manual Pagination Loop
    // ==========================================
    console.log('📥 بدء تحميل المناطق باستخدام pagination يدوي...');
    let allRegions: any[] = [];
    let page = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const startRange = page * PAGE_SIZE;
      const endRange = startRange + PAGE_SIZE - 1;
      
      console.log(`📦 دفعة ${page + 1}: جلب المناطق من ${startRange} إلى ${endRange}...`);
      
      const { data: regionsBatch, error: regionsError } = await supabase
        .from('regions_master')
        .select('id, city_id, name, alwaseet_id')
        .eq('is_active', true)
        .range(startRange, endRange)
        .order('name');
      
      if (regionsError) {
        console.error(`❌ خطأ في تحميل دفعة ${page + 1}:`, regionsError);
        throw regionsError;
      }
      
      const batchSize = regionsBatch?.length || 0;
      allRegions = allRegions.concat(regionsBatch || []);
      
      console.log(`✅ دفعة ${page + 1}: تم تحميل ${batchSize} منطقة (الإجمالي حتى الآن: ${allRegions.length})`);
      
      // Check if we got less than PAGE_SIZE (means we're at the end)
      if (batchSize < PAGE_SIZE) {
        hasMore = false;
        console.log(`🏁 اكتمل التحميل - آخر دفعة تحتوي على ${batchSize} منطقة فقط`);
      }
      
      page++;
      
      // Safety limit to prevent infinite loops
      if (page > 20) {
        console.error('⚠️ تحذير: تم الوصول إلى الحد الأقصى للدفعات (20)');
        hasMore = false;
      }
    }
    
    const regions = allRegions;
    
    
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

    // 🔑 تحميل خرائط المعرّفات الخارجية حسب شركة التوصيل المختارة
    currentDeliveryPartner = deliveryPartner;
    cityExternalIdMap = new Map();
    regionExternalIdMap = new Map();
    try {
      const { data: cityMaps } = await supabase
        .from('city_delivery_mappings')
        .select('city_id, external_id')
        .eq('delivery_partner', deliveryPartner)
        .eq('is_active', true);
      (cityMaps || []).forEach((m: any) => {
        if (m.city_id != null && m.external_id != null) cityExternalIdMap.set(m.city_id, m.external_id);
      });

      // المناطق: pagination لأن العدد كبير
      let rPage = 0;
      while (true) {
        const start = rPage * 1000;
        const { data: regionMaps } = await supabase
          .from('region_delivery_mappings')
          .select('region_id, external_id')
          .eq('delivery_partner', deliveryPartner)
          .eq('is_active', true)
          .range(start, start + 999);
        (regionMaps || []).forEach((m: any) => {
          if (m.region_id != null && m.external_id != null) regionExternalIdMap.set(m.region_id, m.external_id);
        });
        if (!regionMaps || regionMaps.length < 1000) break;
        rPage++;
        if (rPage > 20) break;
      }
      console.log(`🔑 خرائط ${deliveryPartner}: ${cityExternalIdMap.size} مدينة، ${regionExternalIdMap.size} منطقة`);
    } catch (mapErr) {
      console.warn('⚠️ فشل تحميل خرائط الشركاء، fallback على alwaseet_id:', mapErr);
    }

    
    // ==========================================
    // CRITICAL VALIDATION
    // ==========================================
    const totalRegions = regionsCache.length;
    console.log(`✅ تم تحميل ${cities?.length || 0} مدينة و ${totalRegions} منطقة و ${cityAliasesCache.length} اسم بديل لشركة ${deliveryPartner}`);
    
    // تحديث وقت آخر تحميل
    lastCacheLoadTime = Date.now();
    console.log('Cache TTL: 30 days - ' + Math.round(CACHE_MAX_AGE / (24 * 60 * 60 * 1000)) + ' days');
    
    if (totalRegions < 6000) {
      console.error('Critical error: Loaded regions (' + totalRegions + ') much less than expected (6191 regions)!');
      console.error('Required: Verify pagination loop works correctly');
    } else {
      console.log('Success! All expected regions loaded (' + totalRegions + ' >= 6000)');
    }
    
    console.log('Load version: ' + BOT_VERSION);
    
    console.log(`✅ تم تحميل ${citiesCache.length} مدينة و ${regionsCache.length} منطقة و ${cityAliasesCache.length} اسم بديل لشركة ${deliveryPartner}`);
    console.log(`📅 Cache TTL: 30 أيام (${CACHE_TTL / (24 * 60 * 60 * 1000)} يوم)`);
    console.log(`💾 الـ Cache سيبقى نشط حتى: ${new Date(lastCacheUpdate + CACHE_TTL).toLocaleDateString('ar-IQ')}`);
    console.log(`🔄 إصدار التحميل: ${BOT_VERSION}`);
    return true;
  } catch (error) {
    console.error('❌ فشل تحميل cache المدن والمناطق:', error);
    return false;
  }
}

// ==========================================
// Instance Warming - تحميل Cache عند بدء Edge Function
// ==========================================
async function warmupCache() {
  if (citiesCache.length === 0 || regionsCache.length === 0) {
    console.log('🔥 Instance Warming: تحميل cache المدن والمناطق...');
    const loaded = await loadCitiesRegionsCache();
    if (loaded) {
      console.log('✅ Instance Warming مكتمل - Cache جاهز');
    } else {
      console.warn('⚠️ Instance Warming فشل - سيتم المحاولة لاحقاً');
    }
  } else {
    console.log('✅ Cache موجود مسبقاً - لا حاجة للتحميل');
  }
}

// ==========================================
// Search City Locally - مع استخراج السطر الذي يحتوي على المدينة
// ==========================================
function searchCityLocal(text: string): { cityId: number; cityName: string; confidence: number; cityLine: string; externalId?: number } | null {
  try {
    // تقسيم النص إلى أسطر
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // البحث في كل سطر عن المدينة
    for (const line of lines) {
      const normalized = normalizeArabicText(line);
      
      // استخراج الكلمة الأولى فقط من السطر
      const firstWord = line.trim().split(/\s+/)[0];
      const normalizedFirstWord = normalizeArabicText(firstWord);
      
      // Direct match in cities - باستخدام الكلمة الأولى فقط
      const exactCity = citiesCache.find(c => c.normalized === normalizedFirstWord || normalizedFirstWord.includes(c.normalized));
      if (exactCity) {
        console.log(`✅ تم العثور على المدينة "${exactCity.name}" من الكلمة الأولى في السطر: "${line}"`);
        return { cityId: exactCity.id, cityName: exactCity.name, confidence: 1.0, cityLine: line };
      }
      
      // Starts with match
      const startsWithCity = citiesCache.find(c => c.normalized.startsWith(normalizedFirstWord) || normalizedFirstWord.startsWith(c.normalized));
      if (startsWithCity) {
        console.log(`✅ تم العثور على المدينة "${startsWithCity.name}" من الكلمة الأولى في السطر: "${line}"`);
        return { cityId: startsWithCity.id, cityName: startsWithCity.name, confidence: 0.9, cityLine: line };
      }
      
      // Check aliases - باستخدام الكلمة الأولى فقط
      const alias = cityAliasesCache.find(a => a.normalized === normalizedFirstWord || normalizedFirstWord.includes(a.normalized));
      if (alias) {
        const city = citiesCache.find(c => c.id === alias.city_id);
        if (city) {
          console.log(`✅ تم العثور على المدينة "${city.name}" عبر المرادف من الكلمة الأولى في السطر: "${line}"`);
          return { cityId: city.id, cityName: city.name, externalId: city.alwaseet_id, confidence: alias.confidence, cityLine: line };
        }
      }
      
      // Contains match
      const containsCity = citiesCache.find(c => c.normalized.includes(normalizedFirstWord) || normalizedFirstWord.includes(c.normalized));
      if (containsCity) {
        console.log(`✅ تم العثور على المدينة "${containsCity.name}" من الكلمة الأولى في السطر: "${line}"`);
        return { cityId: containsCity.id, cityName: containsCity.name, externalId: containsCity.alwaseet_id, confidence: 0.7, cityLine: line };
      }
    }
    
    return null;
  } catch (error) {
    console.error('❌ خطأ في البحث المحلي عن المدينة:', error);
    return null;
  }
}

// ==========================================
// Extract Location from Text - حذف الهواتف والمنتجات
// ==========================================
function extractLocationFromText(text: string): string {
  // إزالة أرقام الهواتف (07XXXXXXXXX أو 009647XXXXXXXXX أو +9647XXXXXXXXX)
  let cleaned = text.replace(/(\+?964|00964)?0?7[0-9]{9}/g, '');
  
  // إزالة كلمات المنتجات الشائعة
  const productKeywords = [
    'برشلونة', 'برشلونه', 'ريال', 'مدريد', 'ارجنتين', 'ريال مدريد',
    'قميص', 'تيشرت', 'تيشيرت', 'بلوزة', 'بنطلون', 'شورت',
    'احمر', 'ازرق', 'اخضر', 'اصفر', 'ابيض', 'اسود', 'سمائي', 'وردي',
    'سمول', 'ميديم', 'لارج', 'اكس', 'دبل', 'xl', 'xxl', 'l', 'm', 's', 'xs'
  ];
  
  for (const keyword of productKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    cleaned = cleaned.replace(regex, '');
  }
  
  // إزالة المسافات الزائدة
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

// ==========================================
// Remove City Name from Line - للحصول على المنطقة فقط
// ==========================================
function removeCityFromLine(cityLine: string, cityName: string): string {
  try {
    let cleaned = cityLine;
    
    // ✅ 1. إزالة اسم المدينة من البداية أولاً (مع المسافات)
    const cityNameEscaped = cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cityAtStartPattern = new RegExp(`^${cityNameEscaped}[\\s,،-]*`, 'gi');
    cleaned = cleaned.replace(cityAtStartPattern, '').trim();
    
    // إذا لم تُزل من البداية، حاول إزالتها من أي مكان
    if (cleaned === cityLine) {
      const cityAnywherePattern = new RegExp(`[\\s,،-]*${cityNameEscaped}[\\s,،-]*`, 'gi');
      cleaned = cleaned.replace(cityAnywherePattern, ' ').trim();
    }
    
    // ✅ 2. البحث عن المدينة في citiesCache للحصول على city_id
    const cityObj = citiesCache.find(c => 
      normalizeArabicText(c.name) === normalizeArabicText(cityName)
    );
    
    if (cityObj) {
      // ✅ 3. إزالة جميع المرادفات لهذه المدينة
      const cityAliases = cityAliasesCache.filter(a => a.city_id === cityObj.id);
      
      cityAliases.forEach(alias => {
        const aliasEscaped = alias.alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const aliasPattern = new RegExp(`[\\s,،-]*${aliasEscaped}[\\s,،-]*`, 'gi');
        cleaned = cleaned.replace(aliasPattern, ' ');
      });
      
      console.log(`🔍 تم إزالة ${cityAliases.length} مرادف للمدينة ${cityName}`);
    }
    
    // ✅ 4. تنظيف شامل للمسافات والفواصل
    cleaned = cleaned
      .replace(/\s+/g, ' ')                    // مسافات متعددة → مسافة واحدة
      .replace(/^[\s,،-]+|[\s,،-]+$/g, '')     // إزالة من البداية والنهاية
      .trim();
    
    console.log(`🧹 النص المُنظف للبحث عن المنطقة: "${cityLine}" → "${cleaned}"`);
    
    // إذا كان الناتج فارغاً، نرجع النص الأصلي كـ fallback
    return cleaned || cityLine;
  } catch (error) {
    console.error('❌ خطأ في removeCityFromLine:', error);
    return cityLine;
  }
}

// ==========================================
// 🚀 Search Regions Locally - نظام بحث ذكي مع Fuzzy Matching
// ==========================================
function searchRegionsLocal(cityId: number, text: string): Array<{ regionId: number; regionName: string; confidence: number }> {
  try {
    const normalized = normalizeArabicText(text);
    const cityRegions = regionsCache.filter(r => r.city_id === cityId);
    
    console.log(`🔍 بحث محلي عن منطقة: "${text}" → منظف: "${normalized}" في مدينة ${cityId}`);
    
    const matches: Array<{ regionId: number; regionName: string; confidence: number; externalId?: string | number }> = [];
    const words = normalized.split(/\s+/).filter(w => w.length > 1);
    console.log(`📝 الكلمات المستخرجة للبحث:`, words);
    
    // 🎯 المستوى 0: تطابق كامل للنص كاملاً (أولوية قصوى)
    for (const region of cityRegions) {
      const regionNormalized = region.normalized;
      
      // تطابق كامل تام - 100%
      if (regionNormalized === normalized || region.name.toLowerCase() === text.toLowerCase()) {
        matches.push({
          regionId: region.id,
          regionName: region.name,
          externalId: region.alwaseet_id,
          confidence: 1.0
        });
        console.log(`✅ تطابق كامل 100%: "${text}" = "${region.name}"`);
      }
      // تطابق جزئي قوي للنص الكامل - 98%
      else if (regionNormalized.includes(normalized) && normalized.split(/\s+/).length > 1) {
        matches.push({
          regionId: region.id,
          regionName: region.name,
          externalId: region.alwaseet_id,
          confidence: 0.98
        });
        console.log(`✅ تطابق جزئي قوي 98%: "${text}" في "${region.name}"`);
      }
    }
    
    // إذا وجدنا تطابق كامل أو قوي، نحتفظ به لكن نكمل البحث
    if (matches.length > 0) {
      console.log(`✅ وجدنا ${matches.length} تطابق كامل/قوي - نكمل البحث عن خيارات متشابهة`);
      // لا نرجع هنا - نكمل البحث في المستويات التالية
    }
    
    // 🎯 المستوى 1: تركيبات من كلمتين أو أكثر (أولوية عالية)
    if (words.length >= 2) {
      for (let len = words.length; len >= 2; len--) {
        for (let i = 0; i <= words.length - len; i++) {
          const combination = words.slice(i, i + len).join(' ');
          
          for (const region of cityRegions) {
            const regionTokens = region.normalized.split(/\s+/);
            
            // البحث عن التركيب في المنطقة
            for (let j = 0; j <= regionTokens.length - len; j++) {
              const regionCombination = regionTokens.slice(j, j + len).join(' ');
              
              if (combination === regionCombination) {
                const baseConfidence = 0.92 + (len * 0.02); // كلما أطول التركيب، أعلى الثقة
                matches.push({
                  regionId: region.id,
                  regionName: region.name,
                  externalId: region.alwaseet_id,
                  confidence: Math.min(baseConfidence, 0.97)
                });
                console.log(`✅ تركيب ${len} كلمات: "${combination}" في "${region.name}" (${baseConfidence})`);
              }
            }
          }
        }
      }
    }
    
    // إذا وجدنا تطابقات من تركيبات، نفضلها على الكلمات المنفردة
    if (matches.length > 0) {
      matches.sort((a, b) => b.confidence - a.confidence);
      console.log(`🏆 وجدنا ${matches.length} تطابق من تركيبات - عرضها أولاً`);
      
      // نكمل البحث عن كلمات منفردة لكن بثقة أقل
    }
    
    // 🎯 المستوى 2: البحث عن كلمات منفردة (ثقة أقل)
    for (const region of cityRegions) {
      // تجنب التكرار
      if (matches.some(m => m.regionId === region.id)) continue;
      
      const regionTokens = region.normalized.split(/\s+/);
      let bestScore = 0;
      
      for (const word of words) {
        if (word.length < 2) continue;
        
        for (const token of regionTokens) {
          // مطابقة كاملة - 85% (أقل من التركيبات)
          if (token === word) {
            bestScore = Math.max(bestScore, 85);
          }
          // مطابقة جزئية - 80%
          else if (token.includes(word) || word.includes(token)) {
            bestScore = Math.max(bestScore, 80);
          }
          // البحث في بداية الكلمة - 75%
          else if (token.startsWith(word) || word.startsWith(token)) {
            bestScore = Math.max(bestScore, 75);
          }
          // Fuzzy Matching - 70-75%
          else {
            const similarity = calculateSimilarity(word, token);
            if (similarity >= 70) {
              bestScore = Math.max(bestScore, similarity);
            }
          }
        }
      }
      
      // إضافة فقط إذا كانت الثقة > 70%
      if (bestScore >= 70) {
        matches.push({
          regionId: region.id,
          regionName: region.name,
          externalId: region.alwaseet_id,
          confidence: bestScore / 100
        });
      }
    }
    
    // إزالة التكرارات (نفس region_id)
    const uniqueMatches = [];
    const seenIds = new Set();
    for (const match of matches) {
      if (!seenIds.has(match.regionId)) {
        seenIds.add(match.regionId);
        uniqueMatches.push(match);
      }
    }
    
    // ترتيب نهائي حسب الثقة
    uniqueMatches.sort((a, b) => b.confidence - a.confidence);
    
    console.log(`✅ إجمالي المطابقات: ${uniqueMatches.length} (بعد إزالة التكرار)`);
    if (uniqueMatches.length > 0) {
      const topMatches = uniqueMatches.slice(0, 15).map(m => 
        `${m.regionName} (${Math.round(m.confidence * 100)}%)`
      );
      console.log(`🏆 أفضل 15 نتيجة:`, topMatches);
    }
    
    return uniqueMatches;
  } catch (error) {
    console.error('❌ خطأ في البحث المحلي:', error);
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
        .limit(50);
      
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

    // عرض جميع المنتجات (حد أقصى 50)
    const products = Array.from(uniqueProducts.values()).slice(0, 50);
    const buttons = products.map((p: any) => [{
      text: `🛍️ ${p.name}`,
      callback_data: `select_product_${p.id}`
    }]);

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
    // ==========================================
    // 🔒 Security: Telegram Webhook Token Validation
    // ==========================================
    const secretToken = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
    
    // ==========================================
    // Security: Request Size Validation
    // ==========================================
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 100000) {
      console.error('❌ Request too large:', contentLength);
      return new Response(JSON.stringify({ error: 'Request too large' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==========================================
    // Instance Warming: تحميل Cache عند أول request
    // ==========================================
    await warmupCache();
    
    const botToken = await getBotToken();
    if (!botToken) {
      console.error('❌ لم يتم العثور على رمز البوت');
      return new Response(JSON.stringify({ error: 'Bot token not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate webhook secret token if provided (recommended security measure)
    if (secretToken && secretToken !== botToken) {
      console.error('❌ Invalid webhook secret token - potential attack attempt');
      return new Response(JSON.stringify({ error: 'Unauthorized webhook request' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const update = await req.json();
    
    // ==========================================
    // Security: Input Validation
    // ==========================================
    if (!update || typeof update !== 'object') {
      console.error('❌ Invalid update format');
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    console.log('📨 تحديث تليغرام:', JSON.stringify(update, null, 2));

    // Handle different types of updates
    if (update.message) {
      const { message } = update;
      const chatId = message.chat.id;
      const userId = message.from?.id;
      let text = message.text?.trim() || '';

      // ==========================================
      // Security: Rate Limiting
      // ==========================================
      if (!checkRateLimit(chatId, 30, 60000)) {
        console.warn(`⚠️ Rate limit exceeded for chat ${chatId}`);
        await sendTelegramMessage(chatId, '⚠️ عدد كبير من الرسائل. يرجى الانتظار قليلاً.', undefined, botToken);
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ==========================================
      // Security: Sanitize and Validate Input
      // ==========================================
      if (text.length > 5000) {
        console.warn(`⚠️ Message too long from ${userId}: ${text.length} characters`);
        await sendTelegramMessage(chatId, '⚠️ الرسالة طويلة جداً. الحد الأقصى 5000 حرف.', undefined, botToken);
        return new Response(JSON.stringify({ error: 'Message too long' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Sanitize text to remove dangerous characters
      text = sanitizeText(text);

      console.log(`💬 رسالة جديدة من ${userId}: "${text.substring(0, 100)}"`);

      // Get employee data once (needed for all operations)
      const { data: employeeData, error: employeeError } = await supabase
        .from('employee_telegram_codes')
        .select('telegram_code, user_id, telegram_chat_id')
        .eq('telegram_chat_id', chatId)
        .eq('is_active', true)
        .maybeSingle();

      const employeeId = employeeData?.user_id || null;
      const isLinked = !!employeeData?.telegram_chat_id;
      const employeeCode = employeeData?.telegram_code || '';

      // Handle /start command
      if (text === '/start') {
        const welcomeMessage = getWelcomeMessage(isLinked, employeeCode);
        await sendTelegramMessage(chatId, welcomeMessage, INVENTORY_KEYBOARD, botToken);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ==========================================
      // EMPLOYEE CODE VERIFICATION (MUST BE BEFORE OTHER COMMANDS)
      // ==========================================
      if (isEmployeeCode(text)) {
        console.log(`🔐 محاولة ربط رمز موظف: ${text}`);
        
        const code = text.trim().toUpperCase();
        
        // Check if already linked
        if (employeeData?.telegram_chat_id) {
          await sendTelegramMessage(
            chatId,
            `✅ حسابك مربوط مسبقاً!\n\n👤 الرمز: ${employeeData.telegram_code}\n\nيمكنك الآن استخدام البوت لإنشاء الطلبات.`,
            INVENTORY_KEYBOARD,
            botToken
          );
          return new Response(JSON.stringify({ success: true, already_linked: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Call link function
        const { data: linkResult, error: linkError } = await supabase
          .rpc('link_employee_telegram_code', {
            p_employee_code: code,
            p_chat_id: chatId
          });
        
        if (linkError || !linkResult?.success) {
          console.error('❌ فشل ربط الرمز:', linkError || linkResult);
          await sendTelegramMessage(
            chatId,
            `❌ ${linkResult?.error || 'رمز الموظف غير صحيح أو غير نشط'}\n\nيرجى التواصل مع المدير للحصول على رمز صحيح.`,
            undefined,
            botToken
          );
          return new Response(JSON.stringify({ error: 'invalid_code' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Successfully linked!
        await sendTelegramMessage(
          chatId,
          `✅ تم ربط حسابك بنجاح!\n\n👤 مرحباً ${linkResult.employee_name}\n🔑 الرمز: ${code}\n\nيمكنك الآن استخدام البوت لإنشاء الطلبات والاستعلام عن المخزون.`,
          INVENTORY_KEYBOARD,
          botToken
        );
        
        return new Response(JSON.stringify({ success: true, linked: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ==========================================
      // Handle Inventory Commands
      // ==========================================
      
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

        // ==========================================
        // تطبيع النص: تحويل الأرقام العربية والكلمات الرقمية
        // ==========================================
        text = parseArabicNumberWords(text);
        console.log('📝 النص بعد تحويل الكلمات الرقمية:', text);

        // ==========================================
        // كشف نوع الطلب: عادي، استبدال، ترجيع
        // ==========================================
        const detectOrderType = (text: string): 'replacement' | 'return' | 'regular' => {
          const replacementRegex = /#(استبدال|استبذال|أستبدال|تبديل)/;
          const returnRegex = /#(ارجاع|ترجيع|استرجاع|إرجاع)/;
          
          if (replacementRegex.test(text)) return 'replacement';
          if (returnRegex.test(text)) return 'return';
          return 'regular';
        };

        const orderType = detectOrderType(text);
        console.log('🔍 نوع الطلب المكتشف:', orderType);
        
        // ==========================================
        // استخراج أرقام الهاتف (الأساسي والثانوي)
        // ==========================================
        const phoneNumbers = extractAllPhonesFromText(text);
        console.log('📞 أرقام الهاتف المستخرجة:', phoneNumbers);

        // معالجة طلبات الاستبدال
        if (orderType === 'replacement') {
          const replacementData = parseReplacementOrder(text);
          if (replacementData) {
            console.log('✅ تم تحليل طلب استبدال:', replacementData);
            
            // إنشاء UUID مشترك لربط طلبي الاستبدال
            const pairId = crypto.randomUUID();
            
            // إنشاء طلب AI للمنتج الخارج (replacement_outgoing)
            const { data: outgoingAiOrder, error: outgoingError } = await supabase
              .from('ai_orders')
              .insert({
                source: 'telegram',
                telegram_chat_id: chatId,
                original_text: text,
                customer_name: replacementData.customerInfo.name,
                customer_phone: replacementData.customerInfo.phone || phoneNumbers.primary,
                customer_phone2: phoneNumbers.secondary,
                customer_city: replacementData.customerInfo.city,
                customer_address: replacementData.customerInfo.address,
                delivery_fee: replacementData.deliveryFee,
                order_type: 'replacement_outgoing',
                replacement_pair_id: pairId,
                merchant_pays_delivery: true,
                items: [{
                  product_name: replacementData.outgoingProduct.name,
                  color_name: replacementData.outgoingProduct.color,
                  size_name: replacementData.outgoingProduct.size,
                  quantity: 1
                }],
                total_amount: 0,
                status: 'pending',
                created_by: employeeId || employeeCode
              })
              .select()
              .single();
            
            if (outgoingError) {
              console.error('❌ خطأ في إنشاء طلب AI للمنتج الخارج:', outgoingError);
              await sendTelegramMessage(chatId, '❌ حدث خطأ في إنشاء طلب الاستبدال (المنتج الخارج)', undefined, botToken);
              return new Response(JSON.stringify({ error: outgoingError.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
            
            // إنشاء طلب AI للمنتج الداخل (replacement_incoming)
            const { data: incomingAiOrder, error: incomingError } = await supabase
              .from('ai_orders')
              .insert({
                source: 'telegram',
                telegram_chat_id: chatId,
                original_text: text,
                customer_name: replacementData.customerInfo.name,
                customer_phone: replacementData.customerInfo.phone || phoneNumbers.primary,
                customer_phone2: phoneNumbers.secondary,
                customer_city: replacementData.customerInfo.city,
                customer_address: replacementData.customerInfo.address,
                delivery_fee: 0,
                order_type: 'replacement_incoming',
                replacement_pair_id: pairId,
                merchant_pays_delivery: false,
                items: [{
                  product_name: replacementData.incomingProduct.name,
                  color_name: replacementData.incomingProduct.color,
                  size_name: replacementData.incomingProduct.size,
                  quantity: 1
                }],
                total_amount: 0,
                status: 'pending',
                created_by: employeeId || employeeCode
              })
              .select()
              .single();
            
            if (incomingError) {
              console.error('❌ خطأ في إنشاء طلب AI للمنتج الداخل:', incomingError);
              await sendTelegramMessage(chatId, '❌ حدث خطأ في إنشاء طلب الاستبدال (المنتج الداخل)', undefined, botToken);
              return new Response(JSON.stringify({ error: incomingError.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
            
            await sendTelegramMessage(
              chatId,
              `✅ تم إنشاء طلب استبدال بنجاح!\n\n` +
              `📤 المنتج الخارج: ${replacementData.outgoingProduct.name} ${replacementData.outgoingProduct.color || ''} ${replacementData.outgoingProduct.size || ''}\n` +
              `📥 المنتج الداخل: ${replacementData.incomingProduct.name} ${replacementData.incomingProduct.color || ''} ${replacementData.incomingProduct.size || ''}\n\n` +
              `👤 العميل: ${replacementData.customerInfo.name}\n` +
              `📞 الهاتف: ${replacementData.customerInfo.phone}\n` +
              `📍 المدينة: ${replacementData.customerInfo.city}\n\n` +
              `🆔 رقم الطلب: ${outgoingAiOrder.id}`,
              undefined,
              botToken
            );
            
            return new Response(JSON.stringify({ success: true, type: 'replacement', pair_id: pairId }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } else {
            await sendTelegramMessage(
              chatId,
              '❌ فشل تحليل طلب الاستبدال.\n\n' +
              'يرجى استخدام الصيغة التالية:\n' +
              'أحمد\n' +
              'بغداد - الكرادة\n' +
              '07728020021\n' +
              'برشلونة ازرق M #استبدال برشلونة ابيض S\n' +
              '5000',
              undefined,
              botToken
            );
            return new Response(JSON.stringify({ error: 'invalid_replacement_format' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }

        // معالجة طلبات الترجيع
        if (orderType === 'return') {
          const returnData = parseReturnOrder(text);
          if (returnData) {
            console.log('✅ تم تحليل طلب ترجيع:', returnData);
            
            // إنشاء طلب AI للترجيع
            const { data: returnAiOrder, error: returnError } = await supabase
              .from('ai_orders')
              .insert({
                source: 'telegram',
                telegram_chat_id: chatId,
                original_text: text,
                customer_name: returnData.customerInfo.name,
                customer_phone: returnData.customerInfo.phone || phoneNumbers.primary,
                customer_phone2: phoneNumbers.secondary,
                customer_city: returnData.customerInfo.city,
                customer_address: returnData.customerInfo.address,
                delivery_fee: 0,
                order_type: 'return_only',
                refund_amount: returnData.refundAmount,
                items: [{
                  product_name: returnData.product.name,
                  color_name: returnData.product.color,
                  size_name: returnData.product.size,
                  quantity: 1
                }],
                total_amount: returnData.refundAmount,
                status: 'pending',
                created_by: employeeId || employeeCode
              })
              .select()
              .single();
            
            if (returnError) {
              console.error('❌ خطأ في إنشاء طلب الترجيع:', returnError);
              await sendTelegramMessage(chatId, '❌ حدث خطأ في إنشاء طلب الترجيع', undefined, botToken);
              return new Response(JSON.stringify({ error: returnError.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
            
            await sendTelegramMessage(
              chatId,
              `✅ تم إنشاء طلب ترجيع بنجاح!\n\n` +
              `📦 المنتج: ${returnData.product.name} ${returnData.product.color || ''} ${returnData.product.size || ''}\n` +
              `💰 المبلغ المسترجع: ${returnData.refundAmount.toLocaleString()} د.ع\n\n` +
              `👤 العميل: ${returnData.customerInfo.name}\n` +
              `📞 الهاتف: ${returnData.customerInfo.phone}\n` +
              `📍 المدينة: ${returnData.customerInfo.city}\n\n` +
              `🆔 رقم الطلب: ${returnAiOrder.id}`,
              undefined,
              botToken
            );
            
            return new Response(JSON.stringify({ success: true, type: 'return', order_id: returnAiOrder.id }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } else {
            await sendTelegramMessage(
              chatId,
              '❌ فشل تحليل طلب الترجيع.\n\n' +
              'يرجى استخدام الصيغة التالية:\n' +
              'أحمد\n' +
              'بغداد - الكرادة\n' +
              '07728020021\n' +
              'برشلونة ازرق M #ترجيع\n' +
              '15000',
              undefined,
              botToken
            );
            return new Response(JSON.stringify({ error: 'invalid_return_format' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }

        // No pending state - treat as regular order
        try {
          console.log('🔄 معالجة الطلب العادي...');
          
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
          let localSystemSucceeded = false; // 🔥 تتبع نجاح النظام المحلي
          let localCityResult: { cityId: number; cityName: string; confidence: number; cityLine?: string; externalId?: number } | null = null;
          let localRegionMatches: Array<{ regionId: number; regionName: string; confidence: number }> = [];
          let localRegionResult: { regionId: number; regionName: string; confidence: number } | null = null;
          let extractedLocation = ''; // 🔥 تعريف المتغير المفقود
          
          try {
            // ===================================================================
            // 🔄 Auto-Refresh: فحص إذا كان الـ cache يحتاج تحديث
            // ===================================================================
            if (shouldRefreshCache()) {
              console.log('🔄 مرت 30 يوم أو cache فارغ - إعادة تحميل تلقائياً...');
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
                console.log(`📍 سطر العنوان المحدد: "${localCityResult.cityLine}"`);
                
                // 🔥 إزالة اسم المدينة من السطر قبل البحث عن المنطقة
                const cleanedLine = removeCityFromLine(localCityResult.cityLine, localCityResult.cityName);
                console.log(`🧹 النص المُنظف للبحث عن المنطقة: "${localCityResult.cityLine}" → "${cleanedLine}"`);
                
                // 🔪 القطع عند كلمة "قرب" فقط - للبحث عن المنطقة الصحيحة
                const qarabIndex = cleanedLine.indexOf('قرب');
                const cleanTextForRegionSearch = qarabIndex !== -1 
                  ? cleanedLine.substring(0, qarabIndex).trim() 
                  : cleanedLine;
                
                console.log(`📍 النص الأصلي بعد المدينة: "${cleanedLine}"`);
                if (qarabIndex !== -1) {
                  console.log(`🔪 تم القطع عند "قرب": البحث في "${cleanTextForRegionSearch}" فقط`);
                }
                
                // 🔥 تعيين extractedLocation للاستخدام في رسالة "هل تقصد؟"
                extractedLocation = cleanTextForRegionSearch.trim();
                
                // البحث عن المناطق المحتملة في النص المقطوع فقط
                localRegionMatches = searchRegionsLocal(localCityResult.cityId, cleanTextForRegionSearch);
                console.log(`🔍 تم العثور على ${localRegionMatches.length} منطقة محتملة:`, localRegionMatches);
                console.log(`🏆 أفضل 10 نتائج:`, localRegionMatches.slice(0, 10).map(r => `${r.regionName} (${Math.round(r.confidence * 100)}%)`));
                
                // ✅ CRITICAL FIX: دائماً عرض "هل تقصد؟" حتى للمطابقات المثالية
                console.log(`🔍 تم العثور على ${localRegionMatches.length} منطقة محتملة - عرض "هل تقصد؟" للتأكيد`);
                
                // 🎯 عرض "هل تقصد؟" لأي عدد من المطابقات (1 أو أكثر)
                if (localRegionMatches.length > 0) {
                  // حذف أي حالة معلقة سابقة
                  await supabase
                    .from('telegram_pending_selections')
                    .delete()
                    .eq('chat_id', chatId);
                  
                  // حفظ بيانات الطلب مؤقتاً
                  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
                  await supabase
                    .from('telegram_pending_selections')
                    .insert({
                      chat_id: chatId,
                      action: 'region_clarification',
                      expires_at: expiresAt.toISOString(),
                      context: {
                        original_text: text,
                        employee_code: employeeCode,
                        city_id: localCityResult.cityId,
                        city_name: localCityResult.cityName,
                        city_external_id: localCityResult.externalId,
                        all_regions: localRegionMatches.map(r => ({
                          ...r,
                          externalId: regionsCache.find(reg => reg.id === r.regionId)?.alwaseet_id
                        }))
                      }
                    });
                  
                  // ✅ نظام pagination محسّن: عند وجود تطابق 100%، نعرض 5 فقط (1 + 4 متشابهات)
                  const totalRegions = localRegionMatches.length;
                  const hasPerfectMatch = localRegionMatches.some(r => r.confidence === 1.0);
                  
                  // إذا كان هناك تطابق 100%، نعرض 5 فقط (حسب العدد المتاح)
                  let firstPageSize;
                  if (hasPerfectMatch && totalRegions > 1) {
                    firstPageSize = Math.min(5, totalRegions); // أقصى 5 نتائج (1 تطابق + 4 متشابهات)
                  } else {
                    firstPageSize = Math.min(10, totalRegions); // النظام العادي
                  }
                  
                  const topRegions = localRegionMatches.slice(0, firstPageSize);
                  
                  const regionButtons = topRegions.map(r => [{
                    text: `📍 ${r.regionName}`,
                    callback_data: `region_${r.regionId}`
                  }]);
                  
                  // زر "المزيد من الخيارات" (20 إضافية) إذا كان هناك أكثر من firstPageSize
                  if (totalRegions > firstPageSize) {
                    const remainingAfterFirst = totalRegions - firstPageSize;
                    const nextBatch = Math.min(20, remainingAfterFirst);
                    regionButtons.push([{
                      text: `🟡 عرض ${nextBatch} خيارات إضافية`,
                      callback_data: `region_page2_${localCityResult.cityId}`
                    }]);
                  }
                  
                  // زر "لا شيء مما سبق" دائماً في الأسفل
                  regionButtons.push([{
                    text: '❌ لا شيء مما سبق',
                    callback_data: 'region_none'
                  }]);
                  
                  const clarificationMessage = totalRegions === 1
                    ? `✅ تم العثور على منطقة واحدة (${extractedLocation})\n📍 اختر المنطقة الصحيحة:`
                    : `✅ تم العثور على ${totalRegions} منطقة (${extractedLocation})\n📍 اختر المنطقة الصحيحة:`;
                  
                  await sendTelegramMessage(chatId, clarificationMessage, { inline_keyboard: regionButtons }, botToken);
                  
                  console.log(`✅ تم إرسال "هل تقصد؟" - صفحة 1: ${firstPageSize} من أصل ${totalRegions} منطقة`);
                  
                  // 🔥 CRITICAL: تعيين localSystemSucceeded = true لمنع استدعاء process_telegram_order
                  localSystemSucceeded = true;
                  
                  return new Response(JSON.stringify({ success: true, action: 'clarification_sent' }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                  });
                }
                
                // 🎯 السيناريو 4: لا توجد مطابقات - الرجوع للنظام التقليدي
                else {
                  console.log('⚠️ السيناريو 4: لا توجد مطابقات مناسبة - الرجوع للنظام التقليدي');
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
          // 🔥 CRITICAL FIX: تعطيل النظام القديم بالكامل - فقط عند عدم العثور على مدينة
          if (!localCityResult) {
            console.log('⚠️ لم يتم العثور على مدينة - إرسال رسالة خطأ');
            
            await sendTelegramMessage(
              chatId,
              '⚠️ لم أتمكن من تحديد المدينة في طلبك.\n\n' +
              'يرجى كتابة العنوان بالصيغة التالية:\n' +
              '📍 المدينة المنطقة\n\n' +
              'مثال:\n' +
              '• بغداد الكرادة\n' +
              '• البصرة المعقل\n' +
              '• الموصل الزهور',
              undefined,
              botToken
            );
            
            return new Response(JSON.stringify({ error: 'no_city_found', message: 'لم يتم العثور على مدينة' }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // 🔥 إذا لم نجد مناطق مطابقة، نرسل رسالة خطأ بدلاً من استدعاء النظام القديم
          if (localRegionMatches.length === 0) {
            console.log('⚠️ لم يتم العثور على مناطق مطابقة - إرسال رسالة خطأ');
            
            await sendTelegramMessage(
              chatId,
              `⚠️ لم أتمكن من تحديد المنطقة في <b>${localCityResult.cityName}</b>.\n\n` +
              '🔍 يرجى التأكد من كتابة اسم المنطقة بشكل صحيح.\n\n' +
              'مثال:\n' +
              '• بغداد الكرادة\n' +
              '• بغداد المنصور\n' +
              '• بغداد الدورة',
              undefined,
              botToken
            );
            
            return new Response(JSON.stringify({ error: 'no_region_found', message: 'لم يتم العثور على منطقة' }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // ⚠️⚠️⚠️ CRITICAL WARNING - DO NOT DISABLE THIS CALL AGAIN ⚠️⚠️⚠️
          // Disabling this call breaks the entire Telegram bot
          // Last disabled: 2025-11-23 → Complete bot failure
          // Last restored: 2025-11-24
          // process_telegram_order has 7 parameters and is correct in database - DO NOT modify it
          
          console.log('📞 استدعاء process_telegram_order للطلب العادي...');
          
          const { data: orderResult, error: orderError } = await supabase.rpc('process_telegram_order', {
            p_employee_code: employeeCode,
            p_message_text: text,
            p_telegram_chat_id: chatId,
            p_city_id: localCityResult?.cityId || null,
            p_region_id: localRegionResult?.regionId || null,
            p_city_name: localCityResult?.cityName || null,
            p_region_name: localRegionResult?.regionName || null
          });

          if (orderError) {
            console.error('❌ خطأ في process_telegram_order:', orderError);
            await sendTelegramMessage(
              chatId,
              '⚠️ عذراً، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.',
              undefined,
              botToken
            );
            return new Response(JSON.stringify({ error: 'order_creation_failed', details: orderError.message }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          if (orderResult?.success === false) {
            console.log('⚠️ فشل إنشاء الطلب:', orderResult.message);
            await sendTelegramMessage(chatId, orderResult.message || orderResult.error, undefined, botToken);
            return new Response(JSON.stringify({ status: 'order_failed', message: orderResult.message }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          console.log('✅ تم إنشاء الطلب بنجاح عبر process_telegram_order');
          await sendTelegramMessage(
            chatId,
            orderResult.message || '✅ تم إنشاء طلبك بنجاح!',
            undefined,
            botToken
          );

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
        
        // ✅ الصفحة 2: عرض 10 مناطق إضافية (من 6 إلى 15)
        if (data.startsWith('region_page2_')) {
          const cityId = parseInt(data.replace('region_page2_', ''));
          
          const { data: pendingData } = await supabase
            .from('telegram_pending_selections')
            .select('*')
            .eq('chat_id', chatId)
            .eq('action', 'region_clarification')
            .maybeSingle();
          
          if (pendingData?.context?.all_regions) {
            const allRegions = pendingData.context.all_regions;
            const totalRegions = allRegions.length;
            const page2Regions = allRegions.slice(10, 30);
            
            const page2Buttons = page2Regions.map((r: any) => [{
              text: `📍 ${r.regionName}`,
              callback_data: `region_${r.regionId}`
            }]);
            
            // زر "المزيد" (30 إضافية) إذا كان هناك أكثر من 30
            if (totalRegions > 30) {
              const remainingAfterPage2 = totalRegions - 30;
              const nextBatch = Math.min(30, remainingAfterPage2);
              page2Buttons.push([{
                text: `🟡 عرض ${nextBatch} خيار إضافي`,
                callback_data: `region_page3_${cityId}`
              }]);
            }
            
            // زر العودة
            page2Buttons.push([{
              text: '🔙 العودة للخيارات الأولى',
              callback_data: `region_back_${cityId}`
            }]);
            
            page2Buttons.push([{
              text: '❌ لا شيء مما سبق',
              callback_data: 'region_none'
            }]);
            
            const page2Message = `📍 الصفحة 2 - اختر المنطقة الصحيحة:`;
            
            await sendTelegramMessage(chatId, page2Message, { inline_keyboard: page2Buttons }, botToken);
            console.log(`✅ الصفحة 2: عرض ${page2Regions.length} منطقة (من 11 إلى 30)`);
            responseMessage = '';
          } else {
            responseMessage = '⚠️ انتهت صلاحية هذا الاختيار. يرجى إعادة إرسال طلبك.';
          }
        }
        // ✅ الصفحة 3: عرض 15 منطقة إضافية (من 16 إلى 30)
        else if (data.startsWith('region_page3_')) {
          const cityId = parseInt(data.replace('region_page3_', ''));
          
          const { data: pendingData } = await supabase
            .from('telegram_pending_selections')
            .select('*')
            .eq('chat_id', chatId)
            .eq('action', 'region_clarification')
            .maybeSingle();
          
          if (pendingData?.context?.all_regions) {
            const allRegions = pendingData.context.all_regions;
            const totalRegions = allRegions.length;
            const page3Regions = allRegions.slice(30, 60);
            
            const page3Buttons = page3Regions.map((r: any) => [{
              text: `📍 ${r.regionName}`,
              callback_data: `region_${r.regionId}`
            }]);
            
            // إضافة زر "المزيد" إذا كان هناك أكثر من 60 منطقة
            if (totalRegions > 60) {
              const remainingAfterPage3 = totalRegions - 60;
              const nextBatch = Math.min(25, remainingAfterPage3);
              page3Buttons.push([{
                text: `🟡 عرض ${nextBatch} خيار إضافي`,
                callback_data: `region_page4_${cityId}`
              }]);
            }
            
            // زر العودة
            page3Buttons.push([{
              text: '🔙 العودة للخيارات الأولى',
              callback_data: `region_back_${cityId}`
            }]);
            
            page3Buttons.push([{
              text: '❌ لا شيء مما سبق',
              callback_data: 'region_none'
            }]);
            
            const page3Message = `📍 الصفحة 3 - اختر المنطقة الصحيحة:`;
            
            await sendTelegramMessage(chatId, page3Message, { inline_keyboard: page3Buttons }, botToken);
            console.log(`✅ الصفحة 3: عرض ${page3Regions.length} منطقة (من 31 إلى 60)`);
            responseMessage = '';
          } else {
            responseMessage = '⚠️ انتهت صلاحية هذا الاختيار. يرجى إعادة إرسال طلبك.';
          }
        }
        // ✅ الصفحة 4: عرض 25 منطقة إضافية (من 61 إلى 85)
        else if (data.startsWith('region_page4_')) {
          const cityId = parseInt(data.replace('region_page4_', ''));
          
          const { data: pendingData } = await supabase
            .from('telegram_pending_selections')
            .select('*')
            .eq('chat_id', chatId)
            .eq('action', 'region_clarification')
            .maybeSingle();
          
          if (pendingData?.context?.all_regions) {
            const allRegions = pendingData.context.all_regions;
            const totalRegions = allRegions.length;
            const page4Regions = allRegions.slice(60, 85);
            
            const page4Buttons = page4Regions.map((r: any) => [{
              text: `📍 ${r.regionName}`,
              callback_data: `region_${r.regionId}`
            }]);
            
            // زر "المزيد" (30 إضافية) إذا كان هناك أكثر من 85
            if (totalRegions > 85) {
              const remainingAfterPage4 = totalRegions - 85;
              const nextBatch = Math.min(30, remainingAfterPage4);
              page4Buttons.push([{
                text: `🟡 عرض ${nextBatch} خيار إضافي`,
                callback_data: `region_page5_${cityId}`
              }]);
            }
            
            // زر العودة
            page4Buttons.push([{
              text: '🔙 العودة للخيارات الأولى',
              callback_data: `region_back_${cityId}`
            }]);
            
            page4Buttons.push([{
              text: '❌ لا شيء مما سبق',
              callback_data: 'region_none'
            }]);
            
            const page4Message = `📍 الصفحة 4 - اختر المنطقة الصحيحة (${page4Regions.length} خيار إضافي):`;
            
            await sendTelegramMessage(chatId, page4Message, { inline_keyboard: page4Buttons }, botToken);
            console.log(`✅ الصفحة 4: عرض ${page4Regions.length} منطقة (من 61 إلى 85)`);
            responseMessage = '';
          } else {
            responseMessage = '⚠️ انتهت صلاحية هذا الاختيار. يرجى إعادة إرسال طلبك.';
          }
        }
        // ✅ الصفحة 5: عرض 30 منطقة إضافية (من 86 إلى 115)
        else if (data.startsWith('region_page5_')) {
          const cityId = parseInt(data.replace('region_page5_', ''));
          
          const { data: pendingData } = await supabase
            .from('telegram_pending_selections')
            .select('*')
            .eq('chat_id', chatId)
            .eq('action', 'region_clarification')
            .maybeSingle();
          
          if (pendingData?.context?.all_regions) {
            const allRegions = pendingData.context.all_regions;
            const totalRegions = allRegions.length;
            const page5Regions = allRegions.slice(85, 115);
            
            const page5Buttons = page5Regions.map((r: any) => [{
              text: `📍 ${r.regionName}`,
              callback_data: `region_${r.regionId}`
            }]);
            
            // زر العودة
            page5Buttons.push([{
              text: '🔙 العودة للخيارات الأولى',
              callback_data: `region_back_${cityId}`
            }]);
            
            // زر العودة للصفحة 4
            page5Buttons.push([{
              text: '⬅️ رجوع للصفحة 4',
              callback_data: `region_page4_${cityId}`
            }]);
            
            page5Buttons.push([{
              text: '❌ لا شيء مما سبق',
              callback_data: 'region_none'
            }]);
            
            const page5Message = `📍 الصفحة 5 - اختر المنطقة الصحيحة (${page5Regions.length} خيار إضافي):`;
            
            await sendTelegramMessage(chatId, page5Message, { inline_keyboard: page5Buttons }, botToken);
            console.log(`✅ الصفحة 5: عرض ${page5Regions.length} منطقة (من 86 إلى 115)`);
            responseMessage = '';
          } else {
            responseMessage = '⚠️ انتهت صلاحية هذا الاختيار. يرجى إعادة إرسال طلبك.';
          }
        }
        // ✅ العودة للصفحة الأولى
        else if (data.startsWith('region_back_')) {
          const { data: pendingData } = await supabase
            .from('telegram_pending_selections')
            .select('*')
            .eq('chat_id', chatId)
            .eq('action', 'region_clarification')
            .maybeSingle();
          
          if (pendingData?.context?.all_regions) {
            const allRegions = pendingData.context.all_regions;
            const totalRegions = allRegions.length;
            const topRegions = allRegions.slice(0, 10);
            
            const regionButtons = topRegions.map((r: any) => [{
              text: `📍 ${r.regionName}`,
              callback_data: `region_${r.regionId}`
            }]);
            
            if (totalRegions > 10) {
              const remainingAfterFirst = totalRegions - 10;
              const nextBatch = Math.min(20, remainingAfterFirst);
              regionButtons.push([{
                text: `🟡 عرض ${nextBatch} خيارات إضافية`,
                callback_data: `region_page2_${pendingData.context.city_id}`
              }]);
            }
            
            regionButtons.push([{
              text: '❌ لا شيء مما سبق',
              callback_data: 'region_none'
            }]);
            
            const backMessage = `📍 الصفحة 1 - اختر المنطقة الصحيحة:`;
            
            await sendTelegramMessage(chatId, backMessage, { inline_keyboard: regionButtons }, botToken);
            console.log(`✅ العودة للصفحة 1: عرض ${topRegions.length} منطقة`);
            responseMessage = '';
          } else {
            responseMessage = '⚠️ انتهت صلاحية هذا الاختيار. يرجى إعادة إرسال طلبك.';
          }
        }
        // Handle inventory button presses
        else if (data === 'inv_product') {
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
        else if (data.startsWith('region_') && 
                  !data.startsWith('region_page2_') && 
                  !data.startsWith('region_page3_') && 
                  !data.startsWith('region_page4_') &&
                  !data.startsWith('region_back_') &&
                  !data.startsWith('region_more_')) {
          try {
            // ✅ معالجة "المزيد من الخيارات"
            if (data.startsWith('region_more_')) {
              const cityId = parseInt(data.replace('region_more_', ''));
              
              const { data: pendingData } = await supabase
                .from('telegram_pending_selections')
                .select('*')
                .eq('chat_id', chatId)
                .eq('action', 'region_clarification')
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              
              if (pendingData?.context?.all_regions && Array.isArray(pendingData.context.all_regions)) {
                const allRegions = pendingData.context.all_regions;
                const moreRegions = allRegions.slice(5, 15);
                
                if (moreRegions.length > 0) {
                  const moreButtons = moreRegions.map((r: any) => [{
                    text: `📍 ${r.regionName}`,
                    callback_data: `region_${r.regionId}`
                  }]);
                  
                  moreButtons.push([{
                    text: '🔙 العودة للخيارات الأولى',
                    callback_data: `region_back_${cityId}`
                  }]);
                  
                  await sendTelegramMessage(chatId, '📋 المزيد من المناطق المحتملة:', { inline_keyboard: moreButtons }, botToken);
                  responseMessage = '';
                } else {
                  responseMessage = '✅ لا توجد مناطق إضافية.';
                }
              } else {
                responseMessage = '⚠️ انتهت صلاحية هذا الاختيار. يرجى إعادة إرسال طلبك.';
              }
            }
            // ✅ معالجة العودة للخيارات الأولى
            else if (data.startsWith('region_back_')) {
              const { data: pendingData } = await supabase
                .from('telegram_pending_selections')
                .select('*')
                .eq('chat_id', chatId)
                .eq('action', 'region_clarification')
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              
              if (pendingData?.context?.all_regions && Array.isArray(pendingData.context.all_regions)) {
                const allRegions = pendingData.context.all_regions;
                const topRegions = allRegions.slice(0, 5);
                const regionButtons = topRegions.map((r: any) => [{
                  text: `📍 ${r.regionName}`,
                  callback_data: `region_${r.regionId}`
                }]);
                
                if (allRegions.length > 5) {
                  regionButtons.push([{
                    text: '➕ عرض المزيد من الخيارات',
                    callback_data: `region_more_${pendingData.context.city_id}`
                  }]);
                }
                
                regionButtons.push([{
                  text: '❌ لا شيء مما سبق',
                  callback_data: 'region_none'
                }]);
                
                const cityName = pendingData.context.city_name || 'المدينة';
                await sendTelegramMessage(chatId, `🏙️ <b>${cityName}</b>\n\n🤔 اختر المنطقة الصحيحة:`, { inline_keyboard: regionButtons }, botToken);
                responseMessage = '';
              } else {
                responseMessage = '⚠️ انتهت صلاحية هذا الاختيار. يرجى إعادة إرسال طلبك.';
              }
            }
            // ✅ معالجة اختيار منطقة محددة أو "لا شيء مما سبق"
            else {
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
                // ✅ المستخدم اختار "لا شيء مما سبق" - طلب إدخال يدوي
                responseMessage = `❌ لم نجد المنطقة المطلوبة ضمن الخيارات.\n\n` +
                  `📝 يرجى إعادة إرسال طلبك مع كتابة العنوان بشكل أوضح.\n\n` +
                  `💡 مثال:\n` +
                  `بغداد الكرادة شارع 62\n` +
                  `07712345678\n` +
                  `برشلونة ازرق سمول`;
                
                // حذف الحالة المعلقة
                await supabase
                  .from('telegram_pending_selections')
                  .delete()
                  .eq('id', pendingData.id);
              } else {
                // ✅ المستخدم اختار منطقة محددة
                const regionId = parseInt(data.replace('region_', ''));
                const selectedRegion = pendingData.context.all_regions?.find((r: any) => r.regionId === regionId);
                
                console.log(`✅ المستخدم اختار المنطقة: ${regionId} (${selectedRegion?.regionName})`);
                
                // ✅ إنشاء الطلب مع تمرير معلومات نظام "هل تقصد؟" مباشرة
                console.log('📤 استدعاء process_telegram_order مع المعاملات:', {
                  p_employee_code: pendingData.context.employee_code,
                  p_message_text: pendingData.context.original_text,
                  p_telegram_chat_id: chatId,
                  p_city_id: pendingData.context.city_external_id || pendingData.context.city_id,
                  p_region_id: selectedRegion?.externalId || regionId,
                  p_city_name: pendingData.context.city_name,
                  p_region_name: selectedRegion?.regionName || 'غير محدد'
                });
                
                const { data: orderResult, error: orderError } = await supabase.rpc('process_telegram_order', {
                  p_employee_code: pendingData.context.employee_code,
                  p_message_text: pendingData.context.original_text,
                  p_telegram_chat_id: chatId,
                  p_city_id: pendingData.context.city_external_id || pendingData.context.city_id,
                  p_region_id: selectedRegion?.externalId || regionId,
                  p_city_name: pendingData.context.city_name,
                  p_region_name: selectedRegion?.regionName || 'غير محدد'
                });
                
                console.log('📥 نتيجة process_telegram_order:', {
                  orderResult,
                  orderError,
                  success: orderResult?.success,
                  order_id: orderResult?.order_id,
                  message: orderResult?.message
                });
                
                if (orderError) {
                  console.error('❌ خطأ في استدعاء process_telegram_order:', orderError);
                  throw orderError;
                }
                
                if (!orderResult?.success) {
                  console.error('❌ فشل process_telegram_order:', orderResult?.message || 'سبب غير معروف');
                }
                
                console.log(`✅ تم إنشاء الطلب مع العنوان الصحيح: ${pendingData.context.city_name} - ${selectedRegion?.regionName}`);
                
                if (orderResult?.success) {
                  // جلب تفاصيل الطلب الكامل من ai_orders
                  const { data: aiOrderData } = await supabase
                    .from('ai_orders')
                    .select('*')
                    .eq('id', orderResult.order_id)
                    .maybeSingle();
                  
                  if (aiOrderData) {
                    // بناء رسالة جميلة مع التفاصيل الكاملة
                    const allRegions = pendingData.context.all_regions || [];
                    const selectedRegion = allRegions.find((r: any) => r.regionId === regionId);
                    const regionName = selectedRegion?.regionName || 'المنطقة المختارة';
                    
                    // استخراج معلومات المنتجات
                    let itemsText = '';
                    if (aiOrderData.items && Array.isArray(aiOrderData.items)) {
                      itemsText = aiOrderData.items.map((item: any) => 
                        `❇️ ${item.product_name || 'منتج'} (${item.color || 'لون'}) ${item.size || 'قياس'} × ${item.quantity || 1}`
                      ).join('\n');
                    }
                    
                    responseMessage = `✅ تم استلام الطلب!

🔹 ${aiOrderData.customer_name || 'ريوس'}
📍 ${pendingData.context.city_name} - ${regionName}${aiOrderData.customer_address && aiOrderData.customer_address !== 'لم يُحدد' ? ' - ' + aiOrderData.customer_address : ''}
📱 الهاتف: ${aiOrderData.customer_phone || 'غير محدد'}${aiOrderData.customer_phone2 && String(aiOrderData.customer_phone2).trim() && aiOrderData.customer_phone2 !== 'null' && aiOrderData.customer_phone2 !== null ? '\n📱 هاتف 2: ' + aiOrderData.customer_phone2 : ''}
${itemsText || '❇️ تفاصيل الطلب غير متوفرة'}
💵 المبلغ الإجمالي: ${(aiOrderData.total_amount || 0).toLocaleString('en-US')} د.ع`;
                  } else {
                    // Fallback - بناء الرسالة من orderResult مباشرة
                    const allRegions = pendingData.context.all_regions || [];
                    const selectedRegion = allRegions.find((r: any) => r.regionId === regionId);
                    const regionName = selectedRegion?.regionName || 'المنطقة المختارة';
                    
                    // استخراج معلومات المنتجات من orderResult
                    let itemsText = '';
                    if (orderResult?.orderResult?.items && Array.isArray(orderResult.orderResult.items)) {
                      itemsText = orderResult.orderResult.items.map((item: any) => 
                        `❇️ ${item.product_name || 'منتج'} (${item.color || 'لون'}) ${item.size || 'قياس'} × ${item.quantity || 1}`
                      ).join('\n');
                    }
                    
                    const orderData = orderResult?.orderResult || orderResult;
                    responseMessage = `✅ تم استلام الطلب!

🔹 ${orderData.customer_name || 'ريوس'}
📍 ${pendingData.context.city_name} - ${regionName}${orderData.customer_address && orderData.customer_address !== 'لم يُحدد' ? ' - ' + orderData.customer_address : ''}
📱 الهاتف: ${orderData.customer_phone || 'غير محدد'}${orderData.customer_phone2 && String(orderData.customer_phone2).trim() && orderData.customer_phone2 !== 'null' && orderData.customer_phone2 !== null ? '\n📱 هاتف 2: ' + orderData.customer_phone2 : ''}
${itemsText || '❇️ تفاصيل الطلب غير متوفرة'}
💵 المبلغ الإجمالي: ${(orderData.total_amount || 0).toLocaleString('en-US')} د.ع`;
                  }
                } else {
                  responseMessage = orderResult?.message || 'لم أتمكن من معالجة طلبك.';
                }
                
                // حذف الحالة المعلقة
                await supabase
                  .from('telegram_pending_selections')
                  .delete()
                  .eq('id', pendingData.id);
              }
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