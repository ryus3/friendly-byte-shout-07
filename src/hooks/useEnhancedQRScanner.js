import { useState, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { toast } from '@/hooks/use-toast';

/**
 * قارئ QR محسن للآيفون والأجهزة المحمولة
 */
export const useEnhancedQRScanner = (onScanSuccess) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [cameras, setCameras] = useState([]);
  const readerRef = useRef(null);

  // الحصول على الكاميرات المتاحة
  const getCameras = useCallback(async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      setCameras(devices);
      return devices;
    } catch (err) {
      console.error('❌ خطأ في الحصول على الكاميرات:', err);
      return [];
    }
  }, []);

  const startScanning = useCallback(async (elementId = 'enhanced-qr-reader') => {
    console.log('🚀 بدء قارئ QR المحسن للآيفون');
    
    try {
      setError(null);
      setIsScanning(false);

      // التحقق من وجود العنصر
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error(`العنصر ${elementId} غير موجود`);
      }

      // الحصول على الكاميرات المتاحة
      const availableCameras = await getCameras();
      console.log('📷 الكاميرات المتاحة:', availableCameras);

      // إنشاء قارئ QR
      const html5QrCode = new Html5Qrcode(elementId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false
      });
      readerRef.current = html5QrCode;

      // إعدادات محسنة للآيفون
      const config = {
        fps: 10,
        qrbox: {
          width: Math.min(250, window.innerWidth - 100),
          height: Math.min(250, window.innerWidth - 100)
        },
        aspectRatio: 1.0,
        disableFlip: false,
        videoConstraints: {
          advanced: [
            { focusMode: "continuous" },
            { exposureMode: "continuous" },
            { whiteBalanceMode: "continuous" }
          ]
        }
      };

      // تجربة طرق مختلفة للكاميرا
      const cameraOptions = [
        // 1. محاولة الكاميرا الخلفية للآيفون
        { 
          facingMode: { exact: "environment" },
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 }
        },
        // 2. محاولة الكاميرا الخلفية العادية
        { facingMode: "environment" },
        // 3. محاولة أي كاميرا متاحة
        { facingMode: "user" },
        // 4. استخدام أول كاميرا متاحة
        availableCameras.length > 0 ? availableCameras[0].id : null,
        // 5. محاولة أخيرة بدون قيود
        true
      ];

      let scanningStarted = false;

      for (const cameraOption of cameraOptions) {
        if (scanningStarted || !cameraOption) continue;

        try {
          console.log('🔄 محاولة كاميرا:', cameraOption);
          
          await html5QrCode.start(
            cameraOption,
            config,
            // عند نجاح المسح
            (decodedText) => {
              console.log('✅ تم قراءة QR Code:', decodedText);
              
              // إيقاف الاهتزاز إذا كان متاحاً
              if (navigator.vibrate) {
                navigator.vibrate(200);
              }
              
              toast({
                title: "✅ تم قراءة QR Code بنجاح",
                description: `الكود: ${decodedText.substring(0, 40)}${decodedText.length > 40 ? '...' : ''}`,
                variant: "success"
              });

              onScanSuccess?.(decodedText);
            },
            // تجاهل أخطاء عدم وجود كود
            () => {}
          );

          scanningStarted = true;
          setIsScanning(true);
          console.log('✅ تم تشغيل قارئ QR بنجاح مع:', cameraOption);
          break;

        } catch (err) {
          console.log('⚠️ فشل في تشغيل الكاميرا:', cameraOption, err.message);
          continue;
        }
      }

      if (!scanningStarted) {
        throw new Error('فشل في تشغيل جميع خيارات الكاميرا');
      }

    } catch (err) {
      console.error('❌ خطأ في قارئ QR:', err);
      
      let errorMsg = 'خطأ في تشغيل الكاميرا';
      
      if (err.message.includes('Permission denied') || err.message.includes('NotAllowedError')) {
        errorMsg = 'يرجى السماح للكاميرا في إعدادات المتصفح والمحاولة مرة أخرى';
      } else if (err.message.includes('NotFoundError')) {
        errorMsg = 'لا توجد كاميرا متاحة على هذا الجهاز';
      } else if (err.message.includes('NotReadableError')) {
        errorMsg = 'الكاميرا مستخدمة من تطبيق آخر. يرجى إغلاق التطبيقات الأخرى والمحاولة مرة أخرى';
      } else if (err.message.includes('OverconstrainedError')) {
        errorMsg = 'إعدادات الكاميرا غير متوافقة. سنحاول إعدادات بديلة';
      }
      
      setError(errorMsg);
      setIsScanning(false);
    }
  }, [onScanSuccess, getCameras]);

  const stopScanning = useCallback(async () => {
    console.log('⏹️ إيقاف قارئ QR المحسن');
    
    try {
      if (readerRef.current && readerRef.current.isScanning) {
        await readerRef.current.stop();
        await readerRef.current.clear();
      }
      readerRef.current = null;
    } catch (err) {
      console.error('⚠️ خطأ في إيقاف القارئ:', err);
    }
    
    setIsScanning(false);
  }, []);

  return {
    isScanning,
    error,
    cameras,
    startScanning,
    stopScanning,
    getCameras
  };
};