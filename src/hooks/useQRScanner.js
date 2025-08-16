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

      // إعدادات الكاميرا - تفضيل الكاميرا الخلفية إن وجدت
      let cameraConfig = { facingMode: "environment" };
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length) {
          const back = cameras.find(c => (c.label || '').toLowerCase().includes('back') || (c.label || '').toLowerCase().includes('rear') || (c.label || '').toLowerCase().includes('environment'));
          cameraConfig = (back || cameras[0]).id;
        }
      } catch (e) {
        console.log('تعذر الحصول على الكاميرات، سيتم استخدام facingMode:', e);
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
      
      // التحقق من دعم الفلاش
      try {
        const stream = html5QrCode.getRunningTrackCameraCapabilities();
        if (stream && stream.torch) {
          setHasFlash(true);
          videoTrackRef.current = stream;
        }
      } catch (e) {
        console.log('لا يوجد دعم للفلاش');
      }

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
      if (videoTrackRef.current && hasFlash) {
        const newState = !flashEnabled;
        await videoTrackRef.current.applyConstraints({
          advanced: [{ torch: newState }]
        });
        setFlashEnabled(newState);
      }
    } catch (err) {
      console.error('خطأ في تغيير الفلاش:', err);
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