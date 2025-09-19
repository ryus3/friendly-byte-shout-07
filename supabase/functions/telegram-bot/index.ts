import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';
import { parseAddressWithCache } from './address-cache-parser.ts';
import { 
  intelligentAddressParsing, 
  smartCitySearch, 
  smartRegionSearch, 
  learnFromCorrection,
  createSmartErrorMessage,
  createInteractiveSuggestions 
} from './ai-engine.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    date: number;
  };
}

// ============= نظام الذكاء الاصطناعي للمطابقة الذكية =============

// تحسين معالجة البيانات النصية العربية مع دعم الأخطاء الإملائية
function normalizeArabic(text: string): string {
  return text
    .replace(/أ|إ|آ/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ُُِّّّّّّّّّّّّّّّّّّ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// معالجة الأخطاء الإملائية الشائعة بشكل ذكي
function fixCommonMisspellings(text: string): string {
  const replacements = {
    'ديوانيه': 'الديوانية',
    'ديوانيا': 'الديوانية', 
    'ديوانية': 'الديوانية',
    'سماوه': 'السماوة',
    'سماوة': 'السماوة',
    'السماوه': 'السماوة',
    'حله': 'الحلة',
    'حلا': 'الحلة',
    'حلة': 'الحلة',
    'نجف': 'النجف',
    'كربلا': 'كربلاء',
    'كربله': 'كربلاء',
    'بصره': 'البصرة',
    'البصره': 'البصرة',
    'بصرة': 'البصرة',
    'موصل': 'الموصل',
    'انبار': 'الانبار',
    'رمادي': 'الرمادي',
    'فلوجه': 'الفلوجة',
    'تكريت': 'تكريت',
    'كركوك': 'كركوك',
    'اربيل': 'اربيل',
    'دهوك': 'دهوك',
    'عماره': 'العمارة',
    'عمارة': 'العمارة',
    'ناصريه': 'الناصرية',
    'ناصرية': 'الناصرية',
    'مثنى': 'المثنى',
    'ميسان': 'ميسان',
    'واسط': 'واسط'
  };
  
  let result = text;
  for (const [wrong, correct] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\b${wrong}\\b`, 'gi'), correct);
  }
  return result;
}

// حساب المسافة النصية للمطابقة الذكية (Levenshtein Distance)
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeArabic(str1);
  const s2 = normalizeArabic(str2);
  
  if (s1 === s2) return 1.0;
  
  const len1 = s1.length;
  const len2 = s2.length;
  
  if (len1 === 0) return len2 === 0 ? 1.0 : 0.0;
  if (len2 === 0) return 0.0;
  
  const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
  
  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1,
        matrix[j][i - 1] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }
  
  const maxLen = Math.max(len1, len2);
  const distance = matrix[len2][len1];
  return Math.max(0, (maxLen - distance) / maxLen);
}

// قاموس شامل ومطابق تماماً لأسماء المدن في قاعدة البيانات
const cityVariations = {
  'بغداد': ['بغداد', 'baghdad', 'بغداد - بغداد'],
  'البصرة': ['البصرة', 'بصرة', 'بصره', 'البصره', 'basra', 'basrah'],
  'اربيل': ['اربيل', 'أربيل', 'اربل', 'erbil', 'hawler'],
  'دهوك': ['دهوك', 'دهوك', 'dahuk', 'duhok'],
  'كربلاء': ['كربلاء', 'كربلا', 'كربله', 'karbala'],
  'النجف': ['النجف', 'نجف', 'najaf'],
  'الانبار': ['الانبار', 'انبار', 'الأنبار', 'أنبار', 'anbar'],
  'نينوى - الموصل': ['نينوى', 'نينوا', 'الموصل', 'موصل', 'ninawa', 'mosul'],
  'صلاح الدين - تكريت': ['صلاح الدين', 'صلاح', 'تكريت', 'salahuddin'],
  'الديوانية - القادسية': ['القادسية', 'الديوانية', 'ديوانية', 'ديوانيه', 'ديوانيا', 'qadisiyah'],
  'الحلة - بابل': ['بابل', 'الحلة', 'حلة', 'حله', 'حلا', 'babylon', 'hilla'],
  'الكوت - واسط': ['واسط', 'الكوت', 'كوت', 'wasit', 'kut'],
  'الناصرية - ذي قار': ['ذي قار', 'ذيقار', 'الناصرية', 'ناصرية', 'ناصريه', 'thi qar', 'nasiriyah'],
  'السماوة - المثنى': ['المثنى', 'مثنى', 'السماوة', 'سماوة', 'سماوه', 'السماوه', 'muthanna', 'samawa'],
  'العمارة - ميسان': ['ميسان', 'العمارة', 'عمارة', 'عماره', 'maysan', 'amarah'],
  'كركوك': ['كركوك', 'kirkuk'],
  'الرمادي - الانبار': ['الرمادي', 'رمادي', 'ramadi'],
  'الفلوجة - الانبار': ['الفلوجة', 'فلوجة', 'فلوجه', 'fallujah']
};

// خريطة شاملة لأحياء بغداد والمدن الأخرى
const neighborhoodToCityMap = {
  // أحياء بغداد - الكرخ
  'الدورة': 'بغداد', 'الحرية': 'بغداد', 'الكاظمية': 'بغداد', 'الشعلة': 'بغداد',
  'العامرية': 'بغداد', 'الغزالية': 'بغداد', 'المنصور': 'بغداد', 'الكرادة الشرقية': 'بغداد',
  'حي الجامعة': 'بغداد', 'الراشدية': 'بغداد', 'الحي العسكري': 'بغداد', 'زيونة': 'بغداد',
  
  // أحياء بغداد - الرصافة  
  'الأعظمية': 'بغداد', 'الاعظمية': 'بغداد', 'اعظمية': 'بغداد', 'مدينة الصدر': 'بغداد',
  'الثورة': 'بغداد', 'الشعب': 'بغداد', 'الحبيبية': 'بغداد', 'بغداد الجديدة': 'بغداد',
  'الكرادة': 'بغداد', 'كرادة': 'بغداد', 'الكريعات': 'بغداد', 'الرستمية': 'بغداد',
  'الزعفرانية': 'بغداد', 'الطالبية': 'بغداد', 'المشتل': 'بغداد', 'النهضة': 'بغداد',
  
  // مناطق أخرى في العراق
  'غماس': 'الديوانية - القادسية', 'الشامية': 'الديوانية - القادسية',
  'النيل': 'الحلة - بابل', 'الهندية': 'الحلة - بابل',
  'الجبايش': 'الناصرية - ذي قار', 'سوق الشيوخ': 'الناصرية - ذي قار',
  'الخضر': 'السماوة - المثنى', 'الوركاء': 'السماوة - المثنى',
  'علي الغربي': 'العمارة - ميسان', 'المجر الكبير': 'العمارة - ميسان'
};

// البحث الذكي عن المدينة مع دعم المطابقة الضبابية
async function findCityByVariation(input: string): Promise<{cityName: string, confidence: number} | null> {
  const normalized = normalizeArabic(fixCommonMisspellings(input.trim()));
  
  // المطابقة المباشرة (100%)
  for (const [cityName, variations] of Object.entries(cityVariations)) {
    for (const variation of variations) {
      if (normalizeArabic(variation) === normalized) {
        console.log(`🎯 مطابقة مباشرة: "${input}" -> "${cityName}" (100%)`);
        return { cityName, confidence: 1.0 };
      }
    }
  }
  
  // المطابقة الضبابية (70% فأكثر)
  let bestMatch = null;
  let highestScore = 0.7; // الحد الأدنى للقبول
  
  for (const [cityName, variations] of Object.entries(cityVariations)) {
    for (const variation of variations) {
      const score = calculateSimilarity(normalized, normalizeArabic(variation));
      if (score > highestScore) {
        highestScore = score;
        bestMatch = { cityName, confidence: score };
      }
    }
  }
  
  if (bestMatch) {
    console.log(`🔍 مطابقة ذكية: "${input}" -> "${bestMatch.cityName}" (${Math.round(bestMatch.confidence * 100)}%)`);
    return bestMatch;
  }
  
  // البحث المباشر في قاعدة البيانات
  try {
    const { data, error } = await supabase.rpc('find_city_in_cache', {
      p_city_text: input
    });
    
    if (!error && data && data.length > 0) {
      const match = data[0];
      if (match.similarity_score >= 0.7) {
        console.log(`💾 مطابقة قاعدة البيانات: "${input}" -> "${match.name}" (${Math.round(match.similarity_score * 100)}%)`);
        return { cityName: match.name, confidence: match.similarity_score };
      }
    }
  } catch (error) {
    console.error('خطأ في البحث بقاعدة البيانات:', error);
  }
  
  return null;
}

// البحث الذكي عن المنطقة  
async function findRegionSmart(cityId: number, regionText: string): Promise<{regionName: string, confidence: number} | null> {
  try {
    const { data, error } = await supabase.rpc('find_region_in_cache', {
      p_city_id: cityId,
      p_region_text: regionText
    });
    
    if (!error && data && data.length > 0) {
      const match = data[0];
      if (match.similarity_score >= 0.7) {
        console.log(`🏘️ مطابقة منطقة ذكية: "${regionText}" -> "${match.name}" (${Math.round(match.similarity_score * 100)}%)`);
        return { regionName: match.name, confidence: match.similarity_score };
      }
    }
  } catch (error) {
    console.error('خطأ في البحث عن المنطقة:', error);
  }
  
  return null;
}

// دالة للحصول على اقتراحات المدن المشابهة
async function getSimilarCities(input: string): Promise<Array<{name: string, confidence: number}>> {
  const suggestions = [];
  const normalized = normalizeArabic(fixCommonMisspellings(input));
  
  // البحث في قاموس المتغيرات
  for (const [cityName, variations] of Object.entries(cityVariations)) {
    let maxScore = 0;
    for (const variation of variations) {
      const score = calculateSimilarity(normalized, normalizeArabic(variation));
      maxScore = Math.max(maxScore, score);
    }
    if (maxScore >= 0.5) {
      suggestions.push({ name: cityName, confidence: maxScore });
    }
  }
  
  // البحث في قاعدة البيانات
  try {
    const { data, error } = await supabase.rpc('find_city_in_cache', {
      p_city_text: input
    });
    
    if (!error && data) {
      for (const match of data) {
        if (match.similarity_score >= 0.5) {
          suggestions.push({ name: match.name, confidence: match.similarity_score });
        }
      }
    }
  } catch (error) {
    console.error('خطأ في جلب اقتراحات المدن:', error);
  }
  
  // ترتيب وإرجاع أفضل 3 اقتراحات
  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

// دالة للحصول على اقتراحات المناطق المشابهة
async function getSimilarRegions(cityId: number, input: string): Promise<Array<{name: string, confidence: number}>> {
  const suggestions = [];
  
  try {
    const { data, error } = await supabase.rpc('find_region_in_cache', {
      p_city_id: cityId,
      p_region_text: input
    });
    
    if (!error && data) {
      for (const match of data) {
        if (match.similarity_score >= 0.4) {
          suggestions.push({ name: match.name, confidence: match.similarity_score });
        }
      }
    }
  } catch (error) {
    console.error('خطأ في جلب اقتراحات المناطق:', error);
  }
  
  // ترتيب وإرجاع أفضل 5 اقتراحات
  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

// وظيفة لإرسال رسائل الخطأ المحسنة مع الاقتراحات الذكية
async function sendEnhancedErrorMessage(chatId: number, errorType: string, details: any) {
  let message = '';
  
  switch (errorType) {
    case 'missing_phone':
      message = `❌ <b>خطأ: رقم الهاتف مفقود</b>\n\n`;
      message += `يرجى إضافة رقم هاتف صحيح (07XXXXXXXX) مع الطلب.\n\n`;
      message += `<b>مثال صحيح:</b>\n`;
      message += `أحمد علي\n07501234567\nبغداد الكرادة\nتيشيرت أزرق XL`;
      break;
      
    case 'missing_products':
      message = `❌ <b>خطأ: المنتجات مفقودة</b>\n\n`;
      message += `يرجى إضافة منتج واحد على الأقل مع تفاصيل اللون والمقاس.\n\n`;
      message += `<b>مثال صحيح:</b>\n`;
      message += `أحمد علي\n07501234567\nبغداد الكرادة\nتيشيرت برشلونة أزرق XL`;
      break;

    case 'incomplete_order':
      message = `❌ <b>طلب غير مكتمل</b>\n\n`;
      message += `الطلب ناقص ولا يمكن معالجته.\n\n`;
      message += `<b>تأكد من وجود:</b>\n`;
      message += `• اسم العميل\n• رقم الهاتف\n• العنوان (المدينة والمنطقة)\n• المنتجات\n\n`;
      message += `<b>مثال صحيح:</b>\n`;
      message += `سارة محمد\n07701234567\nبغداد الكرادة\nفستان أحمر M + حقيبة سوداء`;
      break;
      
    case 'city_not_found':
      message = `❌ <b>لم يتم العثور على المدينة</b>\n\n`;
      message += `المدينة "${details.input}" غير موجودة.\n\n`;
      
      // اقتراحات ذكية للمدن
      const suggestions = await getSimilarCities(details.input);
      if (suggestions.length > 0) {
        message += `<b>💡 هل تقصد إحدى هذه المدن؟</b>\n`;
        suggestions.forEach((city, index) => {
          message += `${index + 1}. ${city.name} (${Math.round(city.confidence * 100)}%)\n`;
        });
        message += `\n📝 يرجى إعادة كتابة الطلب مع اسم المدينة الصحيح.`;
      } else {
        message += `<b>📋 المدن المتاحة:</b>\n`;
        message += `بغداد، البصرة، اربيل، دهوك، كربلاء، النجف\n`;
        message += `الديوانية، الحلة، الكوت، الناصرية، السماوة، العمارة\n`;
        message += `كركوك، الموصل، تكريت، الرمادي، الفلوجة`;
      }
      break;
      
    case 'region_not_found':
      message = `❌ <b>لم يتم العثور على المنطقة</b>\n\n`;
      message += `المنطقة "${details.regionInput}" غير موجودة في ${details.cityName}.\n\n`;
      
      // اقتراحات ذكية للمناطق
      if (details.cityId) {
        const regionSuggestions = await getSimilarRegions(details.cityId, details.regionInput);
        if (regionSuggestions.length > 0) {
          message += `<b>💡 هل تقصد إحدى هذه المناطق؟</b>\n`;
          regionSuggestions.forEach((region, index) => {
            message += `${index + 1}. ${region.name} (${Math.round(region.confidence * 100)}%)\n`;
          });
        }
      }
      message += `\n📝 يرجى إعادة كتابة الطلب مع اسم المنطقة الصحيح.`;
      break;

    case 'auto_baghdad_selected':
      message = `ℹ️ <b>تم اختيار بغداد تلقائياً</b>\n\n`;
      message += `تم التعرف على "${details.regionInput}" كمنطقة في بغداد.\n`;
      message += `إذا كان هذا غير صحيح، يرجى إعادة كتابة الطلب مع اسم المدينة الصحيح.\n\n`;
      message += `✅ سيتم متابعة معالجة الطلب...`;
      break;
      
    default:
      message = `❌ <b>خطأ في معالجة الطلب</b>\n\n`;
      message += `${details.message || 'حدث خطأ غير متوقع.'}\n\n`;
      message += `يرجى إعادة المحاولة أو التواصل مع الدعم.`;
  }
  
  await sendTelegramMessage(chatId, message, 'HTML');
  return false; // إيقاف المعالجة
}

// نظام ذكي لتحليل العنوان مع معالجة الأخطاء الشاملة
async function parseAddressLineSmart(line: string, chatId: number) {
  const cleaned = line.trim();
  console.log(`🔍 تحليل العنوان بالذكاء الاصطناعي: "${cleaned}"`);
  
  let cityId = null;
  let regionId = null;
  let cityName = '';
  let regionName = '';
  let autoSelected = false;
  
  // استخدام محلل العناوين المتقدم
  try {
    const parsed = await parseAddressWithCache(cleaned);
    if (parsed.city_id && parsed.city_name) {
      cityId = parsed.city_id;
      cityName = parsed.city_name;
      regionId = parsed.region_id;
      regionName = parsed.region_name || '';
      console.log(`🎯 محلل العناوين المتقدم: ${cityName} - ${regionName}`);
      return { cityId, regionId, cityName, regionName, fullAddress: cleaned, autoSelected: false };
    }
  } catch (error) {
    console.log('⚠️ محلل العناوين المتقدم غير متاح، سنستخدم النظام الذكي');
  }
  
  // تنظيف وتحليل النص
  const words = cleaned.split(/[\s,،-]+/).filter(w => w.length > 1);
  console.log(`📝 الكلمات المستخرجة: ${words.join(', ')}`);
  
  // المرحلة 1: البحث الذكي عن المدينة
  for (const word of words) {
    const cityMatch = await findCityByVariation(word);
    if (cityMatch && cityMatch.confidence >= 0.8) {
      cityName = cityMatch.cityName;
      console.log(`✅ مطابقة مدينة ذكية: "${word}" -> "${cityName}" (${Math.round(cityMatch.confidence * 100)}%)`);
      break;
    }
  }
  
  // المرحلة 2: البحث في خريطة الأحياء
  if (!cityName) {
    for (const word of words) {
      const normalizedWord = normalizeArabic(word);
      for (const [neighborhood, defaultCity] of Object.entries(neighborhoodToCityMap)) {
        if (normalizeArabic(neighborhood) === normalizedWord) {
          cityName = defaultCity;
          regionName = word;
          autoSelected = true;
          console.log(`🏘️ حي معروف: "${word}" -> مدينة: "${cityName}"`);
          
          // إرسال تنبيه ذكي للمستخدم
          await sendEnhancedErrorMessage(chatId, 'auto_baghdad_selected', {
            regionInput: word
          });
          break;
        }
      }
      if (cityName) break;
    }
  }
  
  // المرحلة 3: المطابقة الضبابية للمدن
  if (!cityName) {
    for (const word of words) {
      const cityMatch = await findCityByVariation(word);
      if (cityMatch && cityMatch.confidence >= 0.7) {
        cityName = cityMatch.cityName;
        console.log(`🔍 مطابقة ضبابية: "${word}" -> "${cityName}" (${Math.round(cityMatch.confidence * 100)}%)`);
        
        // إرسال تأكيد للمستخدم
        await sendTelegramMessage(chatId, 
          `💡 <b>تصحيح تلقائي:</b> تم تفسير "${word}" كـ "${cityName}"\n` +
          `إذا كان هذا غير صحيح، يرجى إعادة كتابة العنوان.`, 
          'HTML'
        );
        break;
      }
    }
  }
  
  // المرحلة 4: إذا لم توجد مدينة، أرسل خطأ مع اقتراحات
  if (!cityName) {
    const firstWord = words[0] || cleaned;
    await sendEnhancedErrorMessage(chatId, 'city_not_found', {
      input: firstWord
    });
    return null;
  }
  
  // المرحلة 5: البحث عن المدينة في قاعدة البيانات
  try {
    const { data: cities } = await supabase
      .from('cities_cache')
      .select('alwaseet_id, name')
      .ilike('name', `%${cityName}%`)
      .limit(1);
    
    if (cities && cities.length > 0) {
      cityId = cities[0].alwaseet_id;
      cityName = cities[0].name;
      console.log(`💾 مدينة في قاعدة البيانات: ${cityName} (ID: ${cityId})`);
    } else {
      console.error(`❌ المدينة "${cityName}" غير موجودة في قاعدة البيانات`);
      await sendEnhancedErrorMessage(chatId, 'city_not_found', {
        input: cityName
      });
      return null;
    }
  } catch (error) {
    console.error('خطأ في البحث عن المدينة في قاعدة البيانات:', error);
    return null;
  }
  
  // المرحلة 6: البحث الذكي عن المنطقة
  if (cityId) {
    // إذا لم نجد منطقة من خريطة الأحياء، ابحث في الكلمات الأخرى
    if (!regionName) {
      for (const word of words) {
        if (normalizeArabic(word) !== normalizeArabic(cityName)) {
          const regionMatch = await findRegionSmart(cityId, word);
          if (regionMatch && regionMatch.confidence >= 0.7) {
            regionId = await getRegionId(cityId, regionMatch.regionName);
            regionName = regionMatch.regionName;
            console.log(`🏘️ مطابقة منطقة ذكية: "${word}" -> "${regionName}"`);
            break;
          }
        }
      }
    }
    
    // إذا كان لدينا منطقة من خريطة الأحياء، ابحث عن ID
    if (regionName && !regionId) {
      regionId = await getRegionId(cityId, regionName);
    }
    
    // إذا لم نجد منطقة، أرسل خطأ مع اقتراحات
    if (!regionName) {
      const potentialRegion = words.find(w => normalizeArabic(w) !== normalizeArabic(cityName));
      if (potentialRegion) {
        await sendEnhancedErrorMessage(chatId, 'region_not_found', {
          regionInput: potentialRegion,
          cityName: cityName,
          cityId: cityId
        });
        return null;
      }
    }
  }
  
  return {
    cityId,
    regionId,
    cityName,
    regionName,
    fullAddress: cleaned,
    autoSelected
  };
}

// دالة مساعدة للحصول على رقم المنطقة
async function getRegionId(cityId: number, regionName: string): Promise<number | null> {
  try {
    const { data: regions } = await supabase
      .from('regions_cache')
      .select('alwaseet_id')
      .eq('city_id', cityId)
      .ilike('name', `%${regionName}%`)
      .limit(1);
    
    if (regions && regions.length > 0) {
      return regions[0].alwaseet_id;
    }
  } catch (error) {
    console.error('خطأ في البحث عن رقم المنطقة:', error);
  }
  return null;
}

// ============= نظام إدارة الموظفين =============

// Get bot token from database settings with env fallback
async function getBotToken(): Promise<string | null> {
  try {
    // 1) Try from settings table
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'telegram_bot_config')
      .single();

    if (!error && data) {
      const val = data.value;
      const tokenFromDb = typeof val === 'string' ? val : (val?.bot_token ?? null);
      if (tokenFromDb && String(tokenFromDb).trim().length > 0) {
        return String(tokenFromDb).trim();
      }
      console.log('Bot token not found in settings payload, will try env fallback');
    } else {
      console.log('No bot config found in settings, will try env fallback');
    }
  } catch (err) {
    console.error('Error getting bot token from DB, will try env fallback:', err);
  }

  // 2) Fallback to environment variable
  const envToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (envToken && envToken.trim().length > 0) return envToken.trim();

  console.error('Bot token not available (DB nor ENV)');
  return null;
}

async function sendTelegramMessage(chatId: number, text: string, parseMode = 'HTML') {
  const botToken = await getBotToken();
  if (!botToken) {
    console.error('Bot token not found in database');
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Telegram API error:', errorData);
    }
  } catch (error) {
    console.error('Error sending message to Telegram:', error);
  }
}

async function getEmployeeByTelegramId(chatId: number) {
  try {
    const { data, error } = await supabase.rpc('get_employee_by_telegram_id', {
      p_telegram_chat_id: chatId
    });
    
    if (!error && data && data.success) {
      return data.employee;
    }
  } catch (error) {
    console.error('Error getting employee:', error);
  }
  return null;
}

async function linkEmployeeCode(code: string, chatId: number) {
  try {
    const { data, error } = await supabase.rpc('link_telegram_user', {
      p_employee_code: code,
      p_telegram_chat_id: chatId
    });
    
    return !error && data && data.success;
  } catch (error) {
    console.error('Error linking employee code:', error);
    return false;
  }
}

// ============= معالجة الطلبات المحسنة =============

// التحقق الذكي من صحة الطلب قبل المعالجة
async function validateOrderText(text: string, chatId: number): Promise<boolean> {
  const lines = text.split('\n').filter(line => line.trim());
  
  // التحقق من وجود رقم هاتف
  const phoneRegex = /^0?\d{10,11}$/;
  const hasPhone = lines.some(line => phoneRegex.test(line.replace(/[\s-]/g, '')));
  
  if (!hasPhone) {
    await sendEnhancedErrorMessage(chatId, 'missing_phone', {});
    return false;
  }
  
  // التحقق من وجود منتجات محتملة
  const hasProducts = lines.some(line => {
    const trimmed = line.trim();
    return trimmed.length > 3 && 
           !phoneRegex.test(trimmed.replace(/[\s-]/g, '')) &&
           !/(مدينة|حي|شارع|منطقة)/i.test(trimmed);
  });
  
  if (!hasProducts) {
    await sendEnhancedErrorMessage(chatId, 'missing_products', {});
    return false;
  }
  
  return true;
}

async function processOrderText(text: string, chatId: number, employeeCode: string) {
  try {
    // التحقق الذكي من صحة الطلب
    const isValid = await validateOrderText(text, chatId);
    if (!isValid) {
      return null;
    }
    
    console.log(`🔍 معالجة طلب ذكية للنص: ${text}`);
    
    const lines = text.split('\n').filter(line => line.trim());
    
    let customerName = '';
    let customerPhone = '';
    let customerAddress = '';
    let customerCity = '';
    let customerRegion = '';
    let cityId = null;
    let regionId = null;
    let items = [];
    let phoneFound = false;
    
    // معالجة كل سطر
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // التحقق من رقم الهاتف
      const phoneRegex = /^0?\d{10,11}$/;
      if (phoneRegex.test(line.replace(/[\s-]/g, ''))) {
        customerPhone = line.replace(/[\s-]/g, '');
        phoneFound = true;
        continue;
      }
      
      // التحقق من اسم العميل (الاسم الأول عادة)
      if (!customerName && i === 0 && isValidCustomerName(line)) {
        customerName = line;
        continue;
      }
      
      // معالجة العنوان بالذكاء الاصطناعي
      if (!customerCity) {
        const addressResult = await parseAddressLineSmart(line, chatId);
        if (addressResult) {
          customerAddress = addressResult.fullAddress;
          customerCity = addressResult.cityName;
          customerRegion = addressResult.regionName;
          cityId = addressResult.cityId;
          regionId = addressResult.regionId;
          console.log(`📍 تم تحليل العنوان بنجاح: ${customerCity} - ${customerRegion}`);
          continue;
        } else {
          // إذا فشل تحليل العنوان، أوقف المعالجة
          return null;
        }
      }
      
      // معالجة المنتجات
      if (line.length > 2) {
        const product = await parseProduct(line);
        if (product.name) {
          items.push(product);
        }
      }
    }
    
    // التحقق النهائي من البيانات
    if (!customerName) {
      await sendEnhancedErrorMessage(chatId, 'incomplete_order', {});
      return null;
    }
    
    if (!phoneFound) {
      await sendEnhancedErrorMessage(chatId, 'missing_phone', {});
      return null;
    }
    
    if (items.length === 0) {
      await sendEnhancedErrorMessage(chatId, 'missing_products', {});
      return null;
    }
    
    // إنشاء الطلب في قاعدة البيانات
    const orderData = {
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      customer_city: customerCity,
      customer_province: customerRegion,
      city_id: cityId,
      region_id: regionId,
      items: items,
      total_amount: 0,
      original_text: text,
      source: 'telegram',
      status: 'pending'
    };
    
    const { data, error } = await supabase
      .from('ai_orders')
      .insert(orderData)
      .select()
      .single();
    
    if (error) {
      console.error('خطأ في إنشاء الطلب:', error);
      await sendTelegramMessage(chatId, '❌ حدث خطأ في إنشاء الطلب. يرجى المحاولة مرة أخرى.');
      return null;
    }
    
    // إرسال تأكيد للمستخدم
    await sendTelegramMessage(chatId, 
      `✅ <b>تم إنشاء الطلب بنجاح!</b>\n\n` +
      `👤 العميل: ${customerName}\n` +
      `📞 الهاتف: ${customerPhone}\n` +
      `📍 العنوان: ${customerCity} - ${customerRegion}\n` +
      `📦 المنتجات: ${items.length} منتج\n\n` +
      `🔄 سيتم مراجعة الطلب وتأكيده قريباً.`,
      'HTML'
    );
    
    return data;
    
  } catch (error) {
    console.error('خطأ في معالجة الطلب:', error);
    await sendTelegramMessage(chatId, '❌ حدث خطأ في معالجة الطلب. يرجى المحاولة مرة أخرى.');
    return null;
  }
}

// ============= معالجة المنتجات =============

function isValidCustomerName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 2) return false;
  if (/^\d+$/.test(trimmed)) return false;
  if (/^[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/.test(trimmed)) return false;
  if (/07[5789]\d{8}/.test(trimmed)) return false;
  return true;
}

async function parseProduct(productText: string) {
  const text = productText.trim();
  
  // استخراج الكمية
  let quantity = 1;
  const quantityMatch = text.match(/[×x*]\s*(\d+)|(\d+)\s*[×x*]/);
  if (quantityMatch) {
    quantity = parseInt(quantityMatch[1] || quantityMatch[2]);
  }
  
  // استخراج المقاس
  let size = '';
  const sizeMatch = text.match(/\b(S|M|L|XL|XXL|XXXL|s|m|l|xl|xxl|xxxl|\d{2,3})\b/);
  if (sizeMatch) {
    size = sizeMatch[0].toUpperCase();
  }
  
  // استخراج اللون
  const colors = [
    'أزرق', 'ازرق', 'blue', 'أصفر', 'اصفر', 'yellow', 'أحمر', 'احمر', 'red', 
    'أخضر', 'اخضر', 'green', 'أبيض', 'ابيض', 'white', 'أسود', 'اسود', 'black', 
    'بني', 'brown', 'رمادي', 'gray', 'بنفسجي', 'purple', 'وردي', 'pink'
  ];
  
  let color = '';
  for (const c of colors) {
    if (text.toLowerCase().includes(c.toLowerCase())) {
      color = c;
      break;
    }
  }
  
  // استخراج اسم المنتج
  let productName = text
    .replace(/[×x*]\s*\d+|\d+\s*[×x*]/g, '') // إزالة الكمية
    .replace(/\b(S|M|L|XL|XXL|XXXL|s|m|l|xl|xxl|xxxl|\d{2,3})\b/gi, '') // إزالة المقاس
    .replace(/\s+/g, ' ')
    .trim();
  
  // إزالة اللون من الاسم
  if (color) {
    productName = productName.replace(new RegExp(color, 'gi'), '').replace(/\s+/g, ' ').trim();
  }
  
  return {
    name: productName || text,
    quantity: quantity,
    size: size,
    color: color,
    price: 0,
    product_id: null,
    variant_id: null
  };
}

// ============= المعالج الرئيسي =============

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔴 Telegram webhook called with AI system!');
    
    const update: TelegramUpdate = await req.json();
    console.log('Received update:', JSON.stringify(update, null, 2));

    if (!update.message || !update.message.text) {
      console.log('No message or text found in update');
      return new Response('OK', { status: 200 });
    }

    const chatId = update.message.chat.id;
    const text = update.message.text.trim();
    
    console.log(`Processing message from chatId: ${chatId}, text: "${text}"`);

    // التحقق من حالة المستخدم
    const employee = await getEmployeeByTelegramId(chatId);
    
    if (!employee) {
      // المستخدم غير مرتبط
      if (text.startsWith('/start')) {
        await sendTelegramMessage(chatId, `
🤖 <b>أهلاً وسهلاً بك في بوت RYUS الذكي!</b>

🎯 <b>هذا البوت يتميز بـ:</b>
• ذكاء اصطناعي لفهم الطلبات
• مطابقة ذكية للمدن والمناطق  
• اقتراحات تلقائية للأخطاء
• معالجة فورية للطلبات

🔗 <b>لربط حسابك:</b>
1️⃣ احصل على رمزك من موقع RYUS
2️⃣ أرسل الرمز هنا مباشرة
3️⃣ ابدأ في إرسال الطلبات!

💡 <b>مثال على طلب ذكي:</b>
أحمد علي
07501234567
ديوانية غماس
تيشيرت برشلونة أزرق XL

<i>أرسل رمزك الآن للبدء! 🚀</i>
        `, 'HTML');
        return new Response('OK', { status: 200 });
      }

      // محاولة ربط رمز الموظف
      if (/^[A-Z0-9]{6,8}$/i.test(text)) {
        const linked = await linkEmployeeCode(text.toUpperCase(), chatId);
        if (linked) {
          await sendTelegramMessage(chatId, `
🎉 <b>تم ربط حسابك بنجاح!</b>

🤖 <b>الآن يمكنك:</b>
• إرسال الطلبات بذكاء اصطناعي
• الحصول على اقتراحات فورية
• معالجة تلقائية للأخطاء الإملائية
• تصحيح أسماء المدن والمناطق

💡 <b>مثال على طلب:</b>
سارة محمد
07701234567
سماوه الخضر
فستان أحمر M + حقيبة سوداء

<i>جرب إرسال طلب الآن! 🛍️</i>
          `, 'HTML');
        } else {
          await sendTelegramMessage(chatId, '❌ رمز غير صحيح. يرجى التأكد من الرمز والمحاولة مرة أخرى.');
        }
        return new Response('OK', { status: 200 });
      }

      await sendTelegramMessage(chatId, 
        '❌ يجب ربط حسابك أولاً. أرسل /start للحصول على التعليمات.');
      return new Response('OK', { status: 200 });
    }

    // المستخدم مرتبط - معالجة الطلبات
    if (text.startsWith('/start') || text.startsWith('/help')) {
      await sendTelegramMessage(chatId, `
🎯 <b>مرحباً ${employee.full_name}!</b>

🤖 <b>النظام الذكي جاهز:</b>
• يفهم "ديوانية" = الديوانية - القادسية
• يتعرف على "اعظمية" = بغداد تلقائياً
• يصحح الأخطاء الإملائية تلقائياً
• يقترح المدن والمناطق المشابهة

📝 <b>صيغة الطلب:</b>
[اسم العميل]
[رقم الهاتف]
[المدينة والمنطقة]
[المنتجات مع اللون والمقاس]

💡 <b>أمثلة ذكية:</b>
أحمد علي
07501234567
ديوانية غماس
تيشيرت برشلونة أزرق XL

فاطمة حسن  
07701234567
اعظمية
فستان أحمر M + حقيبة سوداء

<i>أرسل طلبك الآن وشاهد السحر! ✨</i>
      `, 'HTML');
      return new Response('OK', { status: 200 });
    }

    // معالجة الطلب بالذكاء الاصطناعي
    await processOrderText(text, chatId, employee.employee_code);

    return new Response('OK', { status: 200 });
    
  } catch (error) {
    console.error('Error processing Telegram update:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
});