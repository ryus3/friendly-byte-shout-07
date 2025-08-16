import React, { useRef, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, X, Zap, ZapOff, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import jsQR from 'jsqr';

const RealQRScanner = ({ 
  open, 
  onOpenChange, 
  onScanSuccess, 
  title = "مسح QR Code" 
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);

  // بدء الكاميرا مع فحص الأذونات
  const startCamera = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('🚀 [Real QR] بدء تشغيل الكاميرا...');

      // فحص دعم المتصفح
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('المتصفح لا يدعم الوصول للكاميرا');
      }

      // طلب أذونات الكاميرا صراحة
      console.log('🔐 [Real QR] طلب أذونات الكاميرا...');
      
      // الحصول على قائمة الكاميرات المتاحة
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      console.log('📹 [Real QR] الكاميرات المتاحة:', videoDevices.length);
      console.log('📹 [Real QR] قائمة الكاميرات:', videoDevices.map(d => ({ label: d.label, deviceId: d.deviceId })));
      
      let stream;
      
      // محاولة استخدام الكاميرا الخلفية أولاً
      const backCamera = videoDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment')
      );
      
      if (backCamera) {
        console.log('🎯 [Real QR] محاولة استخدام الكاميرا الخلفية:', backCamera.label);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              deviceId: { exact: backCamera.deviceId },
              width: { ideal: 640 },
              height: { ideal: 480 }
            }
          });
          console.log('✅ [Real QR] نجح تشغيل الكاميرا الخلفية');
        } catch (err) {
          console.log('⚠️ [Real QR] فشل في الكاميرا الخلفية:', err.message);
        }
      }
      
      // إذا لم تنجح الخلفية، استخدم أي كاميرا متاحة
      if (!stream) {
        console.log('🔄 [Real QR] محاولة استخدام أي كاميرا متاحة...');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        });
        console.log('✅ [Real QR] نجح تشغيل كاميرا افتراضية');
      }

      if (!stream) {
        throw new Error('فشل في الحصول على تدفق الكاميرا');
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // انتظار تحميل الفيديو
        await new Promise((resolve, reject) => {
          videoRef.current.onloadedmetadata = () => {
            console.log('📺 [Real QR] تم تحميل بيانات الفيديو');
            resolve();
          };
          videoRef.current.onerror = reject;
        });
        
        await videoRef.current.play();
        console.log('▶️ [Real QR] بدء تشغيل الفيديو');
        
        // فحص دعم الفلاش
        const track = stream.getVideoTracks()[0];
        console.log('🔍 [Real QR] فحص قدرات الكاميرا:', track.getCapabilities?.());
        
        const capabilities = track.getCapabilities?.();
        if (capabilities?.torch) {
          setHasFlash(true);
          console.log('💡 [Real QR] الفلاش متاح!');
        } else {
          console.log('❌ [Real QR] الفلاش غير متاح');
        }

        // بدء مسح QR
        startScanning();
        console.log('✅ [Real QR] الكاميرا تعمل بنجاح!');
      }

      setIsLoading(false);
    } catch (err) {
      console.error('❌ [Real QR] خطأ في الكاميرا:', err);
      let errorMessage = 'فشل في تشغيل الكاميرا';
      
      if (err.name === 'NotAllowedError') {
        errorMessage = 'تم رفض الإذن للوصول للكاميرا. يرجى السماح بالوصول للكاميرا في إعدادات المتصفح.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'لم يتم العثور على كاميرا. تأكد من وجود كاميرا متصلة بالجهاز.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'الكاميرا مستخدمة من تطبيق آخر. أغلق التطبيقات الأخرى وحاول مرة أخرى.';
      } else {
        errorMessage = `خطأ في الكاميرا: ${err.message}`;
      }
      
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  // بدء المسح
  const startScanning = () => {
    if (intervalRef.current) return;
    
    intervalRef.current = setInterval(() => {
      scanQRCode();
    }, 500); // مسح كل نصف ثانية
  };

  // مسح QR من الفيديو
  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      // الحصول على بيانات الصورة
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // محاولة قراءة QR بسيطة (محاكاة)
      // في التطبيق الحقيقي يجب استخدام مكتبة مثل jsQR
      detectQRPattern(imageData);
    } catch (err) {
      // تجاهل الأخطاء في المسح
    }
  };

  // كشف QR باستخدام jsQR
  const detectQRPattern = (imageData) => {
    try {
      console.log('🔍 [Real QR] فحص QR من البيانات... حجم الصورة:', imageData.width, 'x', imageData.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert"
      });
      
      if (code) {
        console.log('🎯 [Real QR] QR Code وُجد!', code.data);
        handleQRDetected(code.data);
        return true;
      } else {
        console.log('🔍 [Real QR] لم يتم العثور على QR في هذا الإطار');
        return false;
      }
    } catch (err) {
      console.log('⚠️ [Real QR] خطأ في فحص QR:', err.message);
      return false;
    }
  };

  // عند العثور على QR
  const handleQRDetected = (qrCode) => {
    console.log('🎯 [Real QR] تم العثور على QR:', qrCode);
    stopCamera();
    onScanSuccess?.(qrCode);
    toast({
      title: "تم مسح QR بنجاح!",
      description: `القيمة: ${qrCode}`,
    });
    onOpenChange(false);
  };

  // إيقاف الكاميرا
  const stopCamera = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setHasFlash(false);
    setFlashEnabled(false);
    console.log('🛑 [Real QR] تم إيقاف الكاميرا');
  };

  // تفعيل الفلاش
  const toggleFlash = async () => {
    console.log('💡 [Real QR] محاولة تبديل الفلاش...');
    console.log('💡 [Real QR] الحالة الحالية:', { hasFlash, flashEnabled, streamExists: !!streamRef.current });
    
    if (!streamRef.current) {
      console.log('❌ [Real QR] لا يوجد تدفق كاميرا');
      return;
    }

    if (!hasFlash) {
      console.log('❌ [Real QR] الفلاش غير متاح');
      toast({
        title: "الفلاش غير متاح",
        description: "هذا الجهاز لا يدعم الفلاش أو الكاميرا المستخدمة لا تحتوي على فلاش",
        variant: "destructive"
      });
      return;
    }

    try {
      const track = streamRef.current.getVideoTracks()[0];
      console.log('🔍 [Real QR] قدرات الكاميرا:', track.getCapabilities?.());
      
      const newState = !flashEnabled;
      console.log('💡 [Real QR] محاولة تعيين الفلاش إلى:', newState);
      
      await track.applyConstraints({
        advanced: [{ torch: newState }]
      });
      
      setFlashEnabled(newState);
      console.log('✅ [Real QR] تم تغيير الفلاش بنجاح إلى:', newState);
      
      toast({
        title: newState ? "تم تشغيل الفلاش" : "تم إطفاء الفلاش",
        description: newState ? "الفلاش نشط الآن" : "تم إطفاء الفلاش"
      });
    } catch (err) {
      console.error('❌ [Real QR] خطأ في الفلاش:', err);
      setHasFlash(false);
      toast({
        title: "خطأ في الفلاش",
        description: `فشل في تشغيل الفلاش: ${err.message}`,
        variant: "destructive"
      });
    }
  };

  // محاكاة مسح للاختبار
  const simulateScan = () => {
    const testQR = prompt('أدخل QR للاختبار:');
    if (testQR) {
      handleQRDetected(testQR);
    }
  };

  // تشغيل عند الفتح
  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
    }
    
    return () => stopCamera();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* الفيديو */}
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            
            {/* مؤشر المسح */}
            {!isLoading && !error && (
              <div className="absolute inset-4 border-2 border-white rounded-lg opacity-50">
                <div className="w-full h-full border border-green-500 rounded-lg animate-pulse"></div>
              </div>
            )}

            {/* زر الفلاش */}
            {hasFlash && (
              <Button
                onClick={toggleFlash}
                size="sm"
                variant={flashEnabled ? "default" : "outline"}
                className="absolute top-2 right-2"
              >
                {flashEnabled ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </Button>
            )}

            {/* حالة التحميل */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-white text-center">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <p>جاري تشغيل الكاميرا...</p>
                </div>
              </div>
            )}
          </div>

          {/* Canvas مخفي للمعالجة */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* خطأ */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                {error}
                <Button
                  onClick={startCamera}
                  size="sm"
                  variant="outline"
                  className="mt-2 ml-2"
                >
                  إعادة المحاولة
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* أزرار */}
          <div className="flex gap-2">
            <Button onClick={simulateScan} variant="outline" className="flex-1">
              محاكاة مسح للاختبار
            </Button>
            <Button onClick={() => onOpenChange(false)} variant="outline">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RealQRScanner;