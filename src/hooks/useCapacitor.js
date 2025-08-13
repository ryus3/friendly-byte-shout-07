import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Preferences } from '@capacitor/preferences';

export const useCapacitor = () => {
  const [isNative, setIsNative] = useState(false);
  const [platform, setPlatform] = useState('web');

  useEffect(() => {
    const initCapacitor = async () => {
      const native = Capacitor.isNativePlatform();
      const currentPlatform = Capacitor.getPlatform();
      
      setIsNative(native);
      setPlatform(currentPlatform);

      if (native) {
        // إعداد شريط الحالة للهاتف
        try {
          await StatusBar.setStyle({ style: Style.Default });
          await StatusBar.setBackgroundColor({ color: '#ffffff' });
        } catch (error) {
          console.log('StatusBar not available:', error);
        }

        // إخفاء شاشة البداية
        try {
          await SplashScreen.hide();
        } catch (error) {
          console.log('SplashScreen not available:', error);
        }
      }
    };

    initCapacitor();
  }, []);

  // دوال مساعدة للتطبيق الأصلي
  const saveToStorage = async (key, value) => {
    try {
      await Preferences.set({ key, value: JSON.stringify(value) });
    } catch (error) {
      console.error('خطأ في حفظ البيانات:', error);
    }
  };

  const getFromStorage = async (key) => {
    try {
      const { value } = await Preferences.get({ key });
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('خطأ في قراءة البيانات:', error);
      return null;
    }
  };

  const removeFromStorage = async (key) => {
    try {
      await Preferences.remove({ key });
    } catch (error) {
      console.error('خطأ في حذف البيانات:', error);
    }
  };

  const setStatusBarColor = async (color, isLight = true) => {
    if (isNative) {
      try {
        await StatusBar.setBackgroundColor({ color });
        await StatusBar.setStyle({ 
          style: isLight ? Style.Dark : Style.Light 
        });
      } catch (error) {
        console.log('StatusBar configuration failed:', error);
      }
    }
  };

  return {
    isNative,
    platform,
    saveToStorage,
    getFromStorage,
    removeFromStorage,
    setStatusBarColor,
    isAndroid: platform === 'android',
    isIOS: platform === 'ios',
    isWeb: platform === 'web'
  };
};