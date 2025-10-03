// قاموس شامل للمرادفات الشائعة للمدن العراقية الـ18
// يشمل: الأخطاء الإملائية، الأسماء الإنجليزية، البدائل العامية

export const iraqCitiesCommonAliases = {
  1: { // بغداد
    name: "بغداد",
    alwaseet_id: 1,
    aliases: [
      { text: "baghdad", confidence: 1.0, type: "english" },
      { text: "Baghdad", confidence: 1.0, type: "english" },
      { text: "بقداد", confidence: 0.9, type: "misspelling" },
      { text: "بغدد", confidence: 0.9, type: "misspelling" },
      { text: "بغدا", confidence: 0.9, type: "misspelling" },
      { text: "بقدد", confidence: 0.8, type: "misspelling" },
      { text: "العاصمة", confidence: 1.0, type: "alternative" },
      { text: "عاصمة", confidence: 0.9, type: "alternative" },
      { text: "bgd", confidence: 0.7, type: "abbreviation" },
    ]
  },
  2: { // البصرة
    name: "البصرة",
    alwaseet_id: 2,
    aliases: [
      { text: "basra", confidence: 1.0, type: "english" },
      { text: "Basra", confidence: 1.0, type: "english" },
      { text: "البصره", confidence: 0.9, type: "misspelling" },
      { text: "بصرة", confidence: 1.0, type: "alternative" },
      { text: "بصره", confidence: 0.9, type: "misspelling" },
      { text: "الفيحاء", confidence: 1.0, type: "alternative" },
      { text: "فيحاء", confidence: 0.9, type: "alternative" },
      { text: "بصره", confidence: 0.8, type: "misspelling" },
    ]
  },
  3: { // نينوى
    name: "نينوى",
    alwaseet_id: 3,
    aliases: [
      { text: "nineveh", confidence: 1.0, type: "english" },
      { text: "Nineveh", confidence: 1.0, type: "english" },
      { text: "ninawa", confidence: 1.0, type: "english" },
      { text: "Ninawa", confidence: 1.0, type: "english" },
      { text: "نينوا", confidence: 0.9, type: "misspelling" },
      { text: "نينوئ", confidence: 0.8, type: "misspelling" },
      { text: "الموصل", confidence: 1.0, type: "alternative" },
      { text: "موصل", confidence: 1.0, type: "alternative" },
      { text: "الحدباء", confidence: 0.9, type: "alternative" },
    ]
  },
  4: { // أربيل
    name: "أربيل",
    alwaseet_id: 4,
    aliases: [
      { text: "erbil", confidence: 1.0, type: "english" },
      { text: "Erbil", confidence: 1.0, type: "english" },
      { text: "arbil", confidence: 1.0, type: "english" },
      { text: "Arbil", confidence: 1.0, type: "english" },
      { text: "اربيل", confidence: 1.0, type: "alternative" },
      { text: "اربل", confidence: 0.9, type: "misspelling" },
      { text: "أربل", confidence: 0.9, type: "misspelling" },
      { text: "هولير", confidence: 0.9, type: "kurdish" },
      { text: "هەولێر", confidence: 0.9, type: "kurdish" },
    ]
  },
  5: { // السليمانية
    name: "السليمانية",
    alwaseet_id: 5,
    aliases: [
      { text: "sulaymaniyah", confidence: 1.0, type: "english" },
      { text: "Sulaymaniyah", confidence: 1.0, type: "english" },
      { text: "sulaimaniya", confidence: 1.0, type: "english" },
      { text: "Sulaimaniya", confidence: 1.0, type: "english" },
      { text: "سليمانيه", confidence: 0.9, type: "misspelling" },
      { text: "سليمانية", confidence: 1.0, type: "alternative" },
      { text: "سليماني", confidence: 0.8, type: "misspelling" },
      { text: "سلێمانی", confidence: 0.9, type: "kurdish" },
    ]
  },
  6: { // دهوك
    name: "دهوك",
    alwaseet_id: 6,
    aliases: [
      { text: "duhok", confidence: 1.0, type: "english" },
      { text: "Duhok", confidence: 1.0, type: "english" },
      { text: "dahuk", confidence: 1.0, type: "english" },
      { text: "Dahuk", confidence: 1.0, type: "english" },
      { text: "دهوك", confidence: 1.0, type: "alternative" },
      { text: "دهوق", confidence: 0.9, type: "misspelling" },
      { text: "دهوگ", confidence: 0.8, type: "misspelling" },
      { text: "دهۆك", confidence: 0.9, type: "kurdish" },
    ]
  },
  7: { // كركوك
    name: "كركوك",
    alwaseet_id: 7,
    aliases: [
      { text: "kirkuk", confidence: 1.0, type: "english" },
      { text: "Kirkuk", confidence: 1.0, type: "english" },
      { text: "karkuk", confidence: 0.9, type: "english" },
      { text: "Karkuk", confidence: 0.9, type: "english" },
      { text: "كرکوک", confidence: 0.9, type: "misspelling" },
      { text: "كركوگ", confidence: 0.8, type: "misspelling" },
      { text: "کرکوک", confidence: 0.9, type: "kurdish" },
    ]
  },
  8: { // الأنبار
    name: "الأنبار",
    alwaseet_id: 8,
    aliases: [
      { text: "anbar", confidence: 1.0, type: "english" },
      { text: "Anbar", confidence: 1.0, type: "english" },
      { text: "al-anbar", confidence: 1.0, type: "english" },
      { text: "Al-Anbar", confidence: 1.0, type: "english" },
      { text: "الانبار", confidence: 1.0, type: "alternative" },
      { text: "انبار", confidence: 1.0, type: "alternative" },
      { text: "الرمادي", confidence: 0.9, type: "alternative" },
      { text: "رمادي", confidence: 0.9, type: "alternative" },
    ]
  },
  9: { // صلاح الدين
    name: "صلاح الدين",
    alwaseet_id: 9,
    aliases: [
      { text: "salahuddin", confidence: 1.0, type: "english" },
      { text: "Salahuddin", confidence: 1.0, type: "english" },
      { text: "salah al-din", confidence: 1.0, type: "english" },
      { text: "Salah Al-Din", confidence: 1.0, type: "english" },
      { text: "صلاح", confidence: 0.8, type: "abbreviation" },
      { text: "صلاحدين", confidence: 0.9, type: "misspelling" },
      { text: "تكريت", confidence: 0.9, type: "alternative" },
      { text: "tikrit", confidence: 0.9, type: "english" },
    ]
  },
  10: { // ديالى
    name: "ديالى",
    alwaseet_id: 10,
    aliases: [
      { text: "diyala", confidence: 1.0, type: "english" },
      { text: "Diyala", confidence: 1.0, type: "english" },
      { text: "diyali", confidence: 0.9, type: "english" },
      { text: "Diyali", confidence: 0.9, type: "english" },
      { text: "ديالا", confidence: 0.9, type: "misspelling" },
      { text: "ديالي", confidence: 0.9, type: "misspelling" },
      { text: "بعقوبة", confidence: 0.9, type: "alternative" },
      { text: "بعقوبه", confidence: 0.8, type: "misspelling" },
    ]
  },
  11: { // واسط
    name: "واسط",
    alwaseet_id: 11,
    aliases: [
      { text: "wasit", confidence: 1.0, type: "english" },
      { text: "Wasit", confidence: 1.0, type: "english" },
      { text: "waset", confidence: 0.9, type: "english" },
      { text: "Waset", confidence: 0.9, type: "english" },
      { text: "واسيط", confidence: 0.8, type: "misspelling" },
      { text: "الكوت", confidence: 1.0, type: "alternative" },
      { text: "كوت", confidence: 1.0, type: "alternative" },
      { text: "الكوط", confidence: 0.8, type: "misspelling" },
    ]
  },
  12: { // بابل
    name: "بابل",
    alwaseet_id: 12,
    aliases: [
      { text: "babylon", confidence: 1.0, type: "english" },
      { text: "Babylon", confidence: 1.0, type: "english" },
      { text: "babil", confidence: 1.0, type: "english" },
      { text: "Babil", confidence: 1.0, type: "english" },
      { text: "بابيل", confidence: 0.9, type: "misspelling" },
      { text: "الحلة", confidence: 1.0, type: "alternative" },
      { text: "حلة", confidence: 1.0, type: "alternative" },
      { text: "الحله", confidence: 0.9, type: "misspelling" },
    ]
  },
  13: { // كربلاء
    name: "كربلاء",
    alwaseet_id: 13,
    aliases: [
      { text: "karbala", confidence: 1.0, type: "english" },
      { text: "Karbala", confidence: 1.0, type: "english" },
      { text: "kerbala", confidence: 0.9, type: "english" },
      { text: "Kerbala", confidence: 0.9, type: "english" },
      { text: "كربلائ", confidence: 0.9, type: "misspelling" },
      { text: "کربلاء", confidence: 0.9, type: "misspelling" },
      { text: "كربله", confidence: 0.8, type: "misspelling" },
      { text: "كربل", confidence: 0.7, type: "abbreviation" },
    ]
  },
  14: { // النجف
    name: "النجف",
    alwaseet_id: 14,
    aliases: [
      { text: "najaf", confidence: 1.0, type: "english" },
      { text: "Najaf", confidence: 1.0, type: "english" },
      { text: "an-najaf", confidence: 1.0, type: "english" },
      { text: "An-Najaf", confidence: 1.0, type: "english" },
      { text: "النجاف", confidence: 0.9, type: "misspelling" },
      { text: "نجف", confidence: 1.0, type: "alternative" },
      { text: "نجاف", confidence: 0.8, type: "misspelling" },
      { text: "النجف الاشرف", confidence: 1.0, type: "alternative" },
    ]
  },
  15: { // القادسية
    name: "القادسية",
    alwaseet_id: 15,
    aliases: [
      { text: "qadisiyyah", confidence: 1.0, type: "english" },
      { text: "Qadisiyyah", confidence: 1.0, type: "english" },
      { text: "al-qadisiyyah", confidence: 1.0, type: "english" },
      { text: "Al-Qadisiyyah", confidence: 1.0, type: "english" },
      { text: "القادسيه", confidence: 0.9, type: "misspelling" },
      { text: "قادسية", confidence: 1.0, type: "alternative" },
      { text: "الديوانية", confidence: 1.0, type: "alternative" },
      { text: "ديوانية", confidence: 1.0, type: "alternative" },
      { text: "الديوانيه", confidence: 0.9, type: "misspelling" },
    ]
  },
  16: { // المثنى
    name: "المثنى",
    alwaseet_id: 16,
    aliases: [
      { text: "muthanna", confidence: 1.0, type: "english" },
      { text: "Muthanna", confidence: 1.0, type: "english" },
      { text: "al-muthanna", confidence: 1.0, type: "english" },
      { text: "Al-Muthanna", confidence: 1.0, type: "english" },
      { text: "المثنا", confidence: 0.9, type: "misspelling" },
      { text: "مثنى", confidence: 1.0, type: "alternative" },
      { text: "السماوة", confidence: 1.0, type: "alternative" },
      { text: "سماوة", confidence: 1.0, type: "alternative" },
      { text: "السماوه", confidence: 0.9, type: "misspelling" },
    ]
  },
  17: { // ذي قار
    name: "ذي قار",
    alwaseet_id: 17,
    aliases: [
      { text: "dhi qar", confidence: 1.0, type: "english" },
      { text: "Dhi Qar", confidence: 1.0, type: "english" },
      { text: "thi-qar", confidence: 0.9, type: "english" },
      { text: "Thi-Qar", confidence: 0.9, type: "english" },
      { text: "ذيقار", confidence: 1.0, type: "alternative" },
      { text: "ذي قر", confidence: 0.9, type: "misspelling" },
      { text: "الناصرية", confidence: 1.0, type: "alternative" },
      { text: "ناصرية", confidence: 1.0, type: "alternative" },
      { text: "الناصريه", confidence: 0.9, type: "misspelling" },
    ]
  },
  18: { // ميسان
    name: "ميسان",
    alwaseet_id: 18,
    aliases: [
      { text: "maysan", confidence: 1.0, type: "english" },
      { text: "Maysan", confidence: 1.0, type: "english" },
      { text: "misan", confidence: 0.9, type: "english" },
      { text: "Misan", confidence: 0.9, type: "english" },
      { text: "ميسن", confidence: 0.9, type: "misspelling" },
      { text: "العمارة", confidence: 1.0, type: "alternative" },
      { text: "عمارة", confidence: 1.0, type: "alternative" },
      { text: "العماره", confidence: 0.9, type: "misspelling" },
      { text: "عماره", confidence: 0.8, type: "misspelling" },
    ]
  }
};

// دالة للحصول على جميع المرادفات لمدينة معينة
export function getCityAliases(cityId) {
  return iraqCitiesCommonAliases[cityId] || null;
}

// دالة للحصول على قائمة بجميع المدن مع مرادفاتها
export function getAllCitiesWithAliases() {
  return Object.values(iraqCitiesCommonAliases);
}

// دالة للبحث عن مدينة بواسطة المرادف
export function findCityByAlias(alias) {
  const normalizedAlias = alias.toLowerCase().trim();
  
  for (const [cityId, cityData] of Object.entries(iraqCitiesCommonAliases)) {
    const found = cityData.aliases.find(
      a => a.text.toLowerCase() === normalizedAlias
    );
    if (found) {
      return {
        cityId: parseInt(cityId),
        cityName: cityData.name,
        aliasData: found
      };
    }
  }
  
  return null;
}
