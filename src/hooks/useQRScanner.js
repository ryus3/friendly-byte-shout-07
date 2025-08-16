import React, { useState, useRef, useEffect } from 'react';

/**
 * قارئ QR بسيط بدون مكتبات خارجية
 */
export const useQRScanner = (onScanSuccess) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [hasFlash, setHasFlash] = useState(true); // دائماً نظهر زر الفلاش
  const [flashEnabled, setFlashEnabled] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const startScanning = async (elementId = 'qr-reader') => {
    try {
      setError(null);
      console.log('🚀 بدء تشغيل الكاميرا...');

      // الحصول على العنصر
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error(`العنصر ${elementId} غير موجود`);
      }

      // طلب الكاميرا
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      streamRef.current = stream;

      // إنشاء فيديو داخل العنصر
      let video = element.querySelector('video');
      if (!video) {
        video = document.createElement('video');
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        element.appendChild(video);
      }

      video.srcObject = stream;
      videoRef.current = video;
      
      await video.play();
      setIsScanning(true);
      console.log('✅ تم تشغيل الكاميرا بنجاح');

    } catch (err) {
      console.error('❌ خطأ في الكاميرا:', err);
      setError('لا يمكن الوصول للكاميرا. اسمح للموقع باستخدام الكاميرا');
      setIsScanning(false);
    }
  };

  const stopScanning = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setIsScanning(false);
      setFlashEnabled(false);
      console.log('🛑 تم إيقاف الكاميرا');
    } catch (err) {
      console.error('خطأ في إيقاف المسح:', err);
    }
  };

  const toggleFlash = async () => {
    try {
      if (!streamRef.current) return;

      const track = streamRef.current.getVideoTracks()[0];
      if (!track) return;

      const newState = !flashEnabled;
      
      if (track.applyConstraints) {
        await track.applyConstraints({
          advanced: [{ torch: newState }]
        });
        setFlashEnabled(newState);
        console.log('✅ تم تغيير الفلاش:', newState);
      }
    } catch (err) {
      console.log('⚠️ الفلاش غير مدعوم على هذا الجهاز');
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