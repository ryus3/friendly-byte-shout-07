import { useState, useRef, useCallback, useEffect } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { toast } from '@/hooks/use-toast';

/**
 * Hook موحد لقارئ QR Code في جميع أنحاء التطبيق
 * مع إصلاحات شاملة لمشاكل الكاميرا والأخطاء
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

  console.log('🔍 QR Scanner Hook - State:', {
    isScanning,
    error,
    camerasCount: cameras.length,
    selectedCamera: selectedCamera?.label || 'none'
  });

  // تنظيف الماسح عند إلغاء المكون
  useEffect(() => {
    return () => {
      console.log('🧹 QR Scanner cleanup');
      stopScanning();
    };
  }, []);

  // الحصول على الكاميرات المتاحة
  const getCameras = useCallback(async () => {
    try {
      console.log('📷 Getting available cameras...');
      const devices = await Html5Qrcode.getCameras();
      console.log('📷 Available cameras:', devices.length);
      
      setCameras(devices);
      
      // اختيار الكاميرا الخلفية تلقائياً
      const backCamera = devices.find(camera => 
        camera.label.toLowerCase().includes('back') || 
        camera.label.toLowerCase().includes('rear') ||
        camera.label.toLowerCase().includes('environment')
      );
      
      const chosen = backCamera || devices[0];
      setSelectedCamera(chosen);
      console.log('📷 Selected camera:', chosen?.label || 'none');
      
      return devices;
    } catch (err) {
      console.error('❌ Error getting cameras:', err);
      setError('لا يمكن الوصول للكاميرات');
      return [];
    }
  }, []);

  // بدء المسح
  const startScanning = useCallback(async (elementId = 'qr-reader') => {
    console.log('🚀 Starting QR Scanner with element:', elementId);
    
    try {
      setError(null);
      setIsScanning(false);

      // التحقق من توفر Element
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error(`العنصر ${elementId} غير موجود`);
      }

      // التحقق من الكاميرات
      console.log('📷 Checking cameras...');
      const availableCameras = await getCameras();
      if (!availableCameras.length) {
        throw new Error('لا توجد كاميرا متاحة');
      }

      console.log('🔧 Creating Html5Qrcode instance...');
      // إنشاء قارئ جديد
      const html5QrCode = new Html5Qrcode(elementId);
      readerRef.current = html5QrCode;

      // إعدادات محسنة للمسح
      const config = {
        fps: 10, // تقليل سرعة الإطارات لتحسين الأداء
        qrbox: function(viewfinderWidth, viewfinderHeight) {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.floor(minEdge * 0.8);
          console.log('📐 QR Box size:', size);
          return {
            width: size,
            height: size
          };
        },
        aspectRatio: 1.0,
        disableFlip: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13
        ]
      };

      // إعدادات الكاميرا المحسنة
      let cameraConfig;
      if (selectedCamera?.id) {
        console.log('📷 Using specific camera:', selectedCamera.label);
        cameraConfig = selectedCamera.id;
      } else {
        // البحث عن الكاميرا الخلفية
        const backCamera = availableCameras.find(camera => 
          camera.label && (
            camera.label.toLowerCase().includes('back') ||
            camera.label.toLowerCase().includes('rear') ||
            camera.label.toLowerCase().includes('environment')
          )
        );
        
        if (backCamera) {
          console.log('📷 Using back camera:', backCamera.label);
          cameraConfig = backCamera.id;
        } else {
          console.log('📷 Using first available camera');
          cameraConfig = availableCameras[0]?.id || { 
            facingMode: "user" 
          };
        }
      }

      console.log('🎯 Camera config:', cameraConfig);

      // بدء المسح مع معالجة الأخطاء المحسنة
      await html5QrCode.start(
        cameraConfig,
        config,
        (decodedText, decodedResult) => {
          // منع المسح المتكرر
          const now = Date.now();
          if (now - lastScanTimeRef.current < 1500) {
            return;
          }
          lastScanTimeRef.current = now;

          console.log('✅ QR Code scanned:', decodedText.substring(0, 50));
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
              console.log('📦 Product QR detected:', result.product_name);
            }
          } catch (e) {
            console.log('📄 Simple QR Code detected');
            result = decodedText;
          }

          // صوت نجاح محسن
          try {
            // إنشاء صوت بسيط وفعال
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
          } catch (e) {
            console.log('🔇 Audio not available');
          }

          toast({
            title: "✅ تم قراءة QR Code",
            description: typeof result === 'object' 
              ? `منتج: ${result.product_name || 'غير محدد'}` 
              : `الكود: ${result.substring(0, 30)}${result.length > 30 ? '...' : ''}`,
            variant: "success"
          });

          onScanSuccess?.(result);
        },
        (errorMessage) => {
          // تجاهل أخطاء عدم وجود كود - هذا طبيعي
          if (!errorMessage.includes('No QR code found') && 
              !errorMessage.includes('QR code parse error')) {
            console.log('⚠️ QR Scan Error:', errorMessage);
          }
        }
      );

      console.log('✅ QR Scanner started successfully');
      setIsScanning(true);

    } catch (err) {
      console.error('❌ QR Scanner start error:', err);
      
      // رسائل خطأ أوضح وأكثر فائدة
      let errorMsg = 'خطأ غير معروف في قارئ QR';
      
      if (err.message.includes('Permission denied') || err.message.includes('NotAllowedError')) {
        errorMsg = 'يرجى السماح للكاميرا في إعدادات المتصفح والمحاولة مرة أخرى';
      } else if (err.message.includes('NotFoundError') || err.message.includes('لا توجد كاميرا')) {
        errorMsg = 'لا توجد كاميرا متاحة على هذا الجهاز';
      } else if (err.message.includes('NotReadableError')) {
        errorMsg = 'الكاميرا مستخدمة من تطبيق آخر، يرجى إغلاق التطبيقات الأخرى';
      } else if (err.message.includes('OverconstrainedError') || err.message.includes('config has invalid')) {
        console.log('🔄 Retrying with basic camera config...');
        errorMsg = 'جاري إعادة المحاولة بإعدادات كاميرا أبسط...';
        
        // محاولة إعادة التشغيل بدون facingMode
        setTimeout(() => {
          console.log('🔄 Retrying with first available camera...');
          if (availableCameras.length > 0) {
            setSelectedCamera(availableCameras[0]);
            startScanning(elementId);
          }
        }, 1000);
        return;
      } else if (err.message.includes('غير موجود')) {
        errorMsg = `العنصر ${elementId} غير موجود في الصفحة`;
      } else {
        errorMsg = `خطأ تقني: ${err.message}`;
      }
      
      setError(errorMsg);
      setIsScanning(false);
      onScanError?.(err);
    }
  }, [selectedCamera, onScanSuccess, onScanError, getCameras]);

  // إيقاف المسح
  const stopScanning = useCallback(async () => {
    console.log('⏹️ Stopping QR Scanner...');
    
    try {
      if (readerRef.current) {
        if (readerRef.current.isScanning) {
          await readerRef.current.stop();
          console.log('✅ QR Scanner stopped');
        }
        // تنظيف المرجع
        readerRef.current = null;
      }
      
      if (videoTrackRef.current) {
        videoTrackRef.current.stop();
        videoTrackRef.current = null;
        console.log('📹 Video track stopped');
      }
    } catch (err) {
      console.error('⚠️ Error stopping scanner:', err);
    }
    
    setIsScanning(false);
    setFlashEnabled(false);
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
      console.error('❌ Flash error:', err);
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
      console.log('🔄 Switching to camera:', camera.label);
      setSelectedCamera(camera);
      if (isScanning) {
        await stopScanning();
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