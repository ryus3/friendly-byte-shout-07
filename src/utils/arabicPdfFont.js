// تحميل خط عربي للـ PDF من Google Fonts
export const loadArabicFont = async () => {
  try {
    // تحميل خط Noto Sans Arabic من Google Fonts
    const fontResponse = await fetch('https://fonts.gstatic.com/s/notosansarabic/v18/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCfyGyvu3CBFQLaig.woff2');
    
    if (!fontResponse.ok) {
      throw new Error('Failed to fetch font');
    }
    
    const fontBuffer = await fontResponse.arrayBuffer();
    return fontBuffer;
  } catch (error) {
    console.error('Error loading Arabic font:', error);
    // في حال فشل التحميل، نستخدم خط احتياطي
    return null;
  }
};

// تسجيل الخط مع react-pdf
export const registerArabicFont = async (Font) => {
  try {
    const fontBuffer = await loadArabicFont();
    if (fontBuffer) {
      Font.register({
        family: 'NotoSansArabic',
        src: fontBuffer,
        fontStyle: 'normal',
        fontWeight: 'normal',
      });
      return 'NotoSansArabic';
    }
  } catch (error) {
    console.error('Error registering Arabic font:', error);
  }
  
  // خط احتياطي
  return 'Times-Roman';
};