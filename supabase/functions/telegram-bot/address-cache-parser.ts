// نظام تحليل العناوين باستخدام cache المدن والمناطق من شركة التوصيل

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.30.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface AddressParts {
  customer_name?: string;
  city_id?: number;
  city_name?: string;
  region_id?: number;
  region_name?: string;
  remaining_text: string;
}

interface CityMatch {
  alwaseet_id: number;
  name: string;
  similarity_score: number;
}

interface RegionMatch {
  alwaseet_id: number;
  name: string;
  similarity_score: number;
}

// تنظيف النص وإزالة الحروف والكلمات غير المهمة
function cleanAddressText(text: string): string {
  return text
    .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0621-\u064A\u0660-\u0669a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// استخراج اسم الزبون من النص
function extractCustomerName(text: string): { name?: string; cleanedText: string } {
  const words = text.split(/\s+/);
  let customerName: string | undefined;
  let remainingWords = [...words];

  // البحث عن أنماط أسماء الزبائن
  const namePatterns = [
    /^([\u0621-\u064A]+)\s+[\u0621-\u064A]+/,  // اسم عربي من كلمتين
    /^([\u0621-\u064A]{2,})/,                   // اسم عربي من كلمة واحدة (3+ حروف)
  ];

  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match && match[1].length >= 3) {
      customerName = match[1];
      remainingWords = words.slice(1); // إزالة الكلمة الأولى
      break;
    }
  }

  return {
    name: customerName,
    cleanedText: remainingWords.join(' ')
  };
}

// البحث عن المدينة في cache
async function findCityInCache(searchText: string): Promise<CityMatch | null> {
  try {
    const { data, error } = await supabase.rpc('find_city_in_cache', {
      p_city_text: searchText
    });

    if (error) {
      console.error('❌ خطأ في البحث عن المدينة:', error);
      return null;
    }

    if (data && data.length > 0) {
      const bestMatch = data[0];
      console.log(`🏙️ وجدت مدينة: ${bestMatch.name} (نسبة التطابق: ${bestMatch.similarity_score})`);
      return bestMatch;
    }

    return null;
  } catch (error) {
    console.error('❌ خطأ في البحث عن المدينة:', error);
    return null;
  }
}

// البحث عن المنطقة في cache
async function findRegionInCache(cityId: number, searchText: string): Promise<RegionMatch | null> {
  try {
    const { data, error } = await supabase.rpc('find_region_in_cache', {
      p_city_id: cityId,
      p_region_text: searchText
    });

    if (error) {
      console.error('❌ خطأ في البحث عن المنطقة:', error);
      return null;
    }

    if (data && data.length > 0) {
      const bestMatch = data[0];
      console.log(`🏘️ وجدت منطقة: ${bestMatch.name} (نسبة التطابق: ${bestMatch.similarity_score})`);
      return bestMatch;
    }

    return null;
  } catch (error) {
    console.error('❌ خطأ في البحث عن المنطقة:', error);
    return null;
  }
}

// تحليل العنوان بالكامل
export async function parseAddressWithCache(addressText: string): Promise<AddressParts> {
  console.log(`🔍 تحليل العنوان: "${addressText}"`);
  
  const cleanedText = cleanAddressText(addressText);
  console.log(`🧹 النص المنظف: "${cleanedText}"`);

  // استخراج اسم الزبون
  const { name: customerName, cleanedText: textWithoutName } = extractCustomerName(cleanedText);
  console.log(`👤 اسم الزبون: ${customerName || 'غير محدد'}`);
  console.log(`📍 النص بدون الاسم: "${textWithoutName}"`);

  const words = textWithoutName.split(/\s+/).filter(word => word.length > 1);
  
  let cityMatch: CityMatch | null = null;
  let regionMatch: RegionMatch | null = null;
  let usedWordIndices: Set<number> = new Set();

  // البحث عن المدينة (تجربة كلمة واحدة أو أكثر)
  for (let i = 0; i < words.length; i++) {
    if (usedWordIndices.has(i)) continue;

    // تجربة كلمة واحدة
    cityMatch = await findCityInCache(words[i]);
    if (cityMatch && cityMatch.similarity_score >= 0.7) {
      usedWordIndices.add(i);
      console.log(`✅ وجدت مدينة بكلمة واحدة: ${cityMatch.name}`);
      break;
    }

    // تجربة كلمتين متتاليتين
    if (i < words.length - 1) {
      const twoWords = `${words[i]} ${words[i + 1]}`;
      cityMatch = await findCityInCache(twoWords);
      if (cityMatch && cityMatch.similarity_score >= 0.7) {
        usedWordIndices.add(i);
        usedWordIndices.add(i + 1);
        console.log(`✅ وجدت مدينة بكلمتين: ${cityMatch.name}`);
        break;
      }
    }

    cityMatch = null; // إعادة تعيين إذا لم نجد مطابقة جيدة
  }

  // البحث عن المنطقة إذا وُجدت المدينة
  if (cityMatch) {
    const remainingWords = words.filter((_, index) => !usedWordIndices.has(index));
    
    for (let i = 0; i < remainingWords.length; i++) {
      // تجربة كلمة واحدة
      regionMatch = await findRegionInCache(cityMatch.alwaseet_id, remainingWords[i]);
      if (regionMatch && regionMatch.similarity_score >= 0.7) {
        usedWordIndices.add(words.indexOf(remainingWords[i]));
        console.log(`✅ وجدت منطقة بكلمة واحدة: ${regionMatch.name}`);
        break;
      }

      // تجربة كلمتين متتاليتين
      if (i < remainingWords.length - 1) {
        const twoWords = `${remainingWords[i]} ${remainingWords[i + 1]}`;
        regionMatch = await findRegionInCache(cityMatch.alwaseet_id, twoWords);
        if (regionMatch && regionMatch.similarity_score >= 0.7) {
          usedWordIndices.add(words.indexOf(remainingWords[i]));
          usedWordIndices.add(words.indexOf(remainingWords[i + 1]));
          console.log(`✅ وجدت منطقة بكلمتين: ${regionMatch.name}`);
          break;
        }
      }

      // تجربة ثلاث كلمات متتالية للمناطق المركبة
      if (i < remainingWords.length - 2) {
        const threeWords = `${remainingWords[i]} ${remainingWords[i + 1]} ${remainingWords[i + 2]}`;
        regionMatch = await findRegionInCache(cityMatch.alwaseet_id, threeWords);
        if (regionMatch && regionMatch.similarity_score >= 0.7) {
          usedWordIndices.add(words.indexOf(remainingWords[i]));
          usedWordIndices.add(words.indexOf(remainingWords[i + 1]));
          usedWordIndices.add(words.indexOf(remainingWords[i + 2]));
          console.log(`✅ وجدت منطقة بثلاث كلمات: ${regionMatch.name}`);
          break;
        }
      }

      regionMatch = null; // إعادة تعيين إذا لم نجد مطابقة جيدة
    }
  }

  // تكوين النص المتبقي
  const remainingWords = words.filter((_, index) => !usedWordIndices.has(index));
  const remainingText = remainingWords.join(' ').trim();

  const result: AddressParts = {
    customer_name: customerName,
    city_id: cityMatch?.alwaseet_id,
    city_name: cityMatch?.name,
    region_id: regionMatch?.alwaseet_id,
    region_name: regionMatch?.name,
    remaining_text: remainingText || textWithoutName
  };

  console.log('🎯 نتيجة التحليل:', {
    customer_name: result.customer_name,
    city: result.city_name,
    region: result.region_name,
    remaining: result.remaining_text
  });

  return result;
}