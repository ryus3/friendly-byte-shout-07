import { useState, useRef, useCallback, useEffect } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { toast } from '@/hooks/use-toast';

/**
 * Hook موحد لقارئ QR Code في جميع أنحاء التطبيق
 * يدعم إعدادات محسنة وإدارة أخطاء أفضل
 */
export const useQRScanner = (onScanSuccess, onScanError) => {
  const [isScanning, setIsScanning] = useState(false);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [error, setError] = useState(null);
  const [scanCount, setScanCount] = useState(0);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);

  const readerRef = useRef(null);
  const videoTrackRef = useRef(null);
  const lastScanTimeRef = useRef(0);

  // تنظيف الماسح عند إلغاء المكون
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  // الحصول على الكاميرات المتاحة
  const getCameras = useCallback(async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      setCameras(devices);
      
      // اختيار الكاميرا الخلفية تلقائياً
      const backCamera = devices.find(camera => 
        camera.label.toLowerCase().includes('back') || 
        camera.label.toLowerCase().includes('rear') ||
        camera.label.toLowerCase().includes('environment')
      );
      
      setSelectedCamera(backCamera || devices[0]);
      return devices;
    } catch (err) {
      console.error('خطأ في الحصول على الكاميرات:', err);
      setError('لا يمكن الوصول للكاميرات');
      return [];
    }
  }, []);

  // بدء المسح
  const startScanning = useCallback(async (elementId = 'qr-reader') => {
    try {
      setError(null);
      setIsScanning(false);

      // التحقق من الكاميرات
      const availableCameras = await getCameras();
      if (!availableCameras.length) {
        throw new Error('لا توجد كاميرا متاحة');
      }

      // إنشاء قارئ جديد
      const html5QrCode = new Html5Qrcode(elementId);
      readerRef.current = html5QrCode;

      // إعدادات محسنة للمسح
      const config = {
        fps: 25, // تحسين سرعة الإطارات
        qrbox: function(viewfinderWidth, viewfinderHeight) {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.floor(minEdge * 0.7);
          return {
            width: size,
            height: size
          };
        },
        aspectRatio: 1.0,
        disableFlip: false,
        // دعم تنسيقات متعددة
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.AZTEC,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.UPC_A
        ],
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      };

      // إعدادات الكاميرا المحسنة
      const cameraConfig = selectedCamera 
        ? { deviceId: { exact: selectedCamera.id } }
        : { facingMode: { ideal: "environment" } }; // استخدام ideal بدلاً من exact

      // بدء المسح
      await html5QrCode.start(
        cameraConfig,
        config,
        (decodedText, decodedResult) => {
          // منع المسح المتكرر
          const now = Date.now();
          if (now - lastScanTimeRef.current < 1000) {
            return;
          }
          lastScanTimeRef.current = now;

          setScanCount(prev => prev + 1);
          
          // معالجة النتيجة
          let result = decodedText;
          try {
            // محاولة تحليل JSON
            const jsonData = JSON.parse(decodedText);
            if (jsonData && (jsonData.type === 'product' || jsonData.product_id)) {
              result = {
                ...jsonData,
                qr_id: jsonData.id,
                barcode: decodedText
              };
            }
          } catch (e) {
            // QR Code بسيط
            result = decodedText;
          }

          // صوت نجاح
          try {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = context.createOscillator();
            const gainNode = context.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(context.destination);
            
            oscillator.frequency.value = 800;
            gainNode.gain.value = 0.1;
            
            oscillator.start();
            oscillator.stop(context.currentTime + 0.1);
          } catch (e) {
            console.log('لا يمكن تشغيل الصوت');
          }

          toast({
            title: "✅ تم قراءة QR Code",
            description: typeof result === 'object' 
              ? `${result.product_name || 'منتج'} - ${result.color || 'افتراضي'}` 
              : `الكود: ${result.substring(0, 30)}${result.length > 30 ? '...' : ''}`,
            variant: "success"
          });

          onScanSuccess?.(result);
        },
        (errorMessage) => {
          // تجاهل أخطاء عدم وجود كود
          if (!errorMessage.includes('No QR code found')) {
            console.log('QR Scan Error:', errorMessage);
          }
        }
      );

      // إعداد الفلاش
      await setupFlash();
      
      setIsScanning(true);

    } catch (err) {
      console.error('خطأ في بدء المسح:', err);
      const errorMsg = err.message.includes('Permission denied') 
        ? 'يرجى السماح للكاميرا في إعدادات المتصفح'
        : err.message.includes('NotFoundError')
        ? 'لا توجد كاميرا متاحة على هذا الجهاز'
        : `خطأ في تشغيل الماسح: ${err.message}`;
      
      setError(errorMsg);
      setIsScanning(false);
      onScanError?.(err);
    }
  }, [selectedCamera, onScanSuccess, onScanError, getCameras]);

  // إيقاف المسح
  const stopScanning = useCallback(async () => {
    try {
      if (readerRef.current && readerRef.current.isScanning) {
        await readerRef.current.stop();
      }
      if (videoTrackRef.current) {
        videoTrackRef.current.stop();
        videoTrackRef.current = null;
      }
    } catch (err) {
      console.error('خطأ في إيقاف المسح:', err);
    }
    
    setIsScanning(false);
    setFlashEnabled(false);
    readerRef.current = null;
  }, []);

  // إعداد الفلاش
  const setupFlash = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      const track = stream.getVideoTracks()[0];
      videoTrackRef.current = track;
      
      const capabilities = track.getCapabilities();
      setHasFlash(!!capabilities.torch);
      
    } catch (err) {
      console.log('Flash not supported:', err);
      setHasFlash(false);
    }
  }, []);

  // تبديل الفلاش
  const toggleFlash = useCallback(async () => {
    if (!videoTrackRef.current || !hasFlash) {
      toast({
        title: "❌ الفلاش غير متوفر",
        description: "هذا الجهاز لا يدعم الفلاش",
        variant: "destructive"
      });
      return;
    }
    
    try {
      await videoTrackRef.current.applyConstraints({
        advanced: [{ torch: !flashEnabled }]
      });
      setFlashEnabled(!flashEnabled);
      
      toast({
        title: flashEnabled ? "⚫ تم إطفاء الفلاش" : "💡 تم تشغيل الفلاش",
        variant: "success"
      });
    } catch (err) {
      console.error('خطأ في الفلاش:', err);
      toast({
        title: "❌ خطأ في الفلاش",
        description: "لا يمكن التحكم في الفلاش",
        variant: "destructive"
      });
    }
  }, [flashEnabled, hasFlash]);

  // تغيير الكاميرا
  const switchCamera = useCallback(async (cameraId) => {
    const camera = cameras.find(c => c.id === cameraId);
    if (camera) {
      setSelectedCamera(camera);
      if (isScanning) {
        await stopScanning();
        // إعادة بدء المسح مع الكاميرا الجديدة
        setTimeout(() => startScanning(), 500);
      }
    }
  }, [cameras, isScanning, stopScanning, startScanning]);

  return {
    // الحالة
    isScanning,
    hasFlash,
    flashEnabled,
    error,
    scanCount,
    cameras,
    selectedCamera,
    
    // الوظائف
    startScanning,
    stopScanning,
    toggleFlash,
    switchCamera,
    getCameras
  };
};