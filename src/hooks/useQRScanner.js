import React, { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

/**
 * قارئ QR مبسط ومضمون 100%
 */
export const useQRScanner = (onScanSuccess) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const readerRef = useRef(null);
  const videoTrackRef = useRef(null);

  // تنظيف عند إلغاء المكون
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  // بدء المسح - بأبسط طريقة ممكنة
  const startScanning = async (elementId = 'qr-reader') => {
    try {
      setError(null);
      setIsScanning(false);
      setHasFlash(false);

      // التحقق من Element
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error(`العنصر ${elementId} غير موجود`);
      }

      console.log('🚀 بدء مسح QR (النسخة المبسطة)...');

      // إنشاء قارئ جديد
      if (readerRef.current) {
        try {
          await readerRef.current.stop();
          await readerRef.current.clear();
        } catch (e) {
          console.log('تنظيف القارئ السابق');
        }
      }

      const html5QrCode = new Html5Qrcode(elementId);
      readerRef.current = html5QrCode;

      // إعدادات مبسطة جداً
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      };

      // إعدادات الكاميرا - التجربة الأبسط أولاً
      const cameraConfigs = [
        // 1. أبسط إعداد - الكاميرا الافتراضية
        { facingMode: "environment" },
        // 2. إعداد احتياطي
        { facingMode: { ideal: "environment" } },
        // 3. أي كاميرا متاحة
        { facingMode: "user" }
      ];

      let scannerStarted = false;
      let currentConfig = null;

      // جرب كل إعداد حتى يعمل واحد
      for (const config_camera of cameraConfigs) {
        if (scannerStarted) break;
        
        try {
          console.log('🔍 جاري تجربة إعداد الكاميرا:', config_camera);
          
          await html5QrCode.start(
            config_camera,
            config,
            (decodedText) => {
              console.log('✅ تم مسح QR بنجاح:', decodedText);
              if (onScanSuccess) {
                onScanSuccess(decodedText);
              }
            },
            (errorMessage) => {
              // تجاهل أخطاء المسح العادية
            }
          );
          
          scannerStarted = true;
          currentConfig = config_camera;
          console.log('✅ نجح تشغيل الكاميرا بالإعداد:', config_camera);
          setIsScanning(true);
          
          // محاولة تفعيل الفلاش بعد ثانية واحدة
          setTimeout(() => {
            checkFlashSupport(html5QrCode);
          }, 1000);
          
          break;
          
        } catch (startError) {
          console.log('❌ فشل الإعداد:', config_camera, 'الخطأ:', startError.message);
          // لا نرمي الخطأ، فقط ننتقل للإعداد التالي
        }
      }

      if (!scannerStarted) {
        throw new Error('فشل في تشغيل أي كاميرا متاحة. تأكد من السماح للكاميرا في المتصفح.');
      }

    } catch (err) {
      console.error('خطأ عام في تشغيل المسح:', err);
      setError(err.message || 'خطأ في تشغيل الكاميرا');
      setIsScanning(false);
    }
  };

  // فحص دعم الفلاش
  const checkFlashSupport = async (html5QrCode) => {
    try {
      // طريقة 1: فحص capabilities
      const capabilities = html5QrCode.getRunningTrackCameraCapabilities();
      if (capabilities && capabilities.torch) {
        setHasFlash(true);
        videoTrackRef.current = capabilities;
        console.log('✅ الفلاش مدعوم (capabilities)');
        return;
      }

      // طريقة 2: فحص MediaStreamTrack
      const mediaStream = html5QrCode.getRunningTrackMediaStream();
      if (mediaStream) {
        const videoTrack = mediaStream.getVideoTracks()[0];
        if (videoTrack && videoTrack.getCapabilities) {
          const trackCapabilities = videoTrack.getCapabilities();
          if (trackCapabilities.torch) {
            setHasFlash(true);
            videoTrackRef.current = videoTrack;
            console.log('✅ الفلاش مدعوم (MediaStreamTrack)');
            return;
          }
        }
      }

      console.log('❌ الفلاش غير مدعوم في هذا الجهاز');
      setHasFlash(false);
      
    } catch (e) {
      console.log('❌ خطأ في فحص الفلاش:', e.message);
      setHasFlash(false);
    }
  };

  // إيقاف المسح
  const stopScanning = async () => {
    try {
      if (readerRef.current) {
        if (isScanning) {
          await readerRef.current.stop();
        }
        await readerRef.current.clear();
        readerRef.current = null;
      }
      setIsScanning(false);
      setHasFlash(false);
      setFlashEnabled(false);
      videoTrackRef.current = null;
      console.log('✅ تم إيقاف المسح بنجاح');
    } catch (err) {
      console.error('خطأ في إيقاف المسح:', err);
    }
  };

  // تفعيل/إلغاء الفلاش
  const toggleFlash = async () => {
    try {
      if (!hasFlash || !videoTrackRef.current) {
        console.log('❌ الفلاش غير متاح');
        return;
      }
      
      const newState = !flashEnabled;
      
      // طريقة 1: applyConstraints
      try {
        await videoTrackRef.current.applyConstraints({
          advanced: [{ torch: newState }]
        });
        setFlashEnabled(newState);
        console.log('✅ تم تغيير الفلاش إلى:', newState);
        return;
      } catch (constraintError) {
        console.log('❌ فشل applyConstraints:', constraintError.message);
      }

      // طريقة 2: torch مباشرة
      try {
        if (videoTrackRef.current.torch !== undefined) {
          videoTrackRef.current.torch = newState;
          setFlashEnabled(newState);
          console.log('✅ تم تغيير الفلاش (مباشر):', newState);
          return;
        }
      } catch (torchError) {
        console.log('❌ فشل torch مباشر:', torchError.message);
      }

      // إذا فشلت كل الطرق
      console.log('❌ فشل في تفعيل الفلاش - سيتم إخفاء الزر');
      setHasFlash(false);
      
    } catch (err) {
      console.error('❌ خطأ عام في الفلاش:', err.message);
      setHasFlash(false);
    }
  };

  return {
    isScanning,
    error,
    hasFlash,
    flashEnabled,
    startScanning,
    stopScanning,
    toggleFlash
  };
};