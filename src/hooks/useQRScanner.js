import React, { useState, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export const useQRScanner = (onScanSuccess) => {
  console.log('🔥 [QR] تم تحميل useQRScanner - النسخة الجديدة!');
  
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const readerRef = useRef(null);

  const startScanning = useCallback(async (elementId = 'qr-reader') => {
    console.log('🚀 [QR] بدء المسح - العنصر:', elementId);
    
    try {
      setError(null);
      setIsScanning(false);

      // التحقق من وجود العنصر
      const element = document.getElementById(elementId);
      if (!element) {
        console.error('❌ [QR] العنصر غير موجود:', elementId);
        throw new Error(`لا يمكن العثور على العنصر: ${elementId}`);
      }

      console.log('✅ [QR] تم العثور على العنصر');

      // إنشاء قارئ QR
      const qrCodeReader = new Html5Qrcode(elementId);
      readerRef.current = qrCodeReader;

      // محاولة تشغيل الكاميرا
      console.log('📱 [QR] محاولة تشغيل الكاميرا...');
      
      // إعداد بسيط جداً
      const config = {
        fps: 10,
        qrbox: { width: 200, height: 200 }
      };

      // محاولة استخدام كاميرا خلفية
      try {
        await qrCodeReader.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            console.log('🎉 [QR] نجح المسح!', decodedText);
            if (onScanSuccess) onScanSuccess(decodedText);
          },
          (errorMessage) => {
            // تجاهل أخطاء عدم وجود QR
          }
        );
        
        console.log('✅ [QR] تم تشغيل الكاميرا الخلفية');
        setIsScanning(true);
        setHasFlash(true); // تفعيل زر الفلاش افتراضياً
        
      } catch (backCameraError) {
        console.log('⚠️ [QR] فشل الكاميرا الخلفية، جرب الأمامية:', backCameraError.message);
        
        // محاولة الكاميرا الأمامية
        try {
          await qrCodeReader.start(
            { facingMode: "user" },
            config,
            (decodedText) => {
              console.log('🎉 [QR] نجح المسح!', decodedText);
              if (onScanSuccess) onScanSuccess(decodedText);
            },
            (errorMessage) => {
              // تجاهل أخطاء عدم وجود QR
            }
          );
          
          console.log('✅ [QR] تم تشغيل الكاميرا الأمامية');
          setIsScanning(true);
          setHasFlash(false); // الكاميرا الأمامية عادة بدون فلاش
          
        } catch (frontCameraError) {
          console.error('❌ [QR] فشل في تشغيل أي كاميرا:', frontCameraError.message);
          throw new Error('لا يمكن الوصول للكاميرا. تأكد من السماح للموقع باستخدام الكاميرا');
        }
      }

    } catch (err) {
      console.error('💥 [QR] خطأ عام:', err);
      setError(err.message);
      setIsScanning(false);
    }
  }, [onScanSuccess]);

  const stopScanning = useCallback(async () => {
    console.log('🛑 [QR] إيقاف المسح...');
    try {
      if (readerRef.current && isScanning) {
        await readerRef.current.stop();
        await readerRef.current.clear();
        console.log('✅ [QR] تم إيقاف المسح');
      }
    } catch (err) {
      console.error('❌ [QR] خطأ في الإيقاف:', err);
    } finally {
      setIsScanning(false);
      setHasFlash(false);
      setFlashEnabled(false);
      readerRef.current = null;
    }
  }, [isScanning]);

  const toggleFlash = useCallback(async () => {
    console.log('💡 [QR] تبديل الفلاش...');
    
    if (!hasFlash) {
      console.log('❌ [QR] الفلاش غير متاح');
      return;
    }

    try {
      const newState = !flashEnabled;
      
      // محاولة تفعيل الفلاش (هذا قد لا يعمل على جميع الأجهزة)
      if (readerRef.current) {
        const mediaStream = readerRef.current.getRunningTrackMediaStream();
        if (mediaStream) {
          const videoTracks = mediaStream.getVideoTracks();
          if (videoTracks.length > 0) {
            const track = videoTracks[0];
            if (track.applyConstraints) {
              await track.applyConstraints({
                advanced: [{ torch: newState }]
              });
              setFlashEnabled(newState);
              console.log('✅ [QR] تم تغيير الفلاش:', newState);
            }
          }
        }
      }
    } catch (err) {
      console.log('⚠️ [QR] الفلاش غير مدعوم:', err.message);
      setHasFlash(false);
    }
  }, [hasFlash, flashEnabled]);

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