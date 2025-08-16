import React, { useState, useRef, useEffect } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

/**
 * قارئ QR مبسط ومضمون للعمل
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

  // بدء المسح
  const startScanning = async (elementId = 'qr-reader') => {
    try {
      setError(null);
      setIsScanning(false);

      // التحقق من Element
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error(`العنصر ${elementId} غير موجود`);
      }

      console.log('🚀 بدء مسح QR...');

      // إنشاء قارئ جديد
      const html5QrCode = new Html5Qrcode(elementId);
      readerRef.current = html5QrCode;

      // إعدادات بسيطة ومضمونة
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      // إعدادات الكاميرا - استخدام الكاميرا الافتراضية أولاً
      let cameraConfig = "environment";
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          // البحث عن الكاميرا الخلفية
          const backCamera = cameras.find(camera => 
            camera.label.toLowerCase().includes('back') || 
            camera.label.toLowerCase().includes('rear') ||
            camera.label.toLowerCase().includes('environment')
          );
          if (backCamera) {
            cameraConfig = backCamera.id;
            console.log('✅ استخدام الكاميرا الخلفية:', backCamera.label);
          } else {
            cameraConfig = cameras[0].id;
            console.log('✅ استخدام الكاميرا الأولى:', cameras[0].label);
          }
        }
      } catch (e) {
        console.log('⚠️ سيتم استخدام الكاميرا الافتراضية:', e.message);
      }

      // بدء المسح
      await html5QrCode.start(
        cameraConfig,
        config,
        (decodedText) => {
          console.log('✅ تم مسح QR:', decodedText);
          if (onScanSuccess) {
            onScanSuccess(decodedText);
          }
        },
        (errorMessage) => {
          // تجاهل أخطاء المسح العادية
        }
      );

      setIsScanning(true);
      
      // التحقق من دعم الفلاش بعد تأخير
      setTimeout(async () => {
        try {
          const capabilities = html5QrCode.getRunningTrackCameraCapabilities();
          console.log('🔍 Camera capabilities:', capabilities);
          
          if (capabilities && capabilities.torch) {
            setHasFlash(true);
            videoTrackRef.current = capabilities;
            console.log('✅ تم تفعيل دعم الفلاش');
          } else {
            // محاولة أخرى للحصول على MediaStreamTrack
            try {
              const mediaStream = html5QrCode.getRunningTrackMediaStream();
              if (mediaStream) {
                const videoTrack = mediaStream.getVideoTracks()[0];
                if (videoTrack && videoTrack.getCapabilities) {
                  const trackCapabilities = videoTrack.getCapabilities();
                  if (trackCapabilities.torch) {
                    setHasFlash(true);
                    videoTrackRef.current = videoTrack;
                    console.log('✅ تم تفعيل الفلاش عبر MediaStreamTrack');
                  } else {
                    console.log('❌ لا يوجد دعم للفلاش في الكاميرا');
                    setHasFlash(false);
                  }
                } else {
                  console.log('❌ getCapabilities غير مدعومة');
                  setHasFlash(false);
                }
              } else {
                console.log('❌ لا يوجد MediaStream');
                setHasFlash(false);
              }
            } catch (mediaError) {
              console.log('❌ خطأ في MediaStream:', mediaError.message);
              setHasFlash(false);
            }
          }
        } catch (e) {
          console.log('❌ لا يوجد دعم للفلاش:', e.message);
          setHasFlash(false);
        }
      }, 1000);

    } catch (err) {
      console.error('خطأ في تشغيل المسح:', err);
      setError(err.message || 'خطأ في تشغيل الكاميرا');
      setIsScanning(false);
    }
  };

  // إيقاف المسح
  const stopScanning = async () => {
    try {
      if (readerRef.current && isScanning) {
        await readerRef.current.stop();
        readerRef.current.clear();
        readerRef.current = null;
      }
      setIsScanning(false);
      setFlashEnabled(false);
      videoTrackRef.current = null;
    } catch (err) {
      console.error('خطأ في إيقاف المسح:', err);
    }
  };

  // تفعيل/إلغاء الفلاش
  const toggleFlash = async () => {
    try {
      if (!hasFlash || !videoTrackRef.current) {
        console.log('❌ الفلاش غير مدعوم أو غير متاح');
        return;
      }
      
      const newState = !flashEnabled;
      
      // محاولة استخدام applyConstraints
      try {
        await videoTrackRef.current.applyConstraints({
          advanced: [{ torch: newState }]
        });
        setFlashEnabled(newState);
        console.log('✅ تم تغيير حالة الفلاش إلى:', newState);
      } catch (constraintError) {
        // محاولة بديلة إذا فشلت الطريقة الأولى
        try {
          if (videoTrackRef.current.torch !== undefined) {
            videoTrackRef.current.torch = newState;
            setFlashEnabled(newState);
            console.log('✅ تم تغيير الفلاش (طريقة بديلة):', newState);
          } else {
            throw new Error('خاصية torch غير مدعومة');
          }
        } catch (torchError) {
          console.error('❌ الفلاش غير مدعوم:', torchError.message);
          setHasFlash(false);
        }
      }
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