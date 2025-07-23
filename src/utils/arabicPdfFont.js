// تحميل خط عربي للـ PDF بطرق متعددة
export const loadArabicFont = async () => {
  try {
    // خطوط متعددة للاختبار
    const fontUrls = [
      // خط Noto Sans Arabic الداعم للعربية بشكل ممتاز
      'https://fonts.gstatic.com/s/notosansarabic/v18/nwpBtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCfyGy7u3CBFQLaigJqUw.ttf',
      // خط Tajawal كبديل
      'https://fonts.gstatic.com/s/tajawal/v9/Iura6YBj_oCad4k1l_6gLuvPDQ.ttf',
      // خط Cairo كبديل ثالث
      'https://fonts.gstatic.com/s/cairo/v28/SLXVc1nY6HkvalIhTp2mxdt0UX8gfxJkuDvF.ttf'
    ];

    for (const fontUrl of fontUrls) {
      try {
        console.log('🔄 محاولة تحميل الخط من:', fontUrl);
        const fontResponse = await fetch(fontUrl);
        
        if (fontResponse.ok) {
          const fontBuffer = await fontResponse.arrayBuffer();
          console.log('✅ تم تحميل الخط بنجاح من:', fontUrl);
          return fontBuffer;
        }
      } catch (error) {
        console.warn('⚠️ فشل تحميل الخط من:', fontUrl, error);
        continue;
      }
    }
    
    throw new Error('فشل في تحميل جميع الخطوط المتاحة');
  } catch (error) {
    console.error('❌ خطأ في تحميل الخط العربي:', error);
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
      console.log('✅ تم تسجيل الخط العربي: NotoSansArabic');
      return 'NotoSansArabic';
    }
  } catch (error) {
    console.error('❌ خطأ في تسجيل الخط العربي:', error);
  }
  
  // خط احتياطي - استخدام خط النظام
  console.log('⚠️ استخدام خط احتياطي: Helvetica');
  return 'Helvetica';
};