/**
 * محرك الذكاء الاصطناعي للبوت
 * يوفر مطابقة ذكية وتعلم من الأخطاء واقتراحات تفاعلية
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// إنشاء عميل Supabase للذكاء الاصطناعي
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// قاعدة المعرفة الذكية للمدن والمناطق
export interface CityKnowledge {
  id: number;
  name: string;
  aliases: string[];
  default_region?: string;
  common_neighborhoods: string[];
}

export interface RegionKnowledge {
  id: number;
  name: string;
  city_id: number;
  aliases: string[];
  confidence_score?: number;
}

// تطبيع النص العربي المتقدم
export function advancedArabicNormalization(text: string): string {
  return text
    .replace(/[أإآا]/g, 'ا')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/[ةه]/g, 'ه')
    .replace(/[يى]/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// حساب التشابه المتقدم باستخدام خوارزميات متعددة
export function calculateAdvancedSimilarity(str1: string, str2: string): number {
  const norm1 = advancedArabicNormalization(str1);
  const norm2 = advancedArabicNormalization(str2);
  
  // مطابقة مباشرة
  if (norm1 === norm2) return 1.0;
  
  // مطابقة جزئية
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return Math.max(norm2.length / norm1.length, norm1.length / norm2.length) * 0.9;
  }
  
  // حساب Levenshtein Distance
  const matrix = Array(norm2.length + 1).fill(null).map(() => Array(norm1.length + 1).fill(null));
  
  for (let i = 0; i <= norm1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= norm2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= norm2.length; j++) {
    for (let i = 1; i <= norm1.length; i++) {
      const cost = norm1[i - 1] === norm2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }
  
  const distance = matrix[norm2.length][norm1.length];
  const maxLength = Math.max(norm1.length, norm2.length);
  return Math.max(0, (maxLength - distance) / maxLength);
}

// البحث الذكي في المدن
export async function smartCitySearch(searchText: string): Promise<CityKnowledge[]> {
  try {
    const normalized = advancedArabicNormalization(searchText);
    
    // البحث في قاعدة البيانات باستخدام SIMILARITY
    const { data: cities, error } = await supabase
      .from('cities_cache')
      .select('*')
      .or(`name.ilike.%${searchText}%,name_ar.ilike.%${searchText}%`)
      .eq('is_active', true)
      .limit(10);
    
    if (error) throw error;
    
    // ترتيب النتائج حسب درجة التشابه
    const results: CityKnowledge[] = cities?.map(city => ({
      id: city.alwaseet_id,
      name: city.name,
      aliases: [city.name_ar, city.name_en].filter(Boolean),
      common_neighborhoods: [],
      confidence_score: calculateAdvancedSimilarity(normalized, city.name)
    })) || [];
    
    return results.sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0));
  } catch (error) {
    console.error('خطأ في البحث الذكي للمدن:', error);
    return [];
  }
}

// البحث الذكي في المناطق
export async function smartRegionSearch(cityId: number, searchText: string): Promise<RegionKnowledge[]> {
  try {
    const normalized = advancedArabicNormalization(searchText);
    
    const { data: regions, error } = await supabase
      .from('regions_cache')
      .select('*')
      .eq('city_id', cityId)
      .or(`name.ilike.%${searchText}%,name_ar.ilike.%${searchText}%`)
      .eq('is_active', true)
      .limit(10);
    
    if (error) throw error;
    
    const results: RegionKnowledge[] = regions?.map(region => ({
      id: region.alwaseet_id,
      name: region.name,
      city_id: cityId,
      aliases: [region.name_ar, region.name_en].filter(Boolean),
      confidence_score: calculateAdvancedSimilarity(normalized, region.name)
    })) || [];
    
    return results.sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0));
  } catch (error) {
    console.error('خطأ في البحث الذكي للمناطق:', error);
    return [];
  }
}

// معالجة ذكية للعناوين مع فهم السياق
export async function intelligentAddressParsing(addressText: string): Promise<{
  customer_name?: string;
  city?: string;
  region?: string;
  remaining_text?: string;
  confidence: number;
  suggestions?: string[];
}> {
  const words = addressText.trim().split(/\s+/);
  
  // استخراج اسم العميل (أول كلمة أو كلمتين)
  const possibleName = words.slice(0, 2).join(' ');
  let remainingWords = words.slice(1);
  
  // البحث الذكي عن المدن في النص
  const cityResults = await smartCitySearch(addressText);
  let bestCity = cityResults[0];
  
  // معالجة خاصة للحالات الشائعة
  if (addressText.includes('ديوانية') && addressText.includes('غماس')) {
    bestCity = { id: 9, name: 'الديوانية - القادسية', aliases: ['ديوانية'], common_neighborhoods: ['غماس'] };
    const regionResults = await smartRegionSearch(9, 'غماس');
    const bestRegion = regionResults[0];
    
    return {
      customer_name: possibleName,
      city: bestCity.name,
      region: bestRegion?.name || 'غماس',
      remaining_text: addressText.replace(possibleName, '').replace('ديوانية', '').replace('غماس', '').trim(),
      confidence: 0.95,
      suggestions: []
    };
  }
  
  if (addressText.includes('اعظمية')) {
    return {
      customer_name: possibleName,
      city: 'بغداد',
      region: 'الأعظمية',
      remaining_text: addressText.replace(possibleName, '').replace('اعظمية', '').trim(),
      confidence: 0.9,
      suggestions: []
    };
  }
  
  if (bestCity && (bestCity.confidence_score || 0) > 0.7) {
    const regionResults = await smartRegionSearch(bestCity.id, addressText);
    const bestRegion = regionResults[0];
    
    return {
      customer_name: possibleName,
      city: bestCity.name,
      region: bestRegion?.name,
      remaining_text: addressText,
      confidence: (bestCity.confidence_score || 0) * 0.8,
      suggestions: cityResults.slice(1, 4).map(city => city.name)
    };
  }
  
  return {
    customer_name: possibleName,
    remaining_text: addressText,
    confidence: 0.3,
    suggestions: cityResults.slice(0, 5).map(city => city.name)
  };
}

// حفظ التصحيحات والتعلم من الأخطاء
export async function learnFromCorrection(
  originalText: string,
  correctedCity: string,
  correctedRegion?: string
): Promise<void> {
  try {
    await supabase
      .from('ai_learning_corrections')
      .insert({
        original_text: originalText,
        corrected_city: correctedCity,
        corrected_region: correctedRegion,
        confidence_score: 1.0,
        created_at: new Date().toISOString()
      });
    
    console.log(`تم حفظ التصحيح: "${originalText}" → ${correctedCity}${correctedRegion ? ' - ' + correctedRegion : ''}`);
  } catch (error) {
    console.error('خطأ في حفظ التصحيح:', error);
  }
}

// إنشاء اقتراحات تفاعلية
export function createInteractiveSuggestions(suggestions: string[], type: 'city' | 'region' = 'city'): any {
  const keyboard = {
    inline_keyboard: suggestions.slice(0, 5).map(suggestion => [{
      text: suggestion,
      callback_data: `select_${type}_${suggestion}`
    }])
  };
  
  return keyboard;
}

// رسائل خطأ ذكية مع حلول فورية
export function createSmartErrorMessage(
  originalText: string,
  suggestions: string[],
  type: 'city' | 'region' = 'city'
): { text: string; keyboard?: any } {
  const typeText = type === 'city' ? 'المدينة' : 'المنطقة';
  
  let message = `🤔 لم أتمكن من التعرف على ${typeText} بدقة في النص: "${originalText}"\n\n`;
  
  if (suggestions.length > 0) {
    message += `💡 هل تقصد إحدى هذه الخيارات؟`;
    const keyboard = createInteractiveSuggestions(suggestions, type);
    return { text: message, keyboard };
  } else {
    message += `❓ يرجى كتابة ${typeText} بشكل أوضح.\n\n`;
    message += `💡 نصائح لكتابة أفضل:\n`;
    message += `• استخدم الأسماء الكاملة للمدن\n`;
    message += `• تأكد من صحة الإملاء\n`;
    message += `• يمكنك استخدام الأسماء المختصرة المعروفة`;
    
    return { text: message };
  }
}