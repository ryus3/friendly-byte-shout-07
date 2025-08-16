import React, { useRef, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, X, Zap, ZapOff, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsQR from 'jsqr';

const FinalQRScanner = ({ 
  open, 
  onOpenChange, 
  onScanSuccess, 
  title = "مسح QR Code" 
}) => {
  const { toast } = useToast();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);

  // بدء الكاميرا مع فحص الأذونات الكامل
  const startCamera = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('🚀 [Final QR] بدء تشغيل الكاميرا...');

      // فحص دعم المتصفح
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('المتصفح لا يدعم الوصول للكاميرا. يرجى استخدام متصفح حديث.');
      }

      // طلب أذونات الكاميرا
      console.log('🔐 [Final QR] طلب أذونات الكاميرا...');
      
      let stream;
      
      // محاولة الحصول على الكاميرا الخلفية أولاً
      try {
        console.log('📱 [Final QR] محاولة الكاميرا الخلفية...');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: "environment",  // إزالة "ideal"
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        });
        console.log('✅ [Final QR] نجح تشغيل الكاميرا الخلفية');
      } catch (backCameraError) {
        console.log('⚠️ [Final QR] فشل في الكاميرا الخلفية، محاولة أي كاميرا متاحة...');
        // محاولة أي كاميرا متاحة
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        });
        console.log('✅ [Final QR] نجح تشغيل كاميرا افتراضية');
      }

      if (!stream) {
        throw new Error('فشل في الحصول على تدفق الكاميرا');
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // انتظار تحميل الفيديو
        videoRef.current.onloadedmetadata = () => {
          console.log('📺 [Final QR] تم تحميل بيانات الفيديو');
          if (videoRef.current) {
            videoRef.current.play().then(() => {
              console.log('▶️ [Final QR] بدء تشغيل الفيديو');
              
              // فحص دعم الفلاش
              const track = stream.getVideoTracks()[0];
              const capabilities = track.getCapabilities?.();
              console.log('🔍 [Final QR] قدرات الكاميرا:', capabilities);
              
              if (capabilities?.torch) {
                setHasFlash(true);
                console.log('💡 [Final QR] الفلاش متاح!');
              } else {
                console.log('❌ [Final QR] الفلاش غير متاح');
                setHasFlash(false);
              }

              // بدء مسح QR
              startScanning();
              console.log('✅ [Final QR] الكاميرا تعمل بنجاح!');
              setIsLoading(false);
            }).catch((playError) => {
              console.error('❌ [Final QR] خطأ في تشغيل الفيديو:', playError);
              setError('فشل في تشغيل الفيديو: ' + playError.message);
              setIsLoading(false);
            });
          }
        };
        
        videoRef.current.onerror = (videoError) => {
          console.error('❌ [Final QR] خطأ في الفيديو:', videoError);
          setError('خطأ في الفيديو');
          setIsLoading(false);
        };
      }

    } catch (err) {
      console.error('❌ [Final QR] خطأ في الكاميرا:', err);
      let errorMessage = 'فشل في تشغيل الكاميرا';
      
      if (err.name === 'NotAllowedError') {
        errorMessage = 'تم رفض الإذن للوصول للكاميرا. يرجى السماح بالوصول للكاميرا في إعدادات المتصفح والمحاولة مرة أخرى.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'لم يتم العثور على كاميرا. تأكد من وجود كاميرا متصلة بالجهاز.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'الكاميرا مستخدمة من تطبيق آخر. أغلق التطبيقات الأخرى وحاول مرة أخرى.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = 'لا يمكن الوصول للكاميرا بالإعدادات المطلوبة. جربِّ كاميرا أخرى.';
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
    
    console.log('🔍 [Final QR] بدء مسح QR...');
    intervalRef.current = setInterval(() => {
      scanQRCode();
    }, 100); // مسح كل 100ms لسرعة أفضل
  };

  // مسح QR من الفيديو
  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

    // تحديد حجم canvas حسب حجم الفيديو
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    if (canvas.width === 0 || canvas.height === 0) return;
    
    // رسم الفيديو على canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      // الحصول على بيانات الصورة
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // استخدام jsQR لفحص QR
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert"
      });
      
      if (code && code.data) {
        console.log('🎯 [Final QR] QR Code وُجد!', code.data);
        handleQRDetected(code.data);
      }
    } catch (err) {
      // تجاهل أخطاء المسح البسيطة
      console.log('⚠️ [Final QR] خطأ طفيف في المسح:', err.message);
    }
  };

  // عند العثور على QR
  const handleQRDetected = (qrCode) => {
    console.log('🎯 [Final QR] تم العثور على QR:', qrCode);
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
    console.log('🛑 [Final QR] إيقاف الكاميرا...');
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 [Final QR] تم إيقاف track:', track.kind);
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setHasFlash(false);
    setFlashEnabled(false);
    console.log('✅ [Final QR] تم إيقاف الكاميرا بالكامل');
  };

  // تفعيل الفلاش
  const toggleFlash = async () => {
    console.log('💡 [Final QR] محاولة تبديل الفلاش...');
    console.log('💡 [Final QR] الحالة الحالية:', { hasFlash, flashEnabled, streamExists: !!streamRef.current });
    
    if (!streamRef.current) {
      console.log('❌ [Final QR] لا يوجد تدفق كاميرا');
      toast({
        title: "خطأ",
        description: "الكاميرا غير نشطة",
        variant: "destructive"
      });
      return;
    }

    if (!hasFlash) {
      console.log('❌ [Final QR] الفلاش غير متاح');
      toast({
        title: "الفلاش غير متاح",
        description: "هذا الجهاز لا يدعم الفلاش أو الكاميرا المستخدمة لا تحتوي على فلاش",
        variant: "destructive"
      });
      return;
    }

    try {
      const track = streamRef.current.getVideoTracks()[0];
      if (!track) {
        throw new Error('لا يوجد track للفيديو');
      }
      
      console.log('🔍 [Final QR] قدرات الكاميرا:', track.getCapabilities?.());
      
      const newState = !flashEnabled;
      console.log('💡 [Final QR] محاولة تعيين الفلاش إلى:', newState);
      
      await track.applyConstraints({
        advanced: [{ torch: newState }]
      });
      
      setFlashEnabled(newState);
      console.log('✅ [Final QR] تم تغيير الفلاش بنجاح إلى:', newState);
      
      toast({
        title: newState ? "تم تشغيل الفلاش" : "تم إطفاء الفلاش",
        description: newState ? "الفلاش نشط الآن" : "تم إطفاء الفلاش"
      });
    } catch (err) {
      console.error('❌ [Final QR] خطأ في الفلاش:', err);
      setHasFlash(false);
      toast({
        title: "خطأ في الفلاش",
        description: `فشل في التحكم بالفلاش: ${err.message}`,
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
      console.log('📱 [Final QR] فتح الماسح الضوئي');
      startCamera();
    } else {
      console.log('❌ [Final QR] إغلاق الماسح الضوئي');
      stopCamera();
    }
    
    return () => {
      console.log('🧹 [Final QR] تنظيف الماسح الضوئي');
      stopCamera();
    };
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
              <div className="absolute inset-4 border-2 border-white rounded-lg opacity-75">
                <div className="w-full h-full border-2 border-green-500 rounded-lg animate-pulse"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-black/50 text-white px-3 py-1 rounded text-sm">
                    وجّه الكاميرا نحو QR Code
                  </div>
                </div>
              </div>
            )}

            {/* زر الفلاش */}
            {hasFlash && !isLoading && !error && (
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
              <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                <div className="text-white text-center">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <p>جاري تشغيل الكاميرا...</p>
                  <p className="text-xs mt-1 opacity-75">يرجى السماح بالوصول للكاميرا</p>
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
                <div className="space-y-2">
                  <p>{error}</p>
                  <div className="flex gap-2">
                    <Button
                      onClick={startCamera}
                      size="sm"
                      variant="outline"
                    >
                      إعادة المحاولة
                    </Button>
                    <Button
                      onClick={() => window.location.reload()}
                      size="sm"
                      variant="outline"
                    >
                      إعادة تحميل الصفحة
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* أزرار */}
          <div className="flex gap-2">
            <Button onClick={simulateScan} variant="outline" className="flex-1">
              اختبار QR
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

export default FinalQRScanner;