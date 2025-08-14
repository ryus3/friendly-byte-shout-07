import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, AlertTriangle, Smartphone, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

/**
 * قارئ QR Code بتقنية getUserMedia المباشرة - يعمل على جميع الأجهزة
 */
const NativeQRScanner = ({ 
  open, 
  onOpenChange, 
  onScanSuccess, 
  title = "قارئ QR Code"
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // بدء المسح مع تقنية getUserMedia المباشرة
  const startCamera = async () => {
    console.log('🚀 بدء كاميرا مباشرة للآيفون');
    setError(null);

    try {
      // إعدادات كاميرا محسنة للآيفون
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          aspectRatio: { ideal: 16/9 }
        },
        audio: false
      };

      // الحصول على stream الكاميرا
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.playsInline = true; // مهم للآيفون
        videoRef.current.muted = true;
        
        await videoRef.current.play();
        
        setStream(mediaStream);
        setIsScanning(true);
        
        // بدء مسح QR Code
        startQRDetection();
        
        console.log('✅ تم تشغيل الكاميرا بنجاح');
      }

    } catch (err) {
      console.error('❌ خطأ في الكاميرا:', err);
      
      let errorMsg = 'خطأ في تشغيل الكاميرا';
      
      if (err.name === 'NotAllowedError') {
        errorMsg = 'يرجى السماح للكاميرا في إعدادات المتصفح والمحاولة مرة أخرى';
      } else if (err.name === 'NotFoundError') {
        errorMsg = 'لا توجد كاميرا متاحة على هذا الجهاز';
      } else if (err.name === 'NotReadableError') {
        errorMsg = 'الكاميرا مستخدمة من تطبيق آخر. يرجى إغلاق التطبيقات الأخرى';
      } else if (err.name === 'OverconstrainedError') {
        // جرب إعدادات أبسط
        trySimpleCamera();
        return;
      }
      
      setError(errorMsg);
    }
  };

  // محاولة بإعدادات كاميرا بسيطة
  const trySimpleCamera = async () => {
    try {
      console.log('🔄 محاولة بإعدادات بسيطة...');
      
      const simpleConstraints = {
        video: true,
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(simpleConstraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.playsInline = true;
        videoRef.current.muted = true;
        
        await videoRef.current.play();
        
        setStream(mediaStream);
        setIsScanning(true);
        startQRDetection();
        
        console.log('✅ تم تشغيل الكاميرا بإعدادات بسيطة');
      }

    } catch (err) {
      setError('فشل في تشغيل الكاميرا حتى بالإعدادات البسيطة');
    }
  };

  // مسح QR Code من الفيديو
  const startQRDetection = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }

    scanIntervalRef.current = setInterval(() => {
      if (videoRef.current && canvasRef.current) {
        scanFrame();
      }
    }, 500); // مسح كل 500ms
  };

  // مسح إطار واحد من الفيديو
  const scanFrame = () => {
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        return;
      }

      const context = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // رسم الإطار الحالي على الcanvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // محاولة قراءة QR Code باستخدام BarcodeDetector إذا كان متاحاً
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
        
        barcodeDetector.detect(canvas).then(barcodes => {
          if (barcodes.length > 0) {
            const qrCode = barcodes[0].rawValue;
            handleQRFound(qrCode);
          }
        }).catch(err => {
          // تجاهل أخطاء عدم وجود QR
        });
      } else {
        // استخدم طريقة بديلة إذا لم يكن BarcodeDetector متاحاً
        // يمكن هنا استخدام مكتبة أخرى أو jsQR
        tryJSQR(context, canvas.width, canvas.height);
      }

    } catch (err) {
      console.error('خطأ في مسح الإطار:', err);
    }
  };

  // محاولة باستخدام jsQR كبديل
  const tryJSQR = async (context, width, height) => {
    try {
      // تحميل jsQR بشكل ديناميكي
      if (!window.jsQR) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
        script.onload = () => {
          console.log('✅ تم تحميل jsQR');
        };
        document.head.appendChild(script);
        return;
      }

      const imageData = context.getImageData(0, 0, width, height);
      const code = window.jsQR(imageData.data, width, height);
      
      if (code) {
        handleQRFound(code.data);
      }

    } catch (err) {
      // تجاهل الخطأ
    }
  };

  // عند العثور على QR Code
  const handleQRFound = (qrData) => {
    console.log('✅ تم العثور على QR:', qrData);
    
    // إيقاف المسح
    stopScanning();
    
    // اهتزاز للإشعار
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
    
    toast({
      title: "✅ تم قراءة QR Code بنجاح",
      description: `الكود: ${qrData.substring(0, 50)}${qrData.length > 50 ? '...' : ''}`,
      variant: "success"
    });

    onScanSuccess?.(qrData);
  };

  // إيقاف المسح
  const stopScanning = () => {
    console.log('⏹️ إيقاف المسح المباشر');
    
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    setIsScanning(false);
  };

  // إدارة دورة حياة المكون
  useEffect(() => {
    if (open && !isScanning && !error) {
      const timer = setTimeout(() => {
        startCamera();
      }, 1000);
      return () => clearTimeout(timer);
    } else if (!open) {
      stopScanning();
    }
  }, [open]);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  const handleClose = () => {
    stopScanning();
    onOpenChange(false);
  };

  const handleRetry = () => {
    setError(null);
    startCamera();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-[95vw] p-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary text-lg">
            <Smartphone className="w-6 h-6" />
            {title}
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Native</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3">
          {/* منطقة الكاميرا */}
          <div className="relative">
            <video
              ref={videoRef}
              className="w-full rounded-lg border-2 border-primary/30 bg-black"
              style={{ 
                aspectRatio: '16/9',
                objectFit: 'cover'
              }}
              playsInline
              muted
              autoPlay
            />
            
            {/* Canvas مخفي للمسح */}
            <canvas
              ref={canvasRef}
              className="hidden"
            />
            
            {/* إطار المسح */}
            {isScanning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-4 border-green-400 rounded-lg shadow-lg animate-pulse">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500 rounded-tl-lg"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500 rounded-tr-lg"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500 rounded-bl-lg"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500 rounded-br-lg"></div>
                </div>
              </div>
            )}
            
            {/* طبقة التحميل */}
            {!isScanning && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-lg">
                <div className="text-center text-white">
                  <Camera className="w-12 h-12 animate-pulse mx-auto mb-2" />
                  <p className="text-sm font-semibold">تحضير الكاميرا...</p>
                </div>
              </div>
            )}
          </div>
          
          {/* رسائل الحالة */}
          {isScanning && (
            <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-center gap-2 text-green-700 mb-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="font-bold text-sm">📱 الكاميرا نشطة!</span>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>
              <p className="text-xs text-green-600">وجه الكاميرا نحو QR Code</p>
            </div>
          )}

          {/* رسائل الخطأ */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p className="text-sm">{error}</p>
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                >
                  <RefreshCw className="w-3 h-3 mr-2" />
                  إعادة المحاولة
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* نصائح */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
            <div className="text-xs text-blue-600 space-y-1">
              <p>• يستخدم تقنية الكاميرا المباشرة</p>
              <p>• يعمل على جميع الأجهزة والمتصفحات</p>
              <p>• السماح للكاميرا مطلوب</p>
            </div>
          </div>
        </div>
        
        <Button 
          onClick={handleClose}
          variant="outline" 
          className="w-full"
          size="sm"
        >
          إغلاق القارئ
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default NativeQRScanner;