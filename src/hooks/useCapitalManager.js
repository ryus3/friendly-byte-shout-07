import { useState, useEffect } from 'react';

/**
 * مدير رأس المال - محفوظ في الواجهة فقط (localStorage)
 * لا يستخدم قاعدة البيانات نهائياً
 */
export const useCapitalManager = () => {
  const [capital, setCapital] = useState(15000000); // القيمة الافتراضية
  const [loading, setLoading] = useState(false);

  // مفتاح التخزين في localStorage
  const CAPITAL_STORAGE_KEY = 'ryus_initial_capital';

  // تحميل رأس المال من localStorage عند بدء التطبيق
  useEffect(() => {
    try {
      const savedCapital = localStorage.getItem(CAPITAL_STORAGE_KEY);
      if (savedCapital && !isNaN(parseFloat(savedCapital))) {
        const capitalValue = parseFloat(savedCapital);
        setCapital(capitalValue);
        console.log('💰 تم تحميل رأس المال من التخزين المحلي:', capitalValue.toLocaleString());
      } else {
        // حفظ القيمة الافتراضية إذا لم توجد
        localStorage.setItem(CAPITAL_STORAGE_KEY, '15000000');
        console.log('💰 تم تعيين رأس المال الافتراضي:', '15,000,000');
      }
    } catch (error) {
      console.error('خطأ في تحميل رأس المال:', error);
      setCapital(15000000);
    }
  }, []);

  // حفظ رأس المال الجديد
  const updateCapital = async (newCapital) => {
    try {
      setLoading(true);
      
      const capitalValue = parseFloat(newCapital);
      if (isNaN(capitalValue) || capitalValue < 0) {
        throw new Error('يجب أن يكون رأس المال رقم صحيح أكبر من أو يساوي الصفر');
      }

      // حفظ في localStorage
      localStorage.setItem(CAPITAL_STORAGE_KEY, capitalValue.toString());
      
      // تحديث الحالة
      setCapital(capitalValue);
      
      console.log('✅ تم تحديث رأس المال بنجاح:', capitalValue.toLocaleString());
      
      return {
        success: true,
        message: `تم تحديث رأس المال إلى ${capitalValue.toLocaleString()} د.ع`,
        capital: capitalValue
      };
      
    } catch (error) {
      console.error('❌ خطأ في تحديث رأس المال:', error);
      return {
        success: false,
        message: error.message || 'فشل في تحديث رأس المال',
        capital: capital
      };
    } finally {
      setLoading(false);
    }
  };

  // إعادة تعيين رأس المال للقيمة الافتراضية
  const resetCapital = () => {
    const defaultCapital = 15000000;
    localStorage.setItem(CAPITAL_STORAGE_KEY, defaultCapital.toString());
    setCapital(defaultCapital);
    console.log('🔄 تم إعادة تعيين رأس المال للقيمة الافتراضية');
    return defaultCapital;
  };

  // حذف رأس المال من التخزين
  const clearCapital = () => {
    localStorage.removeItem(CAPITAL_STORAGE_KEY);
    setCapital(0);
    console.log('🗑️ تم حذف رأس المال من التخزين');
  };

  // التحقق من وجود رأس المال
  const hasCapital = () => {
    return capital > 0;
  };

  // تنسيق رأس المال للعرض
  const formatCapital = (amount = capital) => {
    return new Intl.NumberFormat('ar-IQ', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' د.ع';
  };

  return {
    // القيم الأساسية
    capital,
    loading,
    
    // الدوال
    updateCapital,
    resetCapital,
    clearCapital,
    hasCapital,
    formatCapital,
    
    // معلومات إضافية
    isDefault: capital === 15000000,
    storageKey: CAPITAL_STORAGE_KEY,
    
    // للديباغ
    debug: {
      storageValue: localStorage.getItem(CAPITAL_STORAGE_KEY),
      currentCapital: capital,
      formatted: formatCapital()
    }
  };
};