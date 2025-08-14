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

      // بدء المسح بإعدادات بسيطة
      await html5QrCode.start(
        { facingMode: "environment" }, // إعدادات بسيطة
        config,
        (decodedText) => {
          console.log('✅ QR Code found:', decodedText);
          
          toast({
            title: "✅ تم قراءة QR Code",
            description: `الكود: ${decodedText.substring(0, 30)}`,
            variant: "success"
          });

          onScanSuccess?.(decodedText);
        },
        (errorMessage) => {
          // تجاهل أخطاء عدم وجود كود
        }
      ).catch(async (err) => {
        // إذا فشل، نجرب بدون facingMode
        console.log('⚠️ Retrying without facingMode...');
        await html5QrCode.start(
          true, // استخدام الكاميرا الافتراضية
          config,
          (decodedText) => {
            console.log('✅ QR Code found:', decodedText);
            
            toast({
              title: "✅ تم قراءة QR Code",
              description: `الكود: ${decodedText.substring(0, 30)}`,
              variant: "success"
            });

            onScanSuccess?.(decodedText);
          },
          (errorMessage) => {
            // تجاهل أخطاء عدم وجود كود
          }
        );
      });

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