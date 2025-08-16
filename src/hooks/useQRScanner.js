import React, { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export const useQRScanner = (onScanSuccess) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const readerRef = useRef(null);
  const videoTrackRef = useRef(null);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async (elementId = 'qr-reader') => {
    try {
      setError(null);
      setIsScanning(false);

      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error(`العنصر ${elementId} غير موجود`);
      }

      const html5QrCode = new Html5Qrcode(elementId);
      readerRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          if (onScanSuccess) {
            onScanSuccess(decodedText);
          }
        },
        (errorMessage) => {
          // تجاهل أخطاء المسح العادية
        }
      );

      setIsScanning(true);
      
      // فحص الفلاش بعد ثانية
      setTimeout(() => {
        try {
          const capabilities = html5QrCode.getRunningTrackCameraCapabilities();
          if (capabilities && capabilities.torch) {
            setHasFlash(true);
            videoTrackRef.current = capabilities;
          }
        } catch (e) {
          setHasFlash(false);
        }
      }, 1000);

    } catch (err) {
      setError(err.message || 'خطأ في تشغيل الكاميرا');
      setIsScanning(false);
    }
  };

  const stopScanning = async () => {
    try {
      if (readerRef.current && isScanning) {
        await readerRef.current.stop();
        await readerRef.current.clear();
        readerRef.current = null;
      }
      setIsScanning(false);
      setFlashEnabled(false);
      videoTrackRef.current = null;
    } catch (err) {
      console.error('خطأ في إيقاف المسح:', err);
    }
  };

  const toggleFlash = async () => {
    try {
      if (!hasFlash || !videoTrackRef.current) {
        return;
      }
      
      const newState = !flashEnabled;
      await videoTrackRef.current.applyConstraints({
        advanced: [{ torch: newState }]
      });
      setFlashEnabled(newState);
    } catch (err) {
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