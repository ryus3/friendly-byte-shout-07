// دوال مساعدة لتحليل العناوين بذكاء

interface AddressParts {
  city: string | null;
  region: string | null;
  remainingText: string;
}

// دالة تحليل العنوان الذكية
export async function parseAddressLine(addressText: string): Promise<AddressParts> {
  if (!addressText) return { city: null, region: null, remainingText: '' };

  const text = addressText.trim();
  const words = text.split(/\s+/);
  
  // قاموس المدن العراقية وتنويعاتها
  const cityVariants = {
    'بغداد': ['بغداد', 'baghdad', 'بكداد'],
    'البصرة': ['بصرة', 'بصره', 'البصرة', 'البصره', 'basra', 'basrah'],
    'أربيل': ['أربيل', 'اربيل', 'erbil', 'hawler'],
    'الموصل': ['موصل', 'الموصل', 'mosul'],
    'كربلاء': ['كربلاء', 'كربلا', 'karbala'],
    'النجف': ['نجف', 'النجف', 'najaf'],
    'بابل': ['بابل', 'الحلة', 'babel', 'hilla'],
    'ذي قار': ['ذي قار', 'ذيقار', 'الناصرية', 'nasiriyah'],
    'ديالى': ['ديالى', 'ديالا', 'بعقوبة', 'diyala'],
    'الأنبار': ['انبار', 'الانبار', 'الأنبار', 'الرمادي', 'anbar'],
    'صلاح الدين': ['صلاح الدين', 'تكريت', 'tikrit'],
    'واسط': ['واسط', 'الكوت', 'wasit'],
    'المثنى': ['مثنى', 'المثنى', 'السماوة', 'samawah'],
    'القادسية': ['قادسية', 'القادسية', 'الديوانية', 'diwaniyah'],
    'كركوك': ['كركوك', 'kirkuk'],
    'دهوك': ['دهوك', 'duhok'],
    'السليمانية': ['سليمانية', 'السليمانية', 'sulaymaniyah'],
    'ميسان': ['ميسان', 'العمارة', 'maysan']
  };

  // قاموس المناطق الشائعة لكل مدينة مع أولويات (الأطول أولاً)
  const regionPatterns = {
    'بغداد': [
      // مناطق مركبة طويلة (أولوية عالية جداً)
      'دورة حي الصحة', 'دورة صحة', 'كرادة داخل', 'كرادة خارج', 
      'مدينة الصدر', 'حي الصدر', 'مدينة العمال', 'شارع فلسطين',
      'حي العدل', 'حي الجامعة', 'حي البياع', 'حي الغدير',
      'حي الأطباء', 'حي الصالحية', 'حي الكريمات', 'حي الجزائر',
      'الدورة اسكان', 'الدورة الصحة', 'كفتئات الصحة',
      // مناطق مفردة (أولوية أقل)
      'الدورة', 'الكرادة', 'الكاظمية', 'الأعظمية', 'المنصور', 
      'الرصافة', 'الكرخ', 'الشعلة', 'البياع', 'الغدير',
      'الصدر', 'العدل', 'الجامعة', 'الصالحية', 'الكريمات'
    ],
    'البصرة': [
      'الجمهورية', 'الأسماك', 'العشار', 'المعقل', 'الفيحاء',
      'كرمة علي', 'حي الحسين', 'حي الجزائر'
    ],
    'أربيل': [
      'عنكاوا', 'شورش', 'باختياري', 'قلاوري'
    ]
  };

  let detectedCity: string | null = null;
  let detectedRegion: string | null = null;
  let cityIndex = -1;
  let regionStartIndex = -1;
  let regionEndIndex = -1;

  // البحث عن المدينة أولاً
  for (const [cityName, variants] of Object.entries(cityVariants)) {
    for (let i = 0; i < words.length; i++) {
      const word = words[i].toLowerCase();
      if (variants.some(variant => variant.toLowerCase() === word)) {
        detectedCity = cityName;
        cityIndex = i;
        break;
      }
    }
    if (detectedCity) break;
  }

  // إذا وُجدت المدينة، ابحث عن المنطقة بذكاء
  if (detectedCity && regionPatterns[detectedCity]) {
    const regions = regionPatterns[detectedCity];
    const fullText = text.toLowerCase();
    
    // خوارزمية ذكية للبحث عن أفضل مطابقة
    let bestMatch = null;
    let bestScore = 0;
    
    for (const region of regions) {
      const regionLower = region.toLowerCase();
      const regionWords = regionLower.split(/\s+/);
      
      // البحث عن مطابقة كاملة أولاً
      if (fullText.includes(regionLower)) {
        const score = regionLower.length; // المنطقة الأطول لها نقاط أكثر
        if (score > bestScore) {
          bestMatch = region;
          bestScore = score;
          
          // العثور على موقع المنطقة في النص
          const startPos = fullText.indexOf(regionLower);
          const beforeText = fullText.substring(0, startPos);
          const wordsBefore = beforeText.split(/\s+/).length - 1;
          regionStartIndex = Math.max(0, wordsBefore);
          regionEndIndex = regionStartIndex + regionWords.length - 1;
        }
      }
      // البحث عن مطابقة جزئية ذكية للمناطق المركبة
      else if (regionWords.length > 1) {
        let foundWordsCount = 0;
        for (const word of regionWords) {
          if (fullText.includes(word)) {
            foundWordsCount++;
          }
        }
        // إذا وُجدت معظم كلمات المنطقة
        if (foundWordsCount >= Math.ceil(regionWords.length * 0.7)) {
          const score = foundWordsCount * regionLower.length * 0.5; // نقاط أقل للمطابقة الجزئية
          if (score > bestScore) {
            bestMatch = region;
            bestScore = score;
            regionStartIndex = cityIndex + 1;
            regionEndIndex = cityIndex + 1;
          }
        }
      }
    }
    
    detectedRegion = bestMatch;
  }

  // تحديد النص المتبقي (أقرب نقطة دالة) بطريقة ذكية
  let remainingText = text;
  
  // إزالة المدينة المكتشفة
  if (detectedCity) {
    const cityVariants = cityVariants[detectedCity] || [detectedCity];
    for (const variant of cityVariants) {
      const regex = new RegExp(`\\b${variant}\\b`, 'gi');
      remainingText = remainingText.replace(regex, '').trim();
    }
  }
  
  // إزالة المنطقة المكتشفة
  if (detectedRegion) {
    const regex = new RegExp(`\\b${detectedRegion.replace(/\s+/g, '\\s+')}\\b`, 'gi');
    remainingText = remainingText.replace(regex, '').trim();
  }
  
  // إزالة أرقام الهواتف العراقية
  remainingText = remainingText.replace(/\b07[5789]\d{8}\b/g, '').trim();
  
  // إزالة كلمات لا تصلح كأقرب نقطة دالة
  const unwantedWords = ['استلام', 'محلي', 'توصيل', 'طلب', 'زبون', 'من', 'في', 'على', 'عند', 'قرب', 'مقابل'];
  for (const word of unwantedWords) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    remainingText = remainingText.replace(regex, '').trim();
  }
  
  // تنظيف المسافات الزائدة والرموز
  remainingText = remainingText.replace(/\s+/g, ' ').replace(/[,،\-\s]+$/, '').trim();

  return {
    city: detectedCity,
    region: detectedRegion,
    remainingText: remainingText
  };
}

// دالة البحث الذكي للمناطق (تعطي أولوية للمطابقات الأدق)
export function findRegionsByName(cityName: string, regionText: string): string[] {
  if (!regionText || !cityName) return [];

  const regionPatterns = {
    'بغداد': [
      'دورة حي الصحة', 'دورة صحة', 'كرادة داخل', 'كرادة خارج', 
      'مدينة الصدر', 'حي الصدر', 'مدينة العمال', 'شارع فلسطين',
      'حي العدل', 'حي الجامعة', 'حي البياع', 'حي الغدير',
      'الدورة اسكان', 'الدورة الصحة', 'كفتئات الصحة',
      'الدورة', 'الكرادة', 'الكاظمية', 'الأعظمية', 'المنصور'
    ]
  };

  const availableRegions = regionPatterns[cityName] || [];
  const searchText = regionText.toLowerCase().trim();
  
  // البحث عن مطابقة كاملة أولاً
  const exactMatch = availableRegions.find(region => 
    region.toLowerCase() === searchText
  );
  
  if (exactMatch) return [exactMatch];
  
  // البحث عن مطابقة جزئية مع أولوية للأطول
  const partialMatches = availableRegions
    .filter(region => region.toLowerCase().includes(searchText))
    .sort((a, b) => b.length - a.length); // الأطول أولاً
    
  return partialMatches;
}