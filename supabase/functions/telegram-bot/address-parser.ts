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

  // قاموس المناطق الشائعة لكل مدينة مع أولويات ومتغيرات ذكية
  const regionPatterns = {
    'بغداد': [
      // مناطق مركبة (أولوية أعلى) مع متغيراتها
      'دورة حي الصحة', 'دورة صحة', 'الدورة الصحة', 'الدورة حي الصحة',
      'كرادة داخل', 'كرادة خارج', 'الكرادة الداخل', 'الكرادة الخارج',
      'مدينة الصدر', 'حي الصدر', 'الصدر الاولى', 'الصدر الثانية',
      'مدينة العمال', 'حي العمال', 'شارع فلسطين', 'فلسطين',
      'حي العدل', 'حي الجامعة', 'حي البياع', 'حي الغدير',
      'حي الأطباء', 'حي الصالحية', 'حي الكريمات', 'حي الجزائر',
      'حي الجهاد', 'حي الشهداء', 'حي الوحدة', 'حي السلام',
      // مناطق مفردة
      'الدورة', 'الكرادة', 'الكاظمية', 'الأعظمية', 'المنصور', 
      'الرصافة', 'الكرخ', 'الشعلة', 'البياع', 'الغدير',
      'الصدر', 'العدل', 'الجامعة', 'الصالحية', 'الكريمات',
      'الجهاد', 'الوحدة', 'السلام', 'الشهداء'
    ],
    'البصرة': [
      'الجمهورية', 'الأسماك', 'العشار', 'المعقل', 'الفيحاء',
      'كرمة علي', 'حي الحسين', 'حي الجزائر', 'الطويسة',
      'أبو الخصيب', 'الزبير', 'صفوان'
    ],
    'أربيل': [
      'عنكاوا', 'شورش', 'باختياري', 'قلاوري', 'تايران',
      'دارا تو', 'شاخوان'
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

  // إذا وُجدت المدينة، ابحث عن المنطقة
  if (detectedCity && regionPatterns[detectedCity]) {
    const regions = regionPatterns[detectedCity];
    const textAfterCity = words.slice(cityIndex + 1).join(' ').toLowerCase();
    
  // البحث عن المناطق بطريقة ذكية - المناطق الأطول أولاً
    const sortedRegions = regions.sort((a, b) => b.length - a.length);
    
    for (const region of sortedRegions) {
      const regionWords = region.split(/\s+/);
      
      // البحث عن مطابقة كاملة للمنطقة
      for (let i = cityIndex + 1; i <= words.length - regionWords.length; i++) {
        const candidateRegion = words.slice(i, i + regionWords.length).join(' ').toLowerCase();
        if (candidateRegion === region.toLowerCase()) {
          detectedRegion = region;
          regionStartIndex = i;
          regionEndIndex = i + regionWords.length - 1;
          break;
        }
      }
      
      // إذا لم نجد مطابقة كاملة، ابحث عن مطابقة جزئية ذكية
      if (!detectedRegion) {
        for (let i = cityIndex + 1; i < words.length; i++) {
          const candidateText = words.slice(i).join(' ').toLowerCase();
          const regionLower = region.toLowerCase();
          
          // مطابقة ذكية للمناطق المركبة مثل "دورة حي الصحة" مع "دورة صحة"
          if (regionLower.includes('دورة') && regionLower.includes('صحة') && 
              candidateText.includes('دورة') && candidateText.includes('صحة')) {
            detectedRegion = region;
            regionStartIndex = i;
            regionEndIndex = Math.min(i + 2, words.length - 1); // أخذ كلمتين كحد أقصى
            break;
          }
          
          // مطابقة للمناطق التي تحتوي على "حي"
          if (regionLower.includes('حي') && candidateText.includes(regionLower.replace(/حي\s*/, '').trim())) {
            detectedRegion = region;
            regionStartIndex = i;
            regionEndIndex = Math.min(i + 1, words.length - 1);
            break;
          }
        }
      }
      
      if (detectedRegion) break;
    }
  }

  // تحديد النص المتبقي (اقرب نقطة دالة)
  let remainingWords = [...words];
  
  // إزالة المدينة
  if (cityIndex !== -1) {
    remainingWords.splice(cityIndex, 1);
    // تعديل فهارس المنطقة بعد إزالة المدينة
    if (regionStartIndex > cityIndex) {
      regionStartIndex--;
      regionEndIndex--;
    }
  }
  
  // إزالة المنطقة إن وُجدت
  if (regionStartIndex !== -1 && regionEndIndex !== -1) {
    const regionLength = regionEndIndex - regionStartIndex + 1;
    remainingWords.splice(regionStartIndex, regionLength);
  }

  const remainingText = remainingWords.join(' ').trim();

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
      'دورة صحة', 'دورة حي الصحة', 'كرادة داخل', 'كرادة خارج', 
      'مدينة الصدر', 'حي الصدر', 'مدينة العمال', 'شارع فلسطين',
      'حي العدل', 'حي الجامعة', 'حي البياع', 'حي الغدير',
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