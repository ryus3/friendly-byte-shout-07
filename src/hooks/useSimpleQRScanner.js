import { useState, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { toast } from '@/hooks/use-toast';

/**
 * Hook بسيط لقارئ QR يعمل على جميع الأجهزة
 */
export const useSimpleQRScanner = (onScanSuccess) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const readerRef = useRef(null);

  const startScanning = useCallback(async (elementId = 'qr-reader') => {
    console.log('🚀 Starting Simple QR Scanner');
    
    try {
      setError(null);
      
      // التحقق من توفر Element
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error(`العنصر ${elementId} غير موجود`);
      }

      // إنشاء قارئ بسيط
      const html5QrCode = new Html5Qrcode(elementId);
      readerRef.current = html5QrCode;

      // إعدادات بسيطة جداً
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      };

      // تجربة إعدادات مختلفة للكاميرا للآيفون
      const cameraConfigs = [
        // 1. الكاميرا الخلفية للآيفون
        { 
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
          facingMode: { exact: "environment" }
        },
        // 2. الكاميرا الخلفية العادية
        { facingMode: "environment" },
        // 3. أي كاميرا
        { facingMode: "user" },
        // 4. بدون قيود
        true
      ];

      let started = false;
      for (const cameraConfig of cameraConfigs) {
        if (started) break;
        
        try {
          await html5QrCode.start(
            cameraConfig,
            config,
            (decodedText) => {
              console.log('✅ QR Code found:', decodedText);
              
              // اهتزاز للآيفون
              if (navigator.vibrate) {
                navigator.vibrate(200);
              }
              
              toast({
                title: "✅ تم قراءة QR Code",
                description: `الكود: ${decodedText.substring(0, 30)}`,
                variant: "success"
              });

              onScanSuccess?.(decodedText);
            },
            () => {} // تجاهل أخطاء عدم وجود كود
          );
          
          started = true;
          break;
        } catch (configError) {
          console.log('⚠️ فشل في إعداد الكاميرا:', cameraConfig, configError.message);
          continue;
        }
      }

      if (!started) {
        throw new Error('فشل في تشغيل جميع إعدادات الكاميرا');
      }

      setIsScanning(true);
      console.log('✅ Simple QR Scanner started');

    } catch (err) {
      console.error('❌ QR Scanner error:', err);
      let errorMsg = 'يرجى السماح للكاميرا والمحاولة مرة أخرى';
      
      if (err.message.includes('Permission denied')) {
        errorMsg = 'يرجى السماح للكاميرا في إعدادات المتصفح';
      } else if (err.message.includes('NotFoundError')) {
        errorMsg = 'لا توجد كاميرا متاحة على هذا الجهاز';
      }
      
      setError(errorMsg);
      setIsScanning(false);
    }
  }, [onScanSuccess]);

  const stopScanning = useCallback(async () => {
    console.log('⏹️ Stopping Simple QR Scanner');
    
    try {
      if (readerRef.current && readerRef.current.isScanning) {
        await readerRef.current.stop();
        readerRef.current = null;
      }
    } catch (err) {
      console.error('⚠️ Error stopping scanner:', err);
    }
    
    setIsScanning(false);
  }, []);

  return {
    isScanning,
    error,
    startScanning,
    stopScanning
  };
};